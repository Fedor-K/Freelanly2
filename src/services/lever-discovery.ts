/**
 * Lever Company Discovery Service
 *
 * Scrapes Google search results to find companies using Lever ATS.
 * Uses Puppeteer with stealth plugin to avoid detection.
 */

import { prisma } from '@/lib/db';

// Dynamic import for puppeteer to avoid build issues
async function getPuppeteer() {
  const puppeteer = (await import('puppeteer-extra')).default;
  const StealthPlugin = (await import('puppeteer-extra-plugin-stealth')).default;
  puppeteer.use(StealthPlugin());
  return puppeteer;
}

export interface DiscoveryProgress {
  status: 'idle' | 'running' | 'completed' | 'error' | 'cancelled';
  currentPage: number;
  totalPages: number;
  foundSlugs: string[];
  newSlugs: string[]; // Not in DB yet
  existingSlugs: string[]; // Already in DB
  errors: string[];
  startTime: number;
  searchQuery: string;
}

export interface DiscoveryResult {
  slug: string;
  url: string;
  title: string;
  isNew: boolean;
}

// Store for current discovery progress (in-memory, single instance)
let currentDiscovery: DiscoveryProgress | null = null;
let cancelRequested = false;

const SEARCH_QUERIES = [
  'site:jobs.lever.co',
  'site:jobs.lever.co remote',
  'site:jobs.lever.co software engineer',
  'site:jobs.lever.co marketing',
  'site:jobs.lever.co sales',
  'site:jobs.lever.co design',
  'site:jobs.lever.co product manager',
  'site:jobs.lever.co data',
];

const DELAY_BETWEEN_PAGES_MS = 3000 + Math.random() * 2000; // 3-5 seconds
const MAX_PAGES_PER_QUERY = 10; // Google shows max ~100 results per query

/**
 * Extract company slug from Lever URL
 */
function extractSlugFromUrl(url: string): string | null {
  // URLs like: https://jobs.lever.co/company-slug or https://jobs.lever.co/company-slug/job-id
  const match = url.match(/jobs\.lever\.co\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    const slug = match[1].toLowerCase();
    // Filter out common non-company paths
    if (['careers', 'jobs', 'about', 'search'].includes(slug)) {
      return null;
    }
    return slug;
  }
  return null;
}

/**
 * Get current discovery progress
 */
export function getDiscoveryProgress(): DiscoveryProgress | null {
  return currentDiscovery;
}

/**
 * Cancel current discovery
 */
export function cancelDiscovery(): void {
  cancelRequested = true;
  if (currentDiscovery) {
    currentDiscovery.status = 'cancelled';
  }
}

/**
 * Run discovery for a single search query
 */
