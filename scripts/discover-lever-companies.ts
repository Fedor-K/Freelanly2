#!/usr/bin/env npx tsx
/**
 * Lever Company Discovery Script
 *
 * Run this script locally or on VPS to discover Lever companies via Google search.
 * Results are saved to a JSON file that can be imported via admin panel.
 *
 * Usage:
 *   npx tsx scripts/discover-lever-companies.ts
 *   npx tsx scripts/discover-lever-companies.ts "site:jobs.lever.co remote"
 *   npx tsx scripts/discover-lever-companies.ts "site:jobs.lever.co" 20
 */

import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

const DEFAULT_QUERY = 'site:jobs.lever.co';
const DEFAULT_MAX_PAGES = 10;
const DELAY_BETWEEN_PAGES_MS = 3000;

interface DiscoveryResult {
  query: string;
  timestamp: string;
  totalFound: number;
  slugs: string[];
}

function extractSlugFromUrl(url: string): string | null {
  const match = url.match(/jobs\.lever\.co\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    const slug = match[1].toLowerCase();
    if (['careers', 'jobs', 'about', 'search'].includes(slug)) {
      return null;
    }
    return slug;
  }
  return null;
}

async function discoverCompanies(searchQuery: string, maxPages: number): Promise<string[]> {
  console.log(`\n🔍 Starting discovery with query: "${searchQuery}"`);
  console.log(`   Max pages: ${maxPages}\n`);

  const browser = await puppeteer.launch({
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
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
  });

  const allSlugs = new Set<string>();

  for (let pageNum = 0; pageNum < maxPages; pageNum++) {
    const start = pageNum * 10;
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&start=${start}&hl=en`;

    console.log(`📄 Page ${pageNum + 1}/${maxPages}: ${allSlugs.size} companies found so far...`);

    try {
      await page.goto(searchUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      await new Promise(r => setTimeout(r, 1000));

      // Check for CAPTCHA
      const pageContent = await page.content();
      if (pageContent.includes('detected unusual traffic') ||
          pageContent.includes('captcha') ||
          pageContent.includes('CAPTCHA')) {
        console.log('❌ CAPTCHA detected! Stopping...');
        break;
      }

      // Extract links
      const links = await page.evaluate(() => {
        const results: string[] = [];
        const anchors = document.querySelectorAll('a[href*="jobs.lever.co"]');
        anchors.forEach(a => {
          const href = a.getAttribute('href');
          if (href && href.includes('jobs.lever.co')) {
            let actualUrl = href;
            if (href.includes('/url?q=')) {
              const match = href.match(/\/url\?q=([^&]+)/);
              if (match) {
                actualUrl = decodeURIComponent(match[1]);
              }
            }
            results.push(actualUrl);
          }
        });
        return results;
      });

      // Extract slugs
      for (const link of links) {
        const slug = extractSlugFromUrl(link);
        if (slug) {
          allSlugs.add(slug);
        }
      }

      // Check if more results
      if (links.length === 0) {
        console.log('📭 No more results found');
        break;
      }

      const hasNextPage = await page.evaluate(() => {
        const nextButton = document.querySelector('a#pnnext');
        return !!nextButton;
      });

      if (!hasNextPage) {
        console.log('📭 No next page available');
        break;
      }

      // Delay before next page
      if (pageNum < maxPages - 1) {
        const delay = DELAY_BETWEEN_PAGES_MS + Math.random() * 2000;
        await new Promise(r => setTimeout(r, delay));
      }

    } catch (error) {
      console.log(`⚠️  Error on page ${pageNum + 1}: ${error}`);
    }
  }

  await browser.close();

  return Array.from(allSlugs).sort();
}

async function main() {
  const args = process.argv.slice(2);
  const searchQuery = args[0] || DEFAULT_QUERY;
  const maxPages = parseInt(args[1]) || DEFAULT_MAX_PAGES;

  console.log('🚀 Lever Company Discovery Tool');
  console.log('================================\n');

  const slugs = await discoverCompanies(searchQuery, maxPages);

  console.log(`\n✅ Discovery complete!`);
  console.log(`   Found ${slugs.length} unique companies\n`);

  // Save results
  const result: DiscoveryResult = {
    query: searchQuery,
    timestamp: new Date().toISOString(),
    totalFound: slugs.length,
    slugs,
  };

  const outputPath = path.join(process.cwd(), 'discovered-lever-companies.json');
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`📁 Results saved to: ${outputPath}`);

  // Also print slugs for easy copy-paste
  console.log('\n📋 Company slugs (copy-paste to admin panel):');
  console.log('─'.repeat(50));
  console.log(slugs.join('\n'));
  console.log('─'.repeat(50));
}

main().catch(console.error);
