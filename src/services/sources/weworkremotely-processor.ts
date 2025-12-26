import { prisma } from '@/lib/db';
import { slugify } from '@/lib/utils';
import { cleanupOldJobs } from '@/services/job-cleanup';
import { buildJobUrl } from '@/lib/indexing';
import { addToSocialQueue } from '@/services/social-post';
import type { ProcessingStats } from './types';

const WWR_RSS_URL = 'https://weworkremotely.com/remote-jobs.rss';

interface WWRItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  guid: string;
  category?: string;
}

export async function processWeWorkRemotelySource(dataSourceId: string): Promise<ProcessingStats> {
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

  if (!dataSource || dataSource.sourceType !== 'WEWORKREMOTELY') {
    throw new Error('Invalid WeWorkRemotely data source');
  }

  const feedUrl = dataSource.apiUrl || WWR_RSS_URL;

  try {
    console.log(`[WWR] Fetching RSS from: ${feedUrl}`);

    const response = await fetch(feedUrl);
    if (!response.ok) {
      throw new Error(`WWR RSS error: ${response.status} ${response.statusText}`);
    }

    const xml = await response.text();
    const jobs = parseRSS(xml);
    stats.total = jobs.length;
    console.log(`[WWR] Found ${jobs.length} jobs`);

    for (const job of jobs) {
      try {
        const result = await processWWRJob(job);
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
        stats.errors.push(`Job ${job.guid}: ${String(error)}`);
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

function parseRSS(xml: string): WWRItem[] {
  const items: WWRItem[] = [];

  // Simple XML parsing for RSS items
  const itemMatches = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];

  for (const itemXml of itemMatches) {
    const title = extractTag(itemXml, 'title') || '';
    const link = extractTag(itemXml, 'link') || '';
    const pubDate = extractTag(itemXml, 'pubDate') || '';
    const description = extractTag(itemXml, 'description') || '';
    const guid = extractTag(itemXml, 'guid') || link;
    const category = extractTag(itemXml, 'category');

    if (title && link) {
      items.push({ title, link, pubDate, description, guid, category });
    }
  }

  return items;
}

function extractTag(xml: string, tag: string): string | undefined {
  // Handle CDATA
  const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i');
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1].trim();

  // Handle regular content
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? decodeHtmlEntities(match[1].trim()) : undefined;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

async function processWWRJob(item: WWRItem): Promise<{ status: 'created' | 'updated' | 'skipped'; companySlug?: string; jobSlug?: string }> {
  const sourceUrl = item.link;
  const sourceId = `wwr-${item.guid}`;

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
    return { status: 'skipped' };
  }

  // Parse title format: "Company: Job Title"
  const { companyName, jobTitle } = parseTitleFormat(item.title);

  if (!companyName || !jobTitle) {
    throw new Error('Could not parse job title');
  }

  // Find or create company
  const company = await findOrCreateCompany(companyName);

  // Get category
  const categorySlug = mapCategoryToSlug(item.category);
  let category = await prisma.category.findUnique({ where: { slug: categorySlug } });
  if (!category) {
    category = await prisma.category.create({
      data: { slug: categorySlug, name: getCategoryName(categorySlug) },
    });
  }

  // Generate slug
  const baseSlug = slugify(`${jobTitle}-${companyName}`);
  const slug = await generateUniqueJobSlug(baseSlug);

  // Parse description (HTML)
  const description = stripHtml(item.description);

  // Extract level
  const level = extractLevel(jobTitle);

  // Create job
  const createdJob = await prisma.job.create({
    data: {
      slug,
      title: jobTitle,
      description: description || `${jobTitle} at ${companyName}`,
      companyId: company.id,
      categoryId: category.id,
      location: 'Remote',
      locationType: 'REMOTE',
      country: null,
      level,
      type: 'FULL_TIME',
      skills: extractSkillsFromDescription(description, item.category),
      benefits: [],
      source: 'WEWORKREMOTELY',
      sourceType: 'STRUCTURED',
      sourceUrl,
      sourceId,
      applyUrl: sourceUrl,
      enrichmentStatus: 'COMPLETED',
      qualityScore: 70,
      postedAt: new Date(item.pubDate),
    },
  });

  // Add to social post queue
  await addToSocialQueue(createdJob.id);

  return { status: 'created', companySlug: company.slug, jobSlug: slug };
}

function parseTitleFormat(title: string): { companyName: string | null; jobTitle: string | null } {
  // Format: "Company: Job Title" or "Company Name: Job Title"
  const colonIndex = title.indexOf(':');
  if (colonIndex > 0) {
    return {
      companyName: title.slice(0, colonIndex).trim(),
      jobTitle: title.slice(colonIndex + 1).trim(),
    };
  }
  return { companyName: null, jobTitle: title };
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
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

function mapCategoryToSlug(category?: string): string {
  if (!category) return 'engineering';

  const c = category.toLowerCase();
  if (c.includes('programming')) return 'engineering';
  if (c.includes('design')) return 'design';
  if (c.includes('devops') || c.includes('sysadmin')) return 'devops';
  if (c.includes('product')) return 'product';
  if (c.includes('marketing') || c.includes('copywriting')) return 'marketing';
  if (c.includes('sales') || c.includes('business')) return 'sales';
  if (c.includes('customer') || c.includes('support')) return 'support';
  if (c.includes('hr') || c.includes('recruiting')) return 'hr';
  if (c.includes('finance') || c.includes('legal')) return 'finance';
  if (c.includes('data') || c.includes('analytics')) return 'data';

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
  if (t.includes('manager')) return 'MANAGER';
  if (t.includes('director')) return 'DIRECTOR';
  if (t.includes('vp') || t.includes('head of') || t.includes('chief')) return 'EXECUTIVE';
  return 'MID';
}

function extractSkillsFromDescription(description: string, category?: string): string[] {
  const skills: Set<string> = new Set();

  const techSkills = [
    'JavaScript', 'TypeScript', 'Python', 'Ruby', 'PHP', 'Java', 'Go', 'Rust',
    'React', 'Vue', 'Angular', 'Node.js', 'Rails', 'Django', 'Laravel',
    'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes',
    'PostgreSQL', 'MySQL', 'MongoDB', 'Redis',
    'GraphQL', 'REST',
  ];

  const lowerDesc = description.toLowerCase();
  for (const skill of techSkills) {
    if (lowerDesc.includes(skill.toLowerCase())) {
      skills.add(skill);
    }
  }

  return Array.from(skills).slice(0, 10);
}
