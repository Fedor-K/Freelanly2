/**
 * ============================================================================
 * LEVER PROCESSOR
 * ============================================================================
 *
 * Импортирует вакансии из Lever ATS.
 *
 * ПРАВИЛО ФИЛЬТРАЦИИ (см. src/config/target-professions.ts):
 * - Импортируются ТОЛЬКО вакансии с title из whitelist профессий
 * - Тип локации (REMOTE/HYBRID/ONSITE) НЕ фильтруется — все импортируются
 * - Фильтрация по локации — на фронтенде
 *
 * ============================================================================
 */

import { prisma } from '@/lib/db';
import { slugify } from '@/lib/utils';
import { ensureSalaryData } from '@/lib/salary-estimation';
import { queueCompanyEnrichmentBySlug, queueCompanyEnrichmentByWebsite } from '@/services/company-enrichment';
import { cleanupOldJobs, cleanupOldParsingLogs, cleanupOrphanedCompanies } from '@/services/job-cleanup';
import { buildJobUrl, notifySearchEngines } from '@/lib/indexing';
import { extractJobData, getDeepSeekUsageStats, resetDeepSeekUsageStats } from '@/lib/deepseek';
import { addToSocialQueue } from '@/services/social-post';
import { isPhysicalLocation } from '@/lib/job-filter';
import { isBlockedCompany } from '@/config/company-blacklist';
import { LeverFilterPipeline, type FilteredJobData } from './filters';
import type { ProcessingStats, ProcessorContext, LeverJob } from './types';
import { getLeverRegion, getLeverJobsBaseUrl } from './types';

// Simple concurrency limiter for parallel job processing
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

/**
 * Save filtered jobs to database with error handling
 * Collected by pipeline, bulk inserted at the end
 */
async function saveFilteredJobs(
  importLogId: string,
  filteredJobs: FilteredJobData[]
): Promise<void> {
  if (filteredJobs.length === 0) return;

  try {
    await prisma.filteredJob.createMany({
      data: filteredJobs.map(fj => ({
        importLogId,
        title: fj.title,
        company: fj.company,
        location: fj.location,
        sourceUrl: fj.sourceUrl,
        reason: fj.reason,
      })),
    });
    console.log(`[Lever] Saved ${filteredJobs.length} filtered jobs to database`);
  } catch (error) {
    console.error(`[Lever] Failed to save filtered jobs:`, error);
    // Don't throw - filtered job logging is not critical for import
  }
}

// Fetch real company website from Lever job page footer
async function fetchCompanyWebsiteFromLever(companySlug: string, jobId: string, apiUrl?: string | null): Promise<string | null> {
  try {
    const region = getLeverRegion(apiUrl);
    const baseUrl = getLeverJobsBaseUrl(region);
    const jobPageUrl = `${baseUrl}/${companySlug}/${jobId}`;
    const response = await fetch(jobPageUrl);
    if (!response.ok) return null;

    const html = await response.text();

    // Look for "Company Home Page" link in footer
    const pattern = /href="(https?:\/\/[^"]+)"[^>]*>[^<]*Home\s*Page/i;
    const match = html.match(pattern);

    if (match && match[1]) {
      console.log(`[Lever] Found company website: ${match[1]}`);
      return match[1];
    }

    return null;
  } catch (error) {
    console.error(`[Lever] Failed to fetch company website:`, error);
    return null;
  }
}

