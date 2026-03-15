/**
 * ============================================================================
 * ASHBY PROCESSOR
 * ============================================================================
 *
 * Imports jobs from Ashby ATS.
 * API: https://api.ashbyhq.com/posting-api/job-board/{companySlug}
 *
 * Response format: { jobs: [...] }
 * Each job has: id, title, department, team, employmentType, location,
 *   isRemote, jobUrl, applyUrl, descriptionHtml, descriptionPlain, publishedAt
 *
 * ============================================================================
 */

import { prisma } from '@/lib/db';
import { slugify, getMaxJobAgeDate } from '@/lib/utils';
import { ensureSalaryData } from '@/lib/salary-estimation';
import { queueCompanyEnrichmentBySlug } from '@/services/company-enrichment';
import { cleanupOldJobs, cleanupOldParsingLogs, cleanupOrphanedCompanies } from '@/services/job-cleanup';
import { buildJobUrl, notifySearchEngines } from '@/lib/indexing';
import { getDeepSeekUsageStats, resetDeepSeekUsageStats } from '@/lib/deepseek';
import { isPhysicalLocation, shouldSkipJob } from '@/lib/job-filter';
import { isBlockedCompany } from '@/config/company-blacklist';
import type { ProcessingStats, ProcessorContext, AshbyJob, AshbyApiResponse } from './types';

function createLimiter(concurrency: number) {
  let active = 0;
  const queue: (() => void)[] = [];

  return async <T>(fn: () => Promise<T>): Promise<T> => {
    while (active >= concurrency) {
      await new Promise<void>(resolve => queue.push(resolve));
    }
    active++;
    try {
      return await fn();
    } finally {
      active--;
      queue.shift()?.();
    }
  };
}

