import { prisma } from '@/lib/db';
import { slugify } from '@/lib/utils';
import { cleanupOldJobs } from '@/services/job-cleanup';
import { buildJobUrl } from '@/lib/indexing';
import type { ProcessingStats, RemoteOKJob } from './types';

const REMOTEOK_API = 'https://remoteok.com/api';

export async function processRemoteOKSource(dataSourceId: string): Promise<ProcessingStats> {
  const stats: ProcessingStats = {
    total: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    createdJobUrls: [],
  };

  const dataSource = await prisma.dataSource.findUnique({
    where: { id: dataSourceId },
  });

  if (!dataSource || dataSource.sourceType !== 'REMOTEOK') {
    throw new Error('Invalid RemoteOK data source');
  }

  const apiUrl = dataSource.apiUrl || REMOTEOK_API;

  try {
    console.log(`[RemoteOK] Fetching jobs from: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Freelanly/1.0 (https://freelanly.com)',
      },
    });

    if (!response.ok) {
      throw new Error(`RemoteOK API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    // First item is legal notice, rest are jobs
    const jobs: RemoteOKJob[] = Array.isArray(data) ? data.slice(1) : [];
    stats.total = jobs.length;
    console.log(`[RemoteOK] Found ${jobs.length} jobs`);

    for (const job of jobs) {
      try {
        // Skip if no essential data
        if (!job.position || !job.company) {
          stats.skipped++;
          continue;
        }

        const result = await processRemoteOKJob(job);
        if (result.status === 'created') {
          stats.created++;
          if (result.companySlug && result.jobSlug) {
            stats.createdJobUrls!.push(buildJobUrl(result.companySlug, result.jobSlug));
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

async function processRemoteOKJob(job: RemoteOKJob): Promise<{ status: 'created' | 'updated' | 'skipped'; companySlug?: string; jobSlug?: string }> {
  const sourceId = `remoteok-${job.id}`;
  const sourceUrl = job.url || `https://remoteok.com/remote-jobs/${job.slug}`;

  // Check if exists
  const existingJob = await prisma.job.findFirst({
    where: {
      OR: [
        { sourceId },
        { sourceUrl },
      ],
    },
  });

  if (existingJob) {
    return { status: 'skipped' }; // RemoteOK doesn't provide update timestamps
  }

  // Find or create company
  const company = await findOrCreateCompany(job.company, job.company_logo);

  // Get category from tags
  const categorySlug = mapTagsToCategory(job.tags);
  let category = await prisma.category.findUnique({ where: { slug: categorySlug } });
  if (!category) {
    category = await prisma.category.create({
      data: { slug: categorySlug, name: getCategoryName(categorySlug) },
    });
  }

  // Generate slug
  const baseSlug = slugify(`${job.position}-${job.company}`);
  const slug = await generateUniqueJobSlug(baseSlug);

  // Parse level from title
  const level = extractLevel(job.position);

  // Create job
  await prisma.job.create({
    data: {
      slug,
      title: job.position,
      description: job.description || `${job.position} at ${job.company}. Remote position.`,
      companyId: company.id,
      categoryId: category.id,
      location: job.location || 'Worldwide',
      locationType: 'REMOTE',
      country: extractCountryCode(job.location),
      level,
      type: 'FULL_TIME',
      salaryMin: job.salary_min,
      salaryMax: job.salary_max,
      salaryCurrency: 'USD',
      salaryIsEstimate: false,
      skills: job.tags || [],
      benefits: [],
      source: 'REMOTEOK',
      sourceType: 'STRUCTURED',
      sourceUrl,
      sourceId,
      applyUrl: job.apply_url || sourceUrl,
      enrichmentStatus: 'COMPLETED',
      qualityScore: 65,
      postedAt: new Date(job.date),
    },
  });

  return { status: 'created', companySlug: company.slug, jobSlug: slug };
}

async function findOrCreateCompany(name: string, logo?: string) {
  const slug = slugify(name);

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
        logo,
        verified: false,
      },
    });
  }

  return company;
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

function mapTagsToCategory(tags: string[]): string {
  if (!tags || tags.length === 0) return 'engineering';

  const tagStr = tags.join(' ').toLowerCase();

  if (tagStr.includes('frontend') || tagStr.includes('react') || tagStr.includes('vue') || tagStr.includes('angular')) return 'engineering';
  if (tagStr.includes('backend') || tagStr.includes('api') || tagStr.includes('database')) return 'engineering';
  if (tagStr.includes('devops') || tagStr.includes('sre') || tagStr.includes('infrastructure')) return 'devops';
  if (tagStr.includes('design') || tagStr.includes('ui') || tagStr.includes('ux')) return 'design';
  if (tagStr.includes('product') && !tagStr.includes('market')) return 'product';
  if (tagStr.includes('market') || tagStr.includes('seo') || tagStr.includes('growth')) return 'marketing';
  if (tagStr.includes('sales') || tagStr.includes('account exec')) return 'sales';
  if (tagStr.includes('data') || tagStr.includes('analytics') || tagStr.includes('machine learning')) return 'data';
  if (tagStr.includes('support') || tagStr.includes('customer')) return 'support';
  if (tagStr.includes('hr') || tagStr.includes('recruit')) return 'hr';

  return 'engineering';
}

function getCategoryName(slug: string): string {
  const names: Record<string, string> = {
    engineering: 'Engineering',
    design: 'Design',
    product: 'Product',
    marketing: 'Marketing',
    sales: 'Sales',
    data: 'Data',
    devops: 'DevOps',
    support: 'Support',
    hr: 'HR',
    finance: 'Finance',
  };
  return names[slug] || slug;
}

function extractLevel(title: string): 'INTERN' | 'ENTRY' | 'JUNIOR' | 'MID' | 'SENIOR' | 'LEAD' | 'MANAGER' | 'DIRECTOR' | 'EXECUTIVE' {
  const t = title.toLowerCase();
  if (t.includes('intern')) return 'INTERN';
  if (t.includes('entry') || t.includes('graduate')) return 'ENTRY';
  if (t.includes('junior') || t.includes('jr')) return 'JUNIOR';
  if (t.includes('senior') || t.includes('sr')) return 'SENIOR';
  if (t.includes('staff') || t.includes('principal')) return 'LEAD';
  if (t.includes('lead')) return 'LEAD';
  if (t.includes('manager') && !t.includes('product manager')) return 'MANAGER';
  if (t.includes('director')) return 'DIRECTOR';
  if (t.includes('vp') || t.includes('head of') || t.includes('chief')) return 'EXECUTIVE';
  return 'MID';
}

function extractCountryCode(location?: string): string | null {
  if (!location) return null;

  const loc = location.toLowerCase();
  if (loc.includes('worldwide') || loc === 'remote') return null;

  const countryMap: Record<string, string> = {
    'usa': 'US', 'united states': 'US', 'us': 'US',
    'uk': 'GB', 'united kingdom': 'GB',
    'canada': 'CA',
    'germany': 'DE',
    'france': 'FR',
    'netherlands': 'NL',
    'australia': 'AU',
    'india': 'IN',
  };

  for (const [key, code] of Object.entries(countryMap)) {
    if (loc.includes(key)) return code;
  }
  return null;
}
