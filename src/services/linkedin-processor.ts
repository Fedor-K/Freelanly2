import { db } from '@/lib/db';
import { scrapeLinkedInHiringPosts, scrapeLinkedInCompany, type LinkedInPost } from '@/lib/apify';
import { extractJobData, classifyJobCategory, type ExtractedJobData } from '@/lib/deepseek';
import { slugify } from '@/lib/utils';

interface ProcessedJob {
  success: boolean;
  jobId?: string;
  error?: string;
}

interface ProcessingStats {
  total: number;
  processed: number;
  created: number;
  skipped: number;
  failed: number;
  errors: string[];
}

// Fetch and process LinkedIn hiring posts
export async function fetchAndProcessLinkedInPosts(options: {
  keywords?: string[];
  maxPosts?: number;
}): Promise<ProcessingStats> {
  const stats: ProcessingStats = {
    total: 0,
    processed: 0,
    created: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  // Create import log
  const importLog = await db.importLog.create({
    data: {
      source: 'LINKEDIN',
      status: 'RUNNING',
    },
  });

  try {
    // 1. Scrape LinkedIn posts
    console.log('Fetching LinkedIn posts...');
    const posts = await scrapeLinkedInHiringPosts(options);
    stats.total = posts.length;
    console.log(`Fetched ${posts.length} posts`);

    // 2. Process each post
    for (const post of posts) {
      try {
        const result = await processLinkedInPost(post);
        stats.processed++;

        if (result.success && result.jobId) {
          stats.created++;
        } else if (result.error === 'duplicate') {
          stats.skipped++;
        } else {
          stats.failed++;
          stats.errors.push(result.error || 'Unknown error');
        }
      } catch (error) {
        stats.failed++;
        stats.errors.push(String(error));
      }
    }

    // Update import log
    await db.importLog.update({
      where: { id: importLog.id },
      data: {
        status: 'COMPLETED',
        totalFetched: stats.total,
        totalNew: stats.created,
        totalSkipped: stats.skipped,
        totalFailed: stats.failed,
        errors: stats.errors.length > 0 ? stats.errors : undefined,
        completedAt: new Date(),
      },
    });

    return stats;
  } catch (error) {
    // Update import log with error
    await db.importLog.update({
      where: { id: importLog.id },
      data: {
        status: 'FAILED',
        errors: [String(error)],
        completedAt: new Date(),
      },
    });

    throw error;
  }
}

// Process a single LinkedIn post
async function processLinkedInPost(post: LinkedInPost): Promise<ProcessedJob> {
  // Check if already exists
  const existingJob = await db.job.findFirst({
    where: {
      OR: [
        { sourceId: post.id },
        { sourceUrl: post.url },
      ],
    },
  });

  if (existingJob) {
    return { success: false, error: 'duplicate' };
  }

  // Extract job data using DeepSeek
  console.log(`Extracting data from post: ${post.text.slice(0, 50)}...`);
  const extracted = await extractJobData(post.text);

  if (!extracted || !extracted.title) {
    return { success: false, error: 'Could not extract job title' };
  }

  // Find or create company
  const company = await findOrCreateCompany({
    name: extracted.company || post.companyName || post.authorName,
    linkedinUrl: post.companyUrl || post.authorUrl,
  });

  // Classify category
  const categorySlug = await classifyJobCategory(extracted.title, extracted.skills);
  const category = await db.category.findUnique({ where: { slug: categorySlug } });

  if (!category) {
    return { success: false, error: `Category not found: ${categorySlug}` };
  }

  // Generate unique slug
  const baseSlug = slugify(`${extracted.title}-${company.name}`);
  const slug = await generateUniqueSlug(baseSlug);

  // Map location type
  const locationType = mapLocationType(extracted.isRemote, extracted.location);

  // Create job
  const job = await db.job.create({
    data: {
      slug,
      title: extracted.title,
      description: post.text, // Original post as description
      companyId: company.id,
      categoryId: category.id,
      location: extracted.isRemote ? 'Remote' : extracted.location,
      locationType,
      level: extracted.level || 'MID',
      type: extracted.type || 'FULL_TIME',
      salaryMin: extracted.salaryMin,
      salaryMax: extracted.salaryMax,
      salaryCurrency: extracted.salaryCurrency || 'USD',
      salaryIsEstimate: !extracted.salaryMin, // If no salary stated, we'll estimate later
      skills: extracted.skills,
      benefits: extracted.benefits,
      source: 'LINKEDIN',
      sourceType: 'UNSTRUCTURED',
      sourceUrl: post.url,
      sourceId: post.id,
      originalContent: post.text,
      authorLinkedIn: post.authorUrl,
      authorName: post.authorName,
      applyEmail: extracted.contactEmail,
      applyUrl: extracted.applyUrl,
      enrichmentStatus: 'COMPLETED',
      qualityScore: calculateQualityScore(extracted, post),
      postedAt: new Date(post.postedAt),
    },
  });

  return { success: true, jobId: job.id };
}

// Find or create company
async function findOrCreateCompany(data: {
  name: string;
  linkedinUrl?: string | null;
}) {
  const slug = slugify(data.name);

  // Try to find existing company
  let company = await db.company.findFirst({
    where: {
      OR: [
        { slug },
        { linkedinUrl: data.linkedinUrl || undefined },
        { name: { equals: data.name, mode: 'insensitive' } },
      ],
    },
  });

  if (company) {
    return company;
  }

  // Try to enrich from LinkedIn
  let enrichedData = null;
  if (data.linkedinUrl) {
    try {
      enrichedData = await scrapeLinkedInCompany(data.linkedinUrl);
    } catch (error) {
      console.error('Company enrichment failed:', error);
    }
  }

  // Create new company
  company = await db.company.create({
    data: {
      slug: await generateUniqueSlug(slug, 'company'),
      name: enrichedData?.name || data.name,
      linkedinUrl: data.linkedinUrl,
      logo: enrichedData?.logo,
      website: enrichedData?.website,
      industry: enrichedData?.industry,
      description: enrichedData?.description,
      size: mapCompanySize(enrichedData?.size),
      foundedYear: enrichedData?.foundedYear,
      verified: false,
    },
  });

  return company;
}

// Generate unique slug
async function generateUniqueSlug(base: string, type: 'job' | 'company' = 'job'): Promise<string> {
  let slug = base;
  let counter = 1;

  while (true) {
    const exists = type === 'job'
      ? await db.job.findUnique({ where: { slug } })
      : await db.company.findUnique({ where: { slug } });

    if (!exists) return slug;

    slug = `${base}-${counter}`;
    counter++;
  }
}

// Map location type
function mapLocationType(isRemote: boolean, location: string | null): 'REMOTE' | 'REMOTE_US' | 'REMOTE_EU' | 'REMOTE_COUNTRY' | 'HYBRID' | 'ONSITE' {
  if (!isRemote) return 'ONSITE';

  const loc = location?.toLowerCase() || '';
  if (loc.includes('us') || loc.includes('usa') || loc.includes('united states')) return 'REMOTE_US';
  if (loc.includes('eu') || loc.includes('europe')) return 'REMOTE_EU';
  if (location && location !== 'Remote') return 'REMOTE_COUNTRY';

  return 'REMOTE';
}

// Map company size
function mapCompanySize(size: string | null | undefined): 'STARTUP' | 'SMALL' | 'MEDIUM' | 'LARGE' | 'ENTERPRISE' | null {
  if (!size) return null;

  const s = size.toLowerCase();
  if (s.includes('1-10') || s.includes('1-50')) return 'STARTUP';
  if (s.includes('11-50') || s.includes('51-200')) return 'SMALL';
  if (s.includes('201-500') || s.includes('501-1000')) return 'MEDIUM';
  if (s.includes('1001-5000') || s.includes('5001-10000')) return 'LARGE';
  if (s.includes('10000') || s.includes('10,000')) return 'ENTERPRISE';

  return null;
}

// Calculate quality score
function calculateQualityScore(extracted: ExtractedJobData, post: LinkedInPost): number {
  let score = 50; // Base score

  // Content quality
  if (extracted.title) score += 10;
  if (extracted.company) score += 5;
  if (extracted.salaryMin || extracted.salaryMax) score += 15;
  if (extracted.skills.length > 0) score += 5;
  if (extracted.skills.length > 3) score += 5;
  if (extracted.benefits.length > 0) score += 5;
  if (extracted.contactEmail || extracted.applyUrl) score += 5;

  // Engagement (indicates relevance)
  if (post.likes > 10) score += 2;
  if (post.likes > 50) score += 3;
  if (post.comments > 5) score += 2;

  // Penalties
  if (!extracted.level) score -= 5;
  if (!extracted.isRemote && !extracted.location) score -= 10;

  return Math.max(0, Math.min(100, score));
}

export { processLinkedInPost };