export async function processAshbySource(context: ProcessorContext): Promise<ProcessingStats> {
  const { importLogId, dataSourceId } = context;

  const stats: ProcessingStats = {
    total: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    createdJobUrls: [],
    createdJobIds: [],
  };

  resetDeepSeekUsageStats();

  const dataSource = await prisma.dataSource.findUnique({
    where: { id: dataSourceId },
  });

  if (!dataSource || dataSource.sourceType !== 'ASHBY') {
    throw new Error('Invalid Ashby data source');
  }

  if (!dataSource.companySlug) {
    throw new Error('Company slug is required for Ashby source');
  }

  if (isBlockedCompany(dataSource.companySlug, dataSource.name)) {
    console.log(`[Ashby] BLOCKED: ${dataSource.name} is in company blacklist`);
    return stats;
  }

  const apiUrl = dataSource.apiUrl ||
    `https://api.ashbyhq.com/posting-api/job-board/${dataSource.companySlug}`;

  try {
    console.log(`[Ashby] Fetching jobs from: ${apiUrl}`);

    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`Ashby API error: ${response.status} ${response.statusText}`);
    }

    const data: AshbyApiResponse = await response.json();
    const jobs = data.jobs || [];
    stats.total = jobs.length;
    console.log(`[Ashby] Found ${jobs.length} jobs for ${dataSource.name}`);

    if (jobs.length === 0) {
      await prisma.dataSource.update({
        where: { id: dataSourceId },
        data: {
          lastRunAt: new Date(),
          lastSuccessAt: new Date(),
          lastFetched: 0,
          lastCreated: 0,
          lastError: null,
          errorCount: 0,
        },
      });
      return stats;
    }

    // Fetch existing job IDs for duplicate detection
    const existingJobs = await prisma.job.findMany({
      where: {
        OR: [
          { sourceId: { in: jobs.map(j => j.id) } },
          { sourceUrl: { in: jobs.map(j => j.jobUrl) } },
        ],
      },
      select: { sourceId: true, sourceUrl: true },
    });
    const existingSourceIds = new Set(
      existingJobs.map(j => j.sourceId).filter((id): id is string => id !== null)
    );
    const existingSourceUrls = new Set(
      existingJobs.map(j => j.sourceUrl).filter((url): url is string => url !== null)
    );

    // Filter jobs
    const filteredJobs: AshbyJob[] = [];
    const maxAgeDate = getMaxJobAgeDate();

    for (const job of jobs) {
      if (existingSourceIds.has(job.id) || existingSourceUrls.has(job.jobUrl)) {
        stats.skipped++;
        continue;
      }

      if (job.publishedAt) {
        const jobDate = new Date(job.publishedAt);
        if (jobDate < maxAgeDate) {
          stats.skipped++;
          continue;
        }
      }

      const filterResult = shouldSkipJob({
        title: job.title,
        location: job.location,
        locationType: detectLocationType(job.location, job.isRemote),
      });
      if (filterResult.skip) {
        stats.skipped++;
        continue;
      }

      filteredJobs.push(job);
    }

    const MAX_JOBS_PER_SOURCE = 300;
    let jobsToProcess = filteredJobs;
    if (jobsToProcess.length > MAX_JOBS_PER_SOURCE) {
      const excess = jobsToProcess.length - MAX_JOBS_PER_SOURCE;
      console.log(`[Ashby] Limiting ${dataSource.name} from ${jobsToProcess.length} to ${MAX_JOBS_PER_SOURCE} jobs`);
      jobsToProcess = jobsToProcess.slice(0, MAX_JOBS_PER_SOURCE);
      stats.skipped += excess;
    }

    if (jobsToProcess.length === 0) {
      console.log(`[Ashby] No new jobs to process for ${dataSource.name}`);
      await prisma.dataSource.update({
        where: { id: dataSourceId },
        data: {
          lastRunAt: new Date(),
          lastSuccessAt: new Date(),
          lastFetched: stats.total,
          lastCreated: 0,
          lastError: null,
          errorCount: 0,
        },
      });
      return stats;
    }

    console.log(`[Ashby] Processing ${jobsToProcess.length} jobs (${stats.skipped} filtered)`);

    const company = await findOrCreateCompany(dataSource.name, dataSource.companySlug);

    // Batch duplicate check by title
    const existingTitles = await prisma.job.findMany({
      where: {
        companyId: company.id,
        title: { in: jobsToProcess.map(j => j.title) }
      },
      select: { title: true }
    });
    const existingTitleSet = new Set(existingTitles.map(j => j.title));
    const jobsAfterTitleCheck = jobsToProcess.filter(j => !existingTitleSet.has(j.title));
    const titleDuplicates = jobsToProcess.length - jobsAfterTitleCheck.length;
    if (titleDuplicates > 0) {
      console.log(`[Ashby] Filtered ${titleDuplicates} duplicate titles`);
      stats.skipped += titleDuplicates;
    }

    const CONCURRENCY = 10;
    const limit = createLimiter(CONCURRENCY);
    let processed = 0;
    let created = 0;
    const totalToProcess = jobsAfterTitleCheck.length;
    const startTime = Date.now();

    const companySlug = dataSource.companySlug!;

    const processJob = async (job: AshbyJob) => {
      try {
        const result = await processAshbyJob(
          job,
          company.id,
          companySlug,
          importLogId,
          dataSource.name
        );
        processed++;

        if (result.status === 'created') {
          stats.created++;
          created++;
          if (result.jobSlug) {
            stats.createdJobUrls!.push(buildJobUrl(company.slug, result.jobSlug));
          }
          if (result.jobId) {
            stats.createdJobIds!.push(result.jobId);
          }
        } else if (result.status === 'skipped') {
          stats.skipped++;
        }

        const elapsed = Math.round((Date.now() - startTime) / 1000);
        const remaining = totalToProcess - processed;
        const avgTime = elapsed / processed;
        const eta = Math.round(remaining * avgTime);
        console.log(`[Ashby] ${processed}/${totalToProcess} | +${created} | ETA: ${eta}s | ${job.title.slice(0, 40)}...`);
      } catch (error) {
        stats.failed++;
        stats.errors.push(`Job ${job.id}: ${String(error)}`);
      }
    };

    await Promise.all(jobsAfterTitleCheck.map(job => limit(() => processJob(job))));

    if (stats.createdJobUrls && stats.createdJobUrls.length > 0) {
      console.log(`[Ashby] Notifying search engines for ${stats.createdJobUrls.length} new jobs`);
      notifySearchEngines(stats.createdJobUrls).catch((err) => {
        console.error('[Ashby] Search engine notification failed:', err);
      });
    }

    await prisma.dataSource.update({
      where: { id: dataSourceId },
      data: {
        lastRunAt: new Date(),
        lastSuccessAt: new Date(),
        totalImported: { increment: stats.created },
        lastCreated: stats.created,
        lastFetched: stats.total,
        lastError: null,
        errorCount: 0,
      },
    });

    await cleanupOldJobs();
    await cleanupOrphanedCompanies();
    await cleanupOldParsingLogs();

    const aiStats = getDeepSeekUsageStats();
    if (aiStats.calls > 0) {
      console.log(`[Ashby] DeepSeek usage: ${aiStats.calls} calls, $${aiStats.estimatedCostUSD.toFixed(4)}`);
    }

    return stats;
  } catch (error) {
    await prisma.dataSource.update({
      where: { id: dataSourceId },
      data: {
        lastRunAt: new Date(),
        lastError: String(error),
        errorCount: { increment: 1 },
      },
    });

    throw error;
  }
}

