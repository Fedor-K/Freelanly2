import { prisma } from '@/lib/db';
import { slugify } from '@/lib/utils';
import { queueCompanyEnrichmentBySlug } from '@/services/company-enrichment';
import { cleanupOldJobs } from '@/services/job-cleanup';
import { buildJobUrl } from '@/lib/indexing';
import type { ProcessingStats, LeverJob } from './types';

export async function processLeverSource(dataSourceId: string): Promise<ProcessingStats> {
  const stats: ProcessingStats = {
    total: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    createdJobUrls: [],
  };

  // Get the data source
  const dataSource = await prisma.dataSource.findUnique({
    where: { id: dataSourceId },
  });

  if (!dataSource || dataSource.sourceType !== 'LEVER') {
    throw new Error('Invalid Lever data source');
  }

  if (!dataSource.companySlug) {
    throw new Error('Company slug is required for Lever source');
  }

  const apiUrl = dataSource.apiUrl ||
    `https://api.lever.co/v0/postings/${dataSource.companySlug}?mode=json`;

  try {
    console.log(`[Lever] Fetching jobs from: ${apiUrl}`);

    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`Lever API error: ${response.status} ${response.statusText}`);
    }

    const jobs: LeverJob[] = await response.json();
    stats.total = jobs.length;
    console.log(`[Lever] Found ${jobs.length} jobs for ${dataSource.name}`);

    // Find or create company
    const company = await findOrCreateCompany(dataSource.name, dataSource.companySlug);

    // Process each job
    for (const job of jobs) {
      try {
        const result = await processLeverJob(job, company.id, dataSource.companySlug);
        if (result.status === 'created') {
          stats.created++;
          if (result.jobSlug) {
            stats.createdJobUrls!.push(buildJobUrl(company.slug, result.jobSlug));
          }
        } else if (result.status === 'updated') {
          stats.updated++;
        } else if (result.status === 'skipped') {
          stats.skipped++;
        }
      } catch (error) {
        stats.failed++;
        stats.errors.push(`Job ${job.id}: ${String(error)}`);
      }
    }

    // Update data source stats
    await prisma.dataSource.update({
      where: { id: dataSourceId },
      data: {
        lastRunAt: new Date(),
        lastSuccessAt: new Date(),
        totalImported: { increment: stats.created },
        lastCreated: stats.created,
        lastError: null,
        errorCount: 0,
      },
    });

    // Cleanup old jobs after successful import
    await cleanupOldJobs();

    return stats;
  } catch (error) {
    // Update data source with error
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

async function processLeverJob(
  job: LeverJob,
  companyId: string,
  companySlug: string
): Promise<{ status: 'created' | 'updated' | 'skipped'; jobSlug?: string }> {
  // Build full description (with RESPONSIBILITIES, QUALIFICATIONS, etc.)
  const fullDescription = buildDescription(job);

  // Check if job already exists
  const existingJob = await prisma.job.findFirst({
    where: {
      OR: [
        { sourceId: job.id },
        { sourceUrl: job.hostedUrl },
      ],
    },
  });

  if (existingJob) {
    // Update if description changed (compare full built description)
    const needsUpdate = existingJob.title !== job.text ||
      existingJob.description !== fullDescription;

    if (needsUpdate) {
      await prisma.job.update({
        where: { id: existingJob.id },
        data: {
          title: job.text,
          description: fullDescription,
          updatedAt: new Date(),
        },
      });
      return { status: 'updated' };
    }
    return { status: 'skipped' };
  }

  // Get category (check department first, then title as fallback)
  const categorySlug = mapDepartmentToCategory(job.categories.department, job.text);
  let category = await prisma.category.findUnique({ where: { slug: categorySlug } });
  if (!category) {
    category = await prisma.category.create({
      data: { slug: categorySlug, name: getCategoryName(categorySlug) },
    });
  }

  // Generate slug with Lever job ID suffix to guarantee uniqueness
  const shortId = job.id.slice(-8);
  const baseSlug = slugify(`${job.text}-${companySlug}-${shortId}`);
  const slug = await generateUniqueJobSlug(baseSlug);

  // Parse location
  const location = job.categories.location || 'Remote';
  const locationType = mapWorkplaceType(job.workplaceType, location);
  const country = extractCountryCode(location);

  // Parse level from title or department
  const level = extractLevel(job.text);

  // Parse job type
  const jobType = mapCommitmentToType(job.categories.commitment);

  // Extract skills from tags/description
  const skills = extractSkillsFromDescription(fullDescription, job.categories.department);

  // Create job
  await prisma.job.create({
    data: {
      slug,
      title: job.text,
      description: fullDescription,
      companyId,
      categoryId: category.id,
      location,
      locationType,
      country,
      level,
      type: jobType,
      salaryMin: job.salaryRange?.min,
      salaryMax: job.salaryRange?.max,
      salaryCurrency: job.salaryRange?.currency || 'USD',
      salaryPeriod: mapSalaryInterval(job.salaryRange?.interval),
      salaryIsEstimate: false,
      skills,
      benefits: [],
      source: 'LEVER',
      sourceType: 'STRUCTURED',
      sourceUrl: job.hostedUrl,
      sourceId: job.id,
      applyUrl: job.applyUrl,
      enrichmentStatus: 'COMPLETED',
      qualityScore: 75, // ATS data is generally high quality
      postedAt: new Date(job.createdAt),
    },
  });

  return { status: 'created', jobSlug: slug };
}

async function findOrCreateCompany(name: string, slug: string) {
  // Search by slug OR by name (case-insensitive) to avoid duplicates
  let company = await prisma.company.findFirst({
    where: {
      OR: [
        { slug },
        { name: { equals: name, mode: 'insensitive' } },
      ],
    },
  });

  if (!company) {
    // Generate unique slug in case similar company exists with different name
    const uniqueSlug = await generateUniqueCompanySlug(slug);
    company = await prisma.company.create({
      data: {
        slug: uniqueSlug,
        name,
        atsType: 'LEVER',
        atsId: slug,
        verified: true,
      },
    });

    // Queue automatic enrichment for new company
    queueCompanyEnrichmentBySlug(company.id, uniqueSlug);
  } else if (company.logo === null) {
    // Also enrich existing companies without logo
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

function mapDepartmentToCategory(department?: string, title?: string): string {
  const d = (department || '').toLowerCase();
  const t = (title || '').toLowerCase();
  const combined = `${d} ${t}`;

  // Tech
  if (d.includes('engineer') || d.includes('develop') || d.includes('software') || d.includes('tech')) return 'engineering';
  if (d.includes('design') || d.includes('ux') || d.includes('ui') || d.includes('creative')) return 'design';
  if (d.includes('data') || d.includes('analytics') || d.includes('machine learning') || d.includes('ai') || d.includes('bi')) return 'data';
  if (d.includes('devops') || d.includes('infrastructure') || d.includes('sre') || d.includes('platform') || d.includes('cloud')) return 'devops';
  if (d.includes('qa') || d.includes('quality') || d.includes('test')) return 'qa';
  if (d.includes('security') || d.includes('infosec') || d.includes('cyber')) return 'security';

  // Business
  if (d.includes('product') && !d.includes('market')) return 'product';
  if (d.includes('market') || d.includes('growth') || d.includes('brand')) return 'marketing';
  if (d.includes('sale') || d.includes('business dev') || d.includes('account exec')) return 'sales';
  if (d.includes('finance') || d.includes('account') || d.includes('payroll') || d.includes('treasury')) return 'finance';
  if (d.includes('hr') || d.includes('people') || d.includes('recruit') || d.includes('talent')) return 'hr';
  if (d.includes('operations') || d.includes('admin') || d.includes('office')) return 'operations';
  if (d.includes('legal') || d.includes('compliance') || d.includes('contract')) return 'legal';
  if (d.includes('project manage') || d.includes('program manage') || d.includes('pmo')) return 'project-management';

  // Content & Creative
  if (d.includes('content') || d.includes('writer') || d.includes('editor') || d.includes('copywrite')) return 'writing';
  if (d.includes('translat') || d.includes('locali') || d.includes('language')) return 'translation';
  if (d.includes('video') || d.includes('media') || d.includes('audio') || d.includes('animat')) return 'creative';

  // Other
  if (d.includes('support') || d.includes('customer success') || d.includes('cx')) return 'support';
  if (d.includes('education') || d.includes('training') || d.includes('learning') || d.includes('teach')) return 'education';
  if (d.includes('research') || d.includes('ux research') || d.includes('user research')) return 'research';
  if (d.includes('consult') || d.includes('advisory')) return 'consulting';

  // Fallback: check job title
  if (combined.includes('payroll') || combined.includes('accountant') || combined.includes('controller') || combined.includes('bookkeeper')) return 'finance';
  if (combined.includes('designer') || combined.includes('ux') || combined.includes('ui')) return 'design';
  if (combined.includes('product manager') || combined.includes('product owner')) return 'product';
  if (combined.includes('marketing') || combined.includes('growth') || combined.includes('seo')) return 'marketing';
  if (combined.includes('sales') || combined.includes('account executive') || combined.includes('bdr') || combined.includes('sdr')) return 'sales';
  if (combined.includes('recruiter') || combined.includes('hr ') || combined.includes('human resource') || combined.includes('people ops')) return 'hr';
  if (combined.includes('data analyst') || combined.includes('data scientist') || combined.includes('data engineer')) return 'data';
  if (combined.includes('devops') || combined.includes('sre') || combined.includes('infrastructure')) return 'devops';
  if (combined.includes('qa') || combined.includes('tester') || combined.includes('quality assurance')) return 'qa';
  if (combined.includes('security') || combined.includes('infosec')) return 'security';
  if (combined.includes('support') || combined.includes('customer success')) return 'support';
  if (combined.includes('project manager') || combined.includes('scrum master') || combined.includes('agile coach')) return 'project-management';
  if (combined.includes('translator') || combined.includes('interpreter') || combined.includes('localization')) return 'translation';
  if (combined.includes('writer') || combined.includes('editor') || combined.includes('copywriter') || combined.includes('content')) return 'writing';
  if (combined.includes('video') || combined.includes('animator') || combined.includes('motion')) return 'creative';
  if (combined.includes('teacher') || combined.includes('instructor') || combined.includes('tutor')) return 'education';
  if (combined.includes('researcher')) return 'research';
  if (combined.includes('operations') || combined.includes('office manager') || combined.includes('executive assistant')) return 'operations';
  if (combined.includes('legal') || combined.includes('lawyer') || combined.includes('attorney') || combined.includes('paralegal')) return 'legal';
  if (combined.includes('consultant')) return 'consulting';

  return 'engineering';
}

function getCategoryName(slug: string): string {
  const names: Record<string, string> = {
    // Tech
    engineering: 'Engineering',
    design: 'Design',
    data: 'Data & Analytics',
    devops: 'DevOps',
    qa: 'QA & Testing',
    security: 'Security',
    // Business
    product: 'Product',
    marketing: 'Marketing',
    sales: 'Sales',
    finance: 'Finance',
    hr: 'HR & Recruiting',
    operations: 'Operations',
    legal: 'Legal',
    'project-management': 'Project Management',
    // Content
    writing: 'Writing & Content',
    translation: 'Translation',
    creative: 'Creative & Media',
    // Other
    support: 'Customer Support',
    education: 'Education',
    research: 'Research',
    consulting: 'Consulting',
  };
  return names[slug] || slug;
}

function mapWorkplaceType(workplaceType?: string, location?: string): 'REMOTE' | 'REMOTE_US' | 'REMOTE_EU' | 'REMOTE_COUNTRY' | 'HYBRID' | 'ONSITE' {
  if (workplaceType === 'remote') {
    const loc = location?.toLowerCase() || '';
    if (loc.includes('us') || loc.includes('united states') || loc.includes('usa')) return 'REMOTE_US';
    if (loc.includes('eu') || loc.includes('europe') || loc.includes('emea')) return 'REMOTE_EU';
    return 'REMOTE';
  }
  if (workplaceType === 'hybrid') return 'HYBRID';
  return 'ONSITE';
}

function extractCountryCode(location: string): string | null {
  const countryMap: Record<string, string> = {
    'usa': 'US', 'united states': 'US', 'us': 'US', 'america': 'US',
    'uk': 'GB', 'united kingdom': 'GB', 'britain': 'GB', 'england': 'GB',
    'canada': 'CA',
    'germany': 'DE',
    'france': 'FR',
    'netherlands': 'NL',
    'spain': 'ES',
    'italy': 'IT',
    'australia': 'AU',
    'india': 'IN',
    'brazil': 'BR',
    'mexico': 'MX',
    'poland': 'PL',
    'portugal': 'PT',
    'ireland': 'IE',
    'sweden': 'SE',
    'switzerland': 'CH',
    'singapore': 'SG',
    'japan': 'JP',
    'israel': 'IL',
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

function mapCommitmentToType(commitment?: string): 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'FREELANCE' | 'INTERNSHIP' | 'TEMPORARY' {
  if (!commitment) return 'FULL_TIME';
  const c = commitment.toLowerCase();
  if (c.includes('part-time') || c.includes('part time')) return 'PART_TIME';
  if (c.includes('contract') || c.includes('contractor')) return 'CONTRACT';
  if (c.includes('freelance')) return 'FREELANCE';
  if (c.includes('intern')) return 'INTERNSHIP';
  if (c.includes('temporary') || c.includes('temp')) return 'TEMPORARY';
  return 'FULL_TIME';
}

function mapSalaryInterval(interval?: string): 'HOUR' | 'DAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'ONE_TIME' {
  if (!interval) return 'YEAR';
  const i = interval.toLowerCase();
  if (i.includes('hour') || i === 'hourly') return 'HOUR';
  if (i.includes('day') || i === 'daily') return 'DAY';
  if (i.includes('week') || i === 'weekly') return 'WEEK';
  if (i.includes('month') || i === 'monthly') return 'MONTH';
  if (i.includes('one-time') || i.includes('one time') || i === 'once' || i.includes('project')) return 'ONE_TIME';
  return 'YEAR';
}

// Convert HTML to readable plain text
function htmlToPlainText(html: string): string {
  return html
    // Convert list items to bullet points
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/li>/gi, '')
    // Convert paragraphs and breaks to newlines
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<p[^>]*>/gi, '')
    // Convert headers to text with newlines
    .replace(/<h[1-6][^>]*>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    // Remove list wrappers
    .replace(/<\/?[uo]l[^>]*>/gi, '')
    // Decode common HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Strip remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Clean up multiple newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildDescription(job: LeverJob): string {
  let description = job.descriptionPlain || job.description || '';

  if (job.lists && job.lists.length > 0) {
    for (const list of job.lists) {
      const content = htmlToPlainText(list.content);
      description += `\n\n${list.text}\n${content}`;
    }
  }

  if (job.additionalPlain || job.additional) {
    const additional = job.additionalPlain || htmlToPlainText(job.additional || '');
    description += `\n\n${additional}`;
  }

  return description.trim();
}

function extractSkillsFromDescription(description: string, department?: string): string[] {
  const skills: Set<string> = new Set();

  // Common tech skills to look for
  const techSkills = [
    'JavaScript', 'TypeScript', 'Python', 'Java', 'Go', 'Golang', 'Rust', 'C++', 'C#',
    'React', 'Angular', 'Vue', 'Node.js', 'Next.js', 'Django', 'Rails', 'Spring',
    'AWS', 'GCP', 'Azure', 'Kubernetes', 'Docker', 'Terraform',
    'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch',
    'GraphQL', 'REST', 'API', 'Microservices',
    'Machine Learning', 'AI', 'Data Science', 'TensorFlow', 'PyTorch',
    'Figma', 'Sketch', 'Adobe XD',
    'Agile', 'Scrum', 'CI/CD', 'Git',
  ];

  const lowerDesc = description.toLowerCase();
  for (const skill of techSkills) {
    if (lowerDesc.includes(skill.toLowerCase())) {
      skills.add(skill);
    }
  }

  // Add department-based skills
  if (department) {
    const d = department.toLowerCase();
    if (d.includes('frontend')) skills.add('Frontend');
    if (d.includes('backend')) skills.add('Backend');
    if (d.includes('fullstack') || d.includes('full-stack')) skills.add('Full Stack');
    if (d.includes('mobile')) skills.add('Mobile');
    if (d.includes('devops') || d.includes('infrastructure')) skills.add('DevOps');
    if (d.includes('data')) skills.add('Data');
  }

  return Array.from(skills).slice(0, 10); // Max 10 skills
}
