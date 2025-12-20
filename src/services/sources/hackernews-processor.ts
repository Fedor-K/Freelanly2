import { prisma } from '@/lib/db';
import { slugify, isFreeEmail } from '@/lib/utils';
import { extractJobData, classifyJobCategory } from '@/lib/deepseek';
import { queueCompanyEnrichment } from '@/services/company-enrichment';
import type { ProcessingStats } from './types';

// HN Algolia API for searching "Who is Hiring" threads
const HN_ALGOLIA_API = 'https://hn.algolia.com/api/v1/search_by_date';

interface HNComment {
  objectID: string;
  comment_text: string;
  author: string;
  created_at: string;
  parent_id: number;
  story_id: number;
}

export async function processHackerNewsSource(dataSourceId: string): Promise<ProcessingStats> {
  const stats: ProcessingStats = {
    total: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  const dataSource = await prisma.dataSource.findUnique({
    where: { id: dataSourceId },
  });

  if (!dataSource || dataSource.sourceType !== 'HACKERNEWS') {
    throw new Error('Invalid HackerNews data source');
  }

  try {
    // Get latest "Who is Hiring" thread ID or use configured one
    const config = dataSource.config as { storyId?: number } | null;
    const storyId = config?.storyId || await getLatestWhoIsHiringThread();

    if (!storyId) {
      throw new Error('Could not find Who is Hiring thread');
    }

    console.log(`[HN] Fetching comments from story: ${storyId}`);

    // Fetch comments from the thread
    const comments = await fetchThreadComments(storyId);
    stats.total = comments.length;
    console.log(`[HN] Found ${comments.length} comments`);

    // Process each comment (they are job postings)
    let processed = 0;
    for (const comment of comments) {
      try {
        // Skip if too short
        if (!comment.comment_text || comment.comment_text.length < 50) {
          stats.skipped++;
          continue;
        }

        const result = await processHNComment(comment, storyId);
        if (result === 'created') stats.created++;
        else if (result === 'skipped') stats.skipped++;

        processed++;
        // Rate limit for DeepSeek API
        if (processed % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        stats.failed++;
        stats.errors.push(`Comment ${comment.objectID}: ${String(error)}`);
      }
    }

    await prisma.dataSource.update({
      where: { id: dataSourceId },
      data: {
        lastRunAt: new Date(),
        lastSuccessAt: new Date(),
        totalImported: { increment: stats.created },
        lastError: null,
        errorCount: 0,
        config: { storyId }, // Store the thread ID
      },
    });

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

async function getLatestWhoIsHiringThread(): Promise<number | null> {
  // Search for latest "Ask HN: Who is hiring?" thread
  const url = `${HN_ALGOLIA_API}?query="Ask HN: Who is hiring?"&tags=story&hitsPerPage=1`;

  const response = await fetch(url);
  if (!response.ok) return null;

  const data = await response.json();
  if (data.hits && data.hits.length > 0) {
    return parseInt(data.hits[0].objectID, 10);
  }

  return null;
}

async function fetchThreadComments(storyId: number): Promise<HNComment[]> {
  const allComments: HNComment[] = [];
  let page = 0;
  const hitsPerPage = 100;

  while (true) {
    const url = `${HN_ALGOLIA_API}?tags=comment,story_${storyId}&hitsPerPage=${hitsPerPage}&page=${page}`;
    const response = await fetch(url);

    if (!response.ok) break;

    const data = await response.json();
    if (!data.hits || data.hits.length === 0) break;

    // Only get top-level comments (direct replies to the thread)
    const topLevelComments = data.hits.filter((c: HNComment) => c.parent_id === storyId);
    allComments.push(...topLevelComments);

    // Stop if we got less than a full page
    if (data.hits.length < hitsPerPage) break;

    page++;
    // Safety limit
    if (page > 10) break;
  }

  return allComments;
}

async function processHNComment(comment: HNComment, storyId: number): Promise<'created' | 'skipped'> {
  const sourceId = `hn-${comment.objectID}`;
  const sourceUrl = `https://news.ycombinator.com/item?id=${comment.objectID}`;

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
    return 'skipped';
  }

  // Parse the comment text to extract job info
  const text = decodeHtml(comment.comment_text);

  // Check for corporate email early - skip if no corporate email
  const email = extractEmail(text);
  if (!email || isFreeEmail(email)) {
    return 'skipped'; // No corporate email
  }

  // HN job posts usually start with "Company Name | Location | Role"
  const parsedHeader = parseHNJobHeader(text);

  // Use DeepSeek for extraction if header parsing failed
  let extracted;
  if (!parsedHeader.company || !parsedHeader.title) {
    extracted = await extractJobData(text);
    if (!extracted || !extracted.title) {
      return 'skipped'; // Can't extract job info
    }
  }

  const companyName = parsedHeader.company || extracted?.company || comment.author;
  const jobTitle = parsedHeader.title || extracted?.title || 'Software Engineer';
  const location = parsedHeader.location || extracted?.location || 'Remote';

  // Find or create company
  const company = await findOrCreateCompany(companyName);

  // Get category
  const categorySlug = await classifyJobCategory(jobTitle, extracted?.skills || []);
  let category = await prisma.category.findUnique({ where: { slug: categorySlug } });
  if (!category) {
    category = await prisma.category.create({
      data: { slug: categorySlug, name: getCategoryName(categorySlug) },
    });
  }

  // Generate slug
  const baseSlug = slugify(`${jobTitle}-${companyName}`);
  const slug = await generateUniqueJobSlug(baseSlug);

  // Determine remote status
  const isRemote = location.toLowerCase().includes('remote') ||
    text.toLowerCase().includes('remote') ||
    parsedHeader.isRemote;

  // Extract level
  const level = extractLevel(jobTitle);

  // Create job (email already extracted and validated above)
  await prisma.job.create({
    data: {
      slug,
      title: jobTitle,
      description: text,
      companyId: company.id,
      categoryId: category.id,
      location: isRemote ? 'Remote' : location,
      locationType: isRemote ? 'REMOTE' : 'ONSITE',
      country: extractCountryCode(location),
      level,
      type: 'FULL_TIME',
      salaryMin: extracted?.salaryMin || parsedHeader.salaryMin,
      salaryMax: extracted?.salaryMax || parsedHeader.salaryMax,
      salaryCurrency: 'USD',
      salaryIsEstimate: false,
      skills: extracted?.skills || extractSkillsFromText(text),
      benefits: extracted?.benefits || [],
      source: 'HACKERNEWS',
      sourceType: 'UNSTRUCTURED',
      sourceUrl,
      sourceId,
      originalContent: text,
      authorName: comment.author,
      applyUrl: extractApplyUrl(text) || sourceUrl,
      applyEmail: email,
      enrichmentStatus: 'COMPLETED',
      qualityScore: 60,
      postedAt: new Date(comment.created_at),
    },
  });

  // Queue company for background enrichment if corporate email
  if (email) {
    queueCompanyEnrichment(company.id, email);
  }

  return 'created';
}

function parseHNJobHeader(text: string): {
  company: string | null;
  location: string | null;
  title: string | null;
  isRemote: boolean;
  salaryMin: number | null;
  salaryMax: number | null;
} {
  const result = {
    company: null as string | null,
    location: null as string | null,
    title: null as string | null,
    isRemote: false,
    salaryMin: null as number | null,
    salaryMax: null as number | null,
  };

  // First line usually contains: Company | Location | Title | Remote | Salary
  const firstLine = text.split('\n')[0];
  const parts = firstLine.split('|').map(p => p.trim());

  if (parts.length >= 1) result.company = parts[0];
  if (parts.length >= 2) result.location = parts[1];
  if (parts.length >= 3) result.title = parts[2];

  // Check for remote
  result.isRemote = parts.some(p =>
    p.toLowerCase().includes('remote') ||
    p.toLowerCase().includes('onsite/remote')
  );

  // Try to extract salary from any part
  for (const part of parts) {
    const salaryMatch = part.match(/\$?([\d,]+)k?\s*[-–]\s*\$?([\d,]+)k?/i);
    if (salaryMatch) {
      let min = parseInt(salaryMatch[1].replace(/,/g, ''), 10);
      let max = parseInt(salaryMatch[2].replace(/,/g, ''), 10);
      // Handle "k" notation
      if (min < 1000) min *= 1000;
      if (max < 1000) max *= 1000;
      result.salaryMin = min;
      result.salaryMax = max;
      break;
    }
  }

  return result;
}

function decodeHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '\n')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n+/g, '\n')
    .trim();
}