async function processAshbyJob(
  job: AshbyJob,
  companyId: string,
  companySlug: string,
  importLogId: string,
  companyName: string
): Promise<{ status: 'created' | 'skipped'; jobSlug?: string; jobId?: string }> {
  const description = job.descriptionPlain || htmlToPlainText(job.descriptionHtml || '');

  if (!description || description.length < 50) {
    console.log(`[Ashby] Skipping job with insufficient content: ${job.title}`);
    return { status: 'skipped' };
  }

  const department = job.department || job.team;
  const categorySlug = mapDepartmentToCategory(department, job.title);
  let category = await prisma.category.findUnique({ where: { slug: categorySlug } });
  if (!category) {
    category = await prisma.category.create({
      data: { slug: categorySlug, name: getCategoryName(categorySlug) },
    });
  }

  const shortId = job.id.slice(-8);
  const baseSlug = slugify(`${job.title}-${companySlug}-${shortId}`);
  const slug = await generateUniqueJobSlug(baseSlug);

  const location = job.location || 'Remote';
  const locationType = detectLocationType(location, job.isRemote);
  const country = extractCountryCode(location);
  const level = extractLevel(job.title);
  const salaryData = ensureSalaryData({ salaryMin: null }, categorySlug, level, country);
  const skills = extractSkillsFromDescription(description, department);
  const postedAt = job.publishedAt ? new Date(job.publishedAt) : new Date();

  const jobType = mapEmploymentType(job.employmentType);

  try {
    const createdJob = await prisma.job.create({
      data: {
        slug,
        title: job.title,
        description,
        cleanDescription: null,
        summaryBullets: [],
        requirementBullets: [],
        benefitBullets: [],
        companyId,
        categoryId: category.id,
        location,
        locationType,
        country,
        level,
        type: jobType,
        ...salaryData,
        skills,
        benefits: [],
        source: 'ASHBY',
        sourceType: 'STRUCTURED',
        sourceUrl: job.jobUrl,
        sourceId: job.id,
        applyUrl: job.applyUrl || job.jobUrl,
        enrichmentStatus: 'COMPLETED',
        qualityScore: 80,
        postedAt,
      },
    });

    return { status: 'created', jobSlug: slug, jobId: createdJob.id };
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      console.log(`[Ashby] Skipping duplicate: ${job.title}`);
      return { status: 'skipped' };
    }
    throw error;
  }
}