export async function discoverLeverCompanies(
  searchQuery: string = 'site:jobs.lever.co',
  maxPages: number = MAX_PAGES_PER_QUERY
): Promise<DiscoveryProgress> {
  // Initialize progress
  cancelRequested = false;
  currentDiscovery = {
    status: 'running',
    currentPage: 0,
    totalPages: maxPages,
    foundSlugs: [],
    newSlugs: [],
    existingSlugs: [],
    errors: [],
    startTime: Date.now(),
    searchQuery,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let browser: any = null;

  try {
    // Get existing slugs from DB
    const existingSourcesInDb = await prisma.dataSource.findMany({
      where: { sourceType: 'LEVER' },
      select: { companySlug: true },
    });
    const existingDbSlugs = new Set(
      existingSourcesInDb.map(s => s.companySlug?.toLowerCase()).filter(Boolean)
    );

    // Launch browser
    const puppeteerInstance = await getPuppeteer();
    browser = await puppeteerInstance.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--lang=en-US,en',
      ],
    });

    const page = await browser.newPage();

    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    });

    const allFoundSlugs = new Set<string>();
    const newSlugs = new Set<string>();
    const existingSlugs = new Set<string>();

    // Search each page
    for (let pageNum = 0; pageNum < maxPages; pageNum++) {
      if (cancelRequested) {
        currentDiscovery.status = 'cancelled';
        break;
      }

      currentDiscovery.currentPage = pageNum + 1;

      try {
        // Build Google search URL
        const start = pageNum * 10;
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&start=${start}&hl=en`;

        // Navigate to search page
        await page.goto(searchUrl, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });

        // Wait a bit for dynamic content
        await new Promise(r => setTimeout(r, 1000));

        // Check for CAPTCHA
        const pageContent = await page.content();
        if (pageContent.includes('detected unusual traffic') ||
            pageContent.includes('captcha') ||
            pageContent.includes('CAPTCHA')) {
          currentDiscovery.errors.push(`CAPTCHA detected on page ${pageNum + 1}`);
          currentDiscovery.status = 'error';
          break;
        }

        // Extract all links from search results
        const links = await page.evaluate(() => {
          const results: { url: string; title: string }[] = [];

          // Get all anchor tags in search results
          const anchors = document.querySelectorAll('a[href*="jobs.lever.co"]');
          anchors.forEach(a => {
            const href = a.getAttribute('href');
            const text = a.textContent || '';
            if (href && href.includes('jobs.lever.co')) {
              // Extract actual URL from Google redirect
              let actualUrl = href;
              if (href.includes('/url?q=')) {
                const match = href.match(/\/url\?q=([^&]+)/);
                if (match) {
                  actualUrl = decodeURIComponent(match[1]);
                }
              }
              results.push({ url: actualUrl, title: text.trim() });
            }
          });

          return results;
        });

        // Extract slugs from found URLs
        for (const link of links) {
          const slug = extractSlugFromUrl(link.url);
          if (slug && !allFoundSlugs.has(slug)) {
            allFoundSlugs.add(slug);

            if (existingDbSlugs.has(slug)) {
              existingSlugs.add(slug);
            } else {
              newSlugs.add(slug);
            }
          }
        }

        // Update progress
        currentDiscovery.foundSlugs = Array.from(allFoundSlugs);
        currentDiscovery.newSlugs = Array.from(newSlugs);
        currentDiscovery.existingSlugs = Array.from(existingSlugs);

        // Check if no more results
        if (links.length === 0) {
          currentDiscovery.totalPages = pageNum + 1;
          break;
        }

        // Check for "Next" button to see if more pages exist
        const hasNextPage = await page.evaluate(() => {
          const nextButton = document.querySelector('a#pnnext');
          return !!nextButton;
        });

        if (!hasNextPage) {
          currentDiscovery.totalPages = pageNum + 1;
          break;
        }

        // Delay before next page
        if (pageNum < maxPages - 1) {
          const delay = 3000 + Math.random() * 2000;
          await new Promise(r => setTimeout(r, delay));
        }

      } catch (error) {
        currentDiscovery.errors.push(`Page ${pageNum + 1}: ${String(error)}`);
        // Continue to next page on error
      }
    }

    if (currentDiscovery.status === 'running') {
      currentDiscovery.status = 'completed';
    }

  } catch (error) {
    currentDiscovery.status = 'error';
    currentDiscovery.errors.push(String(error));
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return currentDiscovery;
}

/**
 * Validate discovered slugs against Lever API
 */
export async function validateDiscoveredSlugs(
  slugs: string[],
  onProgress?: (current: number, total: number, results: DiscoveryResult[]) => void
): Promise<DiscoveryResult[]> {
  const results: DiscoveryResult[] = [];

  // Get existing slugs from DB
  const existingSources = await prisma.dataSource.findMany({
    where: { sourceType: 'LEVER' },
    select: { companySlug: true },
  });
  const existingDbSlugs = new Set(
    existingSources.map(s => s.companySlug?.toLowerCase()).filter(Boolean)
  );

  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i];

    try {
      // Check if company has jobs on Lever
      const response = await fetch(`https://api.lever.co/v0/postings/${slug}?mode=json`);

      if (response.ok) {
        const jobs = await response.json();
        if (Array.isArray(jobs) && jobs.length > 0) {
          results.push({
            slug,
            url: `https://jobs.lever.co/${slug}`,
            title: jobs[0]?.categories?.team || slug,
            isNew: !existingDbSlugs.has(slug),
          });
        }
      }
    } catch {
      // Skip invalid slugs
    }

    if (onProgress) {
      onProgress(i + 1, slugs.length, results);
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 200));
  }

  return results;
}

/**
 * Add validated slugs to database
 */
export async function addDiscoveredSources(slugs: string[]): Promise<{
  added: number;
  skipped: number;
  errors: string[];
}> {
  let added = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const slug of slugs) {
    try {
      // Check if already exists
      const existing = await prisma.dataSource.findFirst({
        where: {
          sourceType: 'LEVER',
          companySlug: slug,
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Validate the source
      const response = await fetch(`https://api.lever.co/v0/postings/${slug}?mode=json`);
      if (!response.ok) {
        errors.push(`${slug}: Invalid Lever page`);
        continue;
      }

      const jobs = await response.json();
      if (!Array.isArray(jobs) || jobs.length === 0) {
        errors.push(`${slug}: No jobs found`);
        continue;
      }

      // Create the source
      await prisma.dataSource.create({
        data: {
          name: slug,
          sourceType: 'LEVER',
          companySlug: slug,
          apiUrl: `https://api.lever.co/v0/postings/${slug}?mode=json`,
          isActive: true,
        },
      });

      added++;
    } catch (error) {
      errors.push(`${slug}: ${String(error)}`);
    }
  }

  return { added, skipped, errors };
}