export async function processLeverSource(context: ProcessorContext): Promise<ProcessingStats> {
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

  // Reset DeepSeek usage stats for this run
  resetDeepSeekUsageStats();

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

  // Check if company is blacklisted
  if (isBlockedCompany(dataSource.companySlug, dataSource.name)) {
    console.log(`[Lever] BLOCKED: ${dataSource.name} is in company blacklist`);
    return stats;
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

    // =========================================================================
    // FILTER PIPELINE
    // Centralized filtering: Age → Duplicate → Whitelist
    // All filtered jobs collected for bulk insert at the end
    // =========================================================================

    // Fetch existing job IDs for duplicate detection
    const existingJobs = await prisma.job.findMany({
      where: {
        OR: [
          { sourceId: { in: jobs.map(j => j.id) } },
          { sourceUrl: { in: jobs.map(j => j.hostedUrl) } },
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

    // Run filter pipeline
    const pipeline = new LeverFilterPipeline(dataSource.name);
    const pipelineResult = await pipeline.processLeverJobs(
      jobs,
      existingSourceIds,
      existingSourceUrls
    );

    // Update stats from pipeline
    stats.skipped = pipelineResult.stats.totalRejected;

    // Limit jobs per source to prevent timeout (e.g., jobgether has 1800+ jobs)
    const MAX_JOBS_PER_SOURCE = 300;
    let jobsToProcess = pipelineResult.originalJobs;
    if (jobsToProcess.length > MAX_JOBS_PER_SOURCE) {
      const excess = jobsToProcess.length - MAX_JOBS_PER_SOURCE;
      console.log(`[Lever] Limiting ${dataSource.name} from ${jobsToProcess.length} to ${MAX_JOBS_PER_SOURCE} jobs (skipping ${excess})`);
      // Take first N jobs (they're already sorted by date from API)
      jobsToProcess = jobsToProcess.slice(0, MAX_JOBS_PER_SOURCE);
      stats.skipped += excess;
    }

    // Early exit if nothing to process
    if (jobsToProcess.length === 0) {
      console.log(`[Lever] No new jobs to process for ${dataSource.name}`);

      // Save filtered jobs even on early exit
      await saveFilteredJobs(importLogId, pipelineResult.filteredJobs);

      // Update data source stats
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

    console.log(`[Lever] Processing ${jobsToProcess.length} jobs (${stats.skipped} filtered by pipeline)`);

    // NOW create company - only if we have jobs to process
    // Fetch real company website from Lever job page (use first job that passed filters)
    let companyWebsite: string | null = null;
    if (jobsToProcess.length > 0) {
      companyWebsite = await fetchCompanyWebsiteFromLever(dataSource.companySlug, jobsToProcess[0].id, dataSource.apiUrl);
    }
    const company = await findOrCreateCompany(dataSource.name, dataSource.companySlug, companyWebsite);

    // Batch duplicate check by title BEFORE AI calls (saves tokens)
    const existingTitles = await prisma.job.findMany({
      where: {
        companyId: company.id,
        title: { in: jobsToProcess.map(j => j.text) }
      },
      select: { title: true }
    });
    const existingTitleSet = new Set(existingTitles.map(j => j.title));
    const jobsAfterTitleCheck = jobsToProcess.filter(j => !existingTitleSet.has(j.text));
    const titleDuplicates = jobsToProcess.length - jobsAfterTitleCheck.length;
    if (titleDuplicates > 0) {
      console.log(`[Lever] Filtered ${titleDuplicates} duplicate titles (batch check)`);
      stats.skipped += titleDuplicates;
    }

    // Process NEW jobs in parallel with concurrency limit
    const CONCURRENCY = 15; // 15 parallel AI calls for faster processing
    const limit = createLimiter(CONCURRENCY);
    let processed = 0;
    let created = 0;
    let skippedInProcess = 0;
    const totalToProcess = jobsAfterTitleCheck.length;
    const startTime = Date.now();

    const companySlug = dataSource.companySlug!; // Already validated above
    const processJob = async (job: LeverJob, index: number) => {
      try {
        const result = await processLeverJob(
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
          // Add to social post queue
          if (result.jobId) {
            await addToSocialQueue(result.jobId);
            stats.createdJobIds!.push(result.jobId);
          }
        } else if (result.status === 'skipped') {
          stats.skipped++;
          skippedInProcess++;
        }

        // Progress log every job
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        const remaining = totalToProcess - processed;
        const avgTime = elapsed / processed;
        const eta = Math.round(remaining * avgTime);
        console.log(`[Lever] ${processed}/${totalToProcess} | +${created} created | ${skippedInProcess} skipped | ETA: ${eta}s | ${job.text.slice(0, 40)}...`);
      } catch (error) {
        stats.failed++;
        stats.errors.push(`Job ${job.id}: ${String(error)}`);
      }
    };

    await Promise.all(jobsAfterTitleCheck.map((job, i) => limit(() => processJob(job, i))));

    // Batch notify search engines (moved from per-job to end of import)
    if (stats.createdJobUrls && stats.createdJobUrls.length > 0) {
      console.log(`[Lever] Notifying search engines for ${stats.createdJobUrls.length} new jobs`);
      notifySearchEngines(stats.createdJobUrls).catch((err) => {
        console.error('[Lever] Search engine notification failed:', err);
      });
    }

    // Save filtered jobs collected by pipeline (bulk insert with error handling)
    await saveFilteredJobs(importLogId, pipelineResult.filteredJobs);

    // Update data source stats
    await prisma.dataSource.update({
      where: { id: dataSourceId },
      data: {
        lastRunAt: new Date(),
        lastSuccessAt: new Date(),
        totalImported: { increment: stats.created },
        lastCreated: stats.created,
        lastFetched: stats.total, // Track fetched count for conversion rate
        lastError: null,
        errorCount: 0,
      },
    });

    // Cleanup old jobs and orphaned companies after successful import
    await cleanupOldJobs();
    await cleanupOrphanedCompanies();
    await cleanupOldParsingLogs();

    // Log DeepSeek usage stats
    const aiStats = getDeepSeekUsageStats();
    if (aiStats.calls > 0) {
      console.log(`[Lever] DeepSeek usage: ${aiStats.calls} calls, ${aiStats.inputTokens} input tokens, ${aiStats.outputTokens} output tokens, estimated cost: $${aiStats.estimatedCostUSD.toFixed(4)}`);
    }

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
  companySlug: string,
  importLogId: string,
  companyName: string
): Promise<{ status: 'created' | 'skipped'; jobSlug?: string; jobId?: string }> {
  // NOTE: Duplicate check by title is now done in batch BEFORE this function
  // Race condition duplicates are still caught by unique constraint in catch block

  // Build full description (with RESPONSIBILITIES, QUALIFICATIONS, etc.)
  const fullDescription = buildDescription(job);

  // Process through DeepSeek AI for clean description
  console.log(`[Lever] Processing new job through AI: ${job.text}`);
  const aiData = await extractJobData(fullDescription);

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

  // Parse location (whitelist filter already applied in batch pre-processing)
  const location = job.categories.location || 'Remote';
  const locationType = mapWorkplaceType(job.workplaceType, location, aiData?.isRemote);
  const country = extractCountryCode(location);

  // Parse level from title or department
  const level = extractLevel(job.text);

  // Parse job type
  const jobType = mapCommitmentToType(job.categories.commitment);

  // Extract skills from tags/description
  const skills = extractSkillsFromDescription(fullDescription, job.categories.department);

  // Get actual or estimated salary data
  const actualSalary = job.salaryRange?.min ? {
    salaryMin: job.salaryRange.min,
    salaryMax: job.salaryRange.max,
    salaryCurrency: job.salaryRange.currency || 'USD',
    salaryPeriod: mapSalaryInterval(job.salaryRange.interval),
    salaryIsEstimate: false,
  } : ensureSalaryData({ salaryMin: null }, category.slug, level, country);

  // Create job with AI-enhanced description
  // Handle race condition: parallel jobs with same title may pass the check above
  try {
    const createdJob = await prisma.job.create({
      data: {
        slug,
        title: job.text,
        description: fullDescription,
        cleanDescription: aiData?.cleanDescription || null,
        summaryBullets: aiData?.summaryBullets || [],
        requirementBullets: aiData?.requirementBullets || [],
        benefitBullets: aiData?.benefitBullets || [],
        companyId,
        categoryId: category.id,
        location,
        locationType,
        country,
        level,
        type: jobType,
        ...actualSalary,
        skills,
        benefits: aiData?.benefits || [],
        source: 'LEVER',
        sourceType: 'STRUCTURED',
        sourceUrl: job.hostedUrl,
        sourceId: job.id,
        applyUrl: job.applyUrl,
        enrichmentStatus: 'COMPLETED',
        qualityScore: 80, // ATS + AI enhanced = higher quality
        postedAt: new Date(job.createdAt),
      },
    });

    // NOTE: Search engine notification moved to batch at end of import

    return { status: 'created', jobSlug: slug, jobId: createdJob.id };
  } catch (error: unknown) {
    // Handle unique constraint violation (race condition with parallel processing)
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      console.log(`[Lever] Skipping duplicate (race condition): ${job.text}`);
      return { status: 'skipped' };
    }
    throw error;
  }
}

async function findOrCreateCompany(name: string, slug: string, leverWebsite: string | null) {
  // Use real website from Lever page, or fallback to slug-based guess
  const website = leverWebsite || `https://${slug.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;

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
        website, // Set website from Lever page for Logo.dev fallback
        atsType: 'LEVER',
        atsId: slug,
        verified: true,
      },
    });

    // Queue automatic enrichment for new company using real website domain
    if (leverWebsite) {
      queueCompanyEnrichmentByWebsite(company.id, leverWebsite);
    } else {
      queueCompanyEnrichmentBySlug(company.id, uniqueSlug);
    }
  } else {
    // Update website if missing or if we have a better one from Lever
    if (leverWebsite && (!company.website || company.website.includes('.com') && !leverWebsite.includes('.com'))) {
      await prisma.company.update({
        where: { id: company.id },
        data: { website },
      });
      company.website = website;
    }
    // Also enrich existing companies that haven't been enriched yet
    if (company.apolloEnrichedAt === null) {
      if (leverWebsite) {
        queueCompanyEnrichmentByWebsite(company.id, leverWebsite);
      } else {
        queueCompanyEnrichmentBySlug(company.id, company.slug);
      }
    }
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

  // PRIORITY: Check title for engineer/developer FIRST (overrides department)
  if (t.includes('engineer') || t.includes('developer') || t.includes('programmer')) return 'engineering';

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

  // Healthcare/Health Plan → operations (not engineering!)
  if (combined.includes('health') || combined.includes('medical') || combined.includes('clinical') || combined.includes('pharmacy')) return 'operations';

  // Performance/Manager without specific category → operations
  if (combined.includes('performance') || combined.includes('manager')) return 'operations';

  // Default: support (NOT engineering - that was causing misclassification)
  return 'support';
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

function mapWorkplaceType(workplaceType?: string, location?: string, aiIsRemote?: boolean): 'REMOTE' | 'REMOTE_US' | 'REMOTE_EU' | 'REMOTE_COUNTRY' | 'HYBRID' | 'ONSITE' {
  // Lever API provides explicit workplaceType - trust it first
  if (workplaceType === 'onsite') return 'ONSITE';
  if (workplaceType === 'hybrid') return 'HYBRID';

  // Remote from Lever API - check for regional restrictions
  if (workplaceType === 'remote') {
    const loc = location?.toLowerCase() || '';
    if (loc.includes('us only') || loc.includes('usa only') || loc.includes('united states only')) return 'REMOTE_US';
    if (loc.includes('eu only') || loc.includes('europe only') || loc.includes('emea only')) return 'REMOTE_EU';
    return 'REMOTE';
  }

  const loc = location?.toLowerCase() || '';

  // Check if location explicitly mentions remote/hybrid
  if (loc.includes('remote') || loc.includes('work from home') || loc.includes('wfh')) {
    if (loc.includes('us only') || loc.includes('usa only') || loc.includes('united states only')) return 'REMOTE_US';
    if (loc.includes('eu only') || loc.includes('europe only') || loc.includes('emea only')) return 'REMOTE_EU';
    return 'REMOTE';
  }
  if (loc.includes('hybrid')) return 'HYBRID';

  // No explicit remote indicator - check if it looks like a physical location
  // Pattern: "City, ST" or "City, State" or "City, Country" = likely onsite
  if (isPhysicalLocation(location || '')) {
    console.log(`[Lever] Location "${location}" looks like physical address, treating as ONSITE`);
    return 'ONSITE';
  }

  // Fall back to AI detection only if location is ambiguous
  if (aiIsRemote === true) {
    return 'REMOTE';
  }

  // Default to ONSITE (will be filtered out) - better safe than polluting with non-remote jobs
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

  // Common tech skills to look for (with word boundary matching)
  // Short words like Go, AI, API need exact word matching to avoid false positives
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

  // Short ambiguous skills that need word boundary matching
  const shortSkills = ['Go', 'AI', 'API', 'ML', 'NLP'];

  const lowerDesc = description.toLowerCase();

  // Match longer skills with simple includes
  for (const skill of techSkills) {
    if (lowerDesc.includes(skill.toLowerCase())) {
      skills.add(skill);
    }
  }

  // Match short skills with word boundaries to avoid false positives
  // "Go" should not match "going", "AI" should not match "training"
  for (const skill of shortSkills) {
    const regex = new RegExp(`\\b${skill}\\b`, 'i');
    if (regex.test(description)) {
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