async function findOrCreateCompany(name: string, slug: string) {
  const website = `https://${slug.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;

  let company = await prisma.company.findFirst({
    where: {
      OR: [
        { slug },
        { name: { equals: name, mode: 'insensitive' } },
      ],
    },
  });

  if (!company) {
    const uniqueSlug = await generateUniqueCompanySlug(slug);
    company = await prisma.company.create({
      data: {
        slug: uniqueSlug,
        name,
        website,
        atsType: 'ASHBY',
        atsId: slug,
        verified: true,
      },
    });

    queueCompanyEnrichmentBySlug(company.id, uniqueSlug);
  } else if (company.apolloEnrichedAt === null) {
    queueCompanyEnrichmentBySlug(company.id, company.slug);
  }

  return company;
}

async function generateUniqueCompanySlug(base: string): Promise<string> {
  let slug = base;
  let counter = 1;
  while (true) {
    const exists = await prisma.company.findUnique({ where: { slug } });
    if (!exists) return slug;
    slug = `${base}-${counter}`;
    counter++;
  }
}

async function generateUniqueJobSlug(base: string): Promise<string> {
  let slug = base;
  let counter = 1;
  while (true) {
    const exists = await prisma.job.findUnique({ where: { slug } });
    if (!exists) return slug;
    slug = `${base}-${counter}`;
    counter++;
  }
}

function detectLocationType(location?: string, isRemote?: boolean): 'REMOTE' | 'REMOTE_US' | 'REMOTE_EU' | 'REMOTE_COUNTRY' | 'HYBRID' | 'ONSITE' {
  if (isRemote) {
    const loc = (location || '').toLowerCase();
    if (loc.includes('us only') || loc.includes('usa only')) return 'REMOTE_US';
    if (loc.includes('eu only') || loc.includes('europe only')) return 'REMOTE_EU';
    return 'REMOTE';
  }

  const loc = (location || '').toLowerCase();
  if (loc.includes('remote')) {
    if (loc.includes('us only') || loc.includes('usa only')) return 'REMOTE_US';
    if (loc.includes('eu only') || loc.includes('europe only')) return 'REMOTE_EU';
    return 'REMOTE';
  }
  if (loc.includes('hybrid')) return 'HYBRID';
  if (isPhysicalLocation(location || '')) return 'ONSITE';

  return 'ONSITE';
}

function mapEmploymentType(employmentType?: string): 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'FREELANCE' | 'INTERNSHIP' {
  const t = (employmentType || '').toLowerCase();
  if (t.includes('part')) return 'PART_TIME';
  if (t.includes('contract') || t.includes('contractor')) return 'CONTRACT';
  if (t.includes('freelance')) return 'FREELANCE';
  if (t.includes('intern')) return 'INTERNSHIP';
  return 'FULL_TIME';
}

function mapDepartmentToCategory(department?: string, title?: string): string {
  const d = (department || '').toLowerCase();
  const t = (title || '').toLowerCase();
  const combined = `${d} ${t}`;

  if (t.includes('engineer') || t.includes('developer') || t.includes('programmer')) return 'engineering';
  if (d.includes('engineer') || d.includes('develop') || d.includes('software') || d.includes('tech')) return 'engineering';
  if (d.includes('design') || d.includes('ux') || d.includes('ui') || d.includes('creative')) return 'design';
  if (d.includes('data') || d.includes('analytics') || d.includes('machine learning') || d.includes('ai')) return 'data';
  if (d.includes('devops') || d.includes('infrastructure') || d.includes('sre') || d.includes('platform')) return 'devops';
  if (d.includes('qa') || d.includes('quality') || d.includes('test')) return 'qa';
  if (d.includes('security') || d.includes('infosec')) return 'security';
  if (d.includes('product') && !d.includes('market')) return 'product';
  if (d.includes('market') || d.includes('growth') || d.includes('brand')) return 'marketing';
  if (d.includes('sale') || d.includes('business dev')) return 'sales';
  if (d.includes('finance') || d.includes('account')) return 'finance';
  if (d.includes('hr') || d.includes('people') || d.includes('recruit') || d.includes('talent')) return 'hr';
  if (d.includes('operations') || d.includes('admin')) return 'operations';
  if (d.includes('legal') || d.includes('compliance')) return 'legal';
  if (d.includes('project manage') || d.includes('program manage')) return 'project-management';
  if (d.includes('content') || d.includes('writer') || d.includes('editor')) return 'writing';
  if (d.includes('translat') || d.includes('locali')) return 'translation';
  if (d.includes('video') || d.includes('media')) return 'creative';
  if (d.includes('support') || d.includes('customer success')) return 'support';
  if (d.includes('education') || d.includes('training')) return 'education';
  if (d.includes('research')) return 'research';
  if (d.includes('consult')) return 'consulting';

  if (combined.includes('designer')) return 'design';
  if (combined.includes('product manager')) return 'product';
  if (combined.includes('marketing')) return 'marketing';
  if (combined.includes('sales')) return 'sales';
  if (combined.includes('data')) return 'data';
  if (combined.includes('support')) return 'support';

  return 'support';
}

function getCategoryName(slug: string): string {
  const names: Record<string, string> = {
    engineering: 'Engineering', design: 'Design', data: 'Data & Analytics',
    devops: 'DevOps', qa: 'QA & Testing', security: 'Security',
    product: 'Product', marketing: 'Marketing', sales: 'Sales',
    finance: 'Finance', hr: 'HR & Recruiting', operations: 'Operations',
    legal: 'Legal', 'project-management': 'Project Management',
    writing: 'Writing & Content', translation: 'Translation',
    creative: 'Creative & Media', support: 'Customer Support',
    education: 'Education', research: 'Research', consulting: 'Consulting',
  };
  return names[slug] || slug;
}

function extractCountryCode(location: string): string | null {
  const countryMap: Record<string, string> = {
    'usa': 'US', 'united states': 'US', 'us': 'US',
    'uk': 'GB', 'united kingdom': 'GB',
    'canada': 'CA', 'germany': 'DE', 'france': 'FR',
    'netherlands': 'NL', 'spain': 'ES', 'italy': 'IT',
    'australia': 'AU', 'india': 'IN', 'brazil': 'BR',
    'mexico': 'MX', 'poland': 'PL', 'portugal': 'PT',
    'ireland': 'IE', 'sweden': 'SE', 'switzerland': 'CH',
    'singapore': 'SG', 'japan': 'JP', 'israel': 'IL',
    'sf': 'US', 'san francisco': 'US', 'new york': 'US', 'nyc': 'US',
    'seattle': 'US', 'austin': 'US', 'boston': 'US', 'chicago': 'US',
    'london': 'GB', 'dublin': 'IE', 'amsterdam': 'NL', 'berlin': 'DE',
    'paris': 'FR', 'tokyo': 'JP', 'sydney': 'AU', 'toronto': 'CA',
  };
  const loc = location.toLowerCase();
  for (const [key, code] of Object.entries(countryMap)) {
    if (loc.includes(key)) return code;
  }
  return null;
}

function extractLevel(title: string): 'INTERN' | 'ENTRY' | 'JUNIOR' | 'MID' | 'SENIOR' | 'LEAD' | 'MANAGER' | 'DIRECTOR' | 'EXECUTIVE' {
  const t = title.toLowerCase();
  if (t.includes('intern')) return 'INTERN';
  if (t.includes('entry') || t.includes('graduate') || t.includes('new grad')) return 'ENTRY';
  if (t.includes('junior') || t.includes('jr.') || t.includes('jr ')) return 'JUNIOR';
  if (t.includes('senior') || t.includes('sr.') || t.includes('sr ')) return 'SENIOR';
  if (t.includes('staff') || t.includes('principal')) return 'LEAD';
  if (t.includes('lead') || t.includes('tech lead')) return 'LEAD';
  if (t.includes('manager') && !t.includes('product manager')) return 'MANAGER';
  if (t.includes('director')) return 'DIRECTOR';
  if (t.includes('vp') || t.includes('vice president') || t.includes('head of') || t.includes('chief')) return 'EXECUTIVE';
  return 'MID';
}

function htmlToPlainText(html: string): string {
  let text = html
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'").replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"').replace(/&ldquo;/g, '"')
    .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–');

  return text
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/li>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<h[1-6][^>]*>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<\/?[uo]l[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractSkillsFromDescription(description: string, department?: string): string[] {
  const skills: Set<string> = new Set();
  const techSkills = [
    'JavaScript', 'TypeScript', 'Python', 'Java', 'Golang', 'Rust', 'C++', 'C#',
    'React', 'Angular', 'Vue', 'Node.js', 'Next.js', 'Django', 'Rails', 'Spring',
    'AWS', 'GCP', 'Azure', 'Kubernetes', 'Docker', 'Terraform',
    'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch',
    'GraphQL', 'REST API', 'Microservices',
    'Machine Learning', 'Data Science', 'TensorFlow', 'PyTorch',
    'Figma', 'Sketch', 'Adobe XD',
    'Agile', 'Scrum', 'CI/CD', 'Git',
  ];
  const shortSkills = ['Go', 'AI', 'API', 'ML', 'NLP'];
  const lowerDesc = description.toLowerCase();
  for (const skill of techSkills) {
    if (lowerDesc.includes(skill.toLowerCase())) skills.add(skill);
  }
  for (const skill of shortSkills) {
    const regex = new RegExp(`\\b${skill}\\b`, 'i');
    if (regex.test(description)) skills.add(skill);
  }
  if (department) {
    const d = department.toLowerCase();
    if (d.includes('frontend')) skills.add('Frontend');
    if (d.includes('backend')) skills.add('Backend');
    if (d.includes('fullstack') || d.includes('full-stack')) skills.add('Full Stack');
    if (d.includes('mobile')) skills.add('Mobile');
    if (d.includes('devops') || d.includes('infrastructure')) skills.add('DevOps');
    if (d.includes('data')) skills.add('Data');
  }
  return Array.from(skills).slice(0, 10);
}