async function findOrCreateCompany(name: string) {
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
  if (t.includes('entry') || t.includes('new grad')) return 'ENTRY';
  if (t.includes('junior') || t.includes('jr')) return 'JUNIOR';
  if (t.includes('senior') || t.includes('sr')) return 'SENIOR';
  if (t.includes('staff') || t.includes('principal')) return 'LEAD';
  if (t.includes('lead')) return 'LEAD';
  if (t.includes('manager')) return 'MANAGER';
  if (t.includes('director')) return 'DIRECTOR';
  if (t.includes('vp') || t.includes('head') || t.includes('chief')) return 'EXECUTIVE';
  return 'MID';
}

function extractCountryCode(location: string): string | null {
  const countryMap: Record<string, string> = {
    'usa': 'US', 'united states': 'US', 'us': 'US', 'san francisco': 'US', 'new york': 'US', 'sf': 'US', 'nyc': 'US',
    'uk': 'GB', 'united kingdom': 'GB', 'london': 'GB',
    'canada': 'CA', 'toronto': 'CA', 'vancouver': 'CA',
    'germany': 'DE', 'berlin': 'DE', 'munich': 'DE',
    'france': 'FR', 'paris': 'FR',
    'netherlands': 'NL', 'amsterdam': 'NL',
    'australia': 'AU', 'sydney': 'AU', 'melbourne': 'AU',
  };

  const loc = location.toLowerCase();
  for (const [key, code] of Object.entries(countryMap)) {
    if (loc.includes(key)) return code;
  }
  return null;
}

function extractSkillsFromText(text: string): string[] {
  const skills: Set<string> = new Set();

  const techSkills = [
    'JavaScript', 'TypeScript', 'Python', 'Ruby', 'Go', 'Rust', 'Java', 'C++', 'C#', 'PHP',
    'React', 'Vue', 'Angular', 'Svelte', 'Node.js', 'Rails', 'Django', 'Flask', 'Spring',
    'AWS', 'GCP', 'Azure', 'Kubernetes', 'Docker', 'Terraform',
    'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch',
    'GraphQL', 'REST', 'gRPC',
    'Machine Learning', 'AI', 'TensorFlow', 'PyTorch',
  ];

  const lowerText = text.toLowerCase();
  for (const skill of techSkills) {
    if (lowerText.includes(skill.toLowerCase())) {
      skills.add(skill);
    }
  }

  return Array.from(skills).slice(0, 10);
}

function extractApplyUrl(text: string): string | null {
  // Look for URLs in the text
  const urlMatch = text.match(/https?:\/\/[^\s<>"]+/i);
  if (urlMatch) return urlMatch[0];
  return null;
}

function extractEmail(text: string): string | null {
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) return emailMatch[0];
  return null;
}
