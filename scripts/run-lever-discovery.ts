#!/usr/bin/env npx tsx
/**
 * Run Lever Company Discovery via Apify Google Search Scraper
 *
 * Usage:
 *   npx tsx scripts/run-lever-discovery.ts
 *   npx tsx scripts/run-lever-discovery.ts --limit 5
 */

import { ApifyClient } from 'apify-client';
import { PrismaClient } from '@prisma/client';
import { extractUniqueSlugs, LEVER_SEARCH_QUERIES } from '../src/config/lever-discovery';

const prisma = new PrismaClient();

// Google Search Scraper actor ID
const GOOGLE_SEARCH_ACTOR = 'apify/google-search-scraper';

interface GoogleSearchResult {
  url: string;
  title: string;
  description?: string;
}

interface ApifyGoogleSearchPage {
  organicResults?: GoogleSearchResult[];
}

async function main() {
  const args = process.argv.slice(2);
  const limitIndex = args.indexOf('--limit');
  const queryLimit = limitIndex >= 0 ? parseInt(args[limitIndex + 1]) || 5 : 5;

  console.log('🚀 Lever Company Discovery via Apify\n');
  console.log(`   Using ${queryLimit} search queries\n`);

  // Check for API token
  if (!process.env.APIFY_API_TOKEN) {
    console.error('❌ APIFY_API_TOKEN not set');
    process.exit(1);
  }

  const apify = new ApifyClient({
    token: process.env.APIFY_API_TOKEN,
  });

  // Take subset of queries for testing
  const queries = LEVER_SEARCH_QUERIES.slice(0, queryLimit);
  console.log('📝 Search queries:');
  queries.forEach((q, i) => console.log(`   ${i + 1}. ${q}`));
  console.log();

  // Prepare input for Google Search Scraper
  const input = {
    queries: queries.join('\n'),
    maxPagesPerQuery: 3, // 30 results per query
    resultsPerPage: 10,
    languageCode: 'en',
    mobileResults: false,
    includeUnfilteredResults: false,
  };

  console.log('⏳ Starting Apify Google Search Scraper...');
  console.log('   This may take 1-2 minutes...\n');

  try {
    // Run the actor
    const run = await apify.actor(GOOGLE_SEARCH_ACTOR).call(input, {
      waitSecs: 300, // Wait up to 5 minutes
    });

    console.log(`✅ Actor run completed. Run ID: ${run.id}`);
    console.log(`   Status: ${run.status}\n`);

    if (run.status !== 'SUCCEEDED') {
      console.error(`❌ Actor run failed with status: ${run.status}`);
      process.exit(1);
    }

    // Get results from dataset
    const { items } = await apify.dataset(run.defaultDatasetId).listItems();
    console.log(`📊 Received ${items.length} search result pages\n`);

    // Extract all URLs from organic results
    const allUrls: string[] = [];
    for (const page of items as ApifyGoogleSearchPage[]) {
      if (page.organicResults) {
        for (const result of page.organicResults) {
          if (result.url) {
            allUrls.push(result.url);
          }
        }
      }
    }

    console.log(`🔗 Found ${allUrls.length} total URLs\n`);

    // Extract unique Lever slugs
    const slugs = extractUniqueSlugs(allUrls);
    console.log(`🏢 Extracted ${slugs.length} unique Lever company slugs\n`);

    if (slugs.length === 0) {
      console.log('No Lever companies found in search results.');
      await prisma.$disconnect();
      return;
    }

    // Check which slugs already exist in database
    const existingSources = await prisma.dataSource.findMany({
      where: {
        sourceType: 'LEVER',
        companySlug: { in: slugs },
      },
      select: { companySlug: true },
    });

    const existingSlugsSet = new Set(
      existingSources.map(s => s.companySlug?.toLowerCase()).filter(Boolean)
    );

    const newSlugs = slugs.filter(slug => !existingSlugsSet.has(slug));
    const existingSlugs = slugs.filter(slug => existingSlugsSet.has(slug));

    // Print results
    console.log('═'.repeat(60));
    console.log(`\n✨ NEW companies (${newSlugs.length}):`);
    if (newSlugs.length > 0) {
      newSlugs.forEach(slug => console.log(`   + ${slug}`));
    } else {
      console.log('   (none)');
    }

    console.log(`\n📦 Already in DB (${existingSlugs.length}):`);
    if (existingSlugs.length > 0) {
      existingSlugs.forEach(slug => console.log(`   - ${slug}`));
    } else {
      console.log('   (none)');
    }

    console.log('\n' + '═'.repeat(60));

    // Validate new slugs against Lever API
    if (newSlugs.length > 0) {
      console.log('\n🔍 Validating new companies against Lever API...\n');

      const validSlugs: string[] = [];
      const invalidSlugs: string[] = [];

      for (const slug of newSlugs) {
        try {
          const response = await fetch(
            `https://api.lever.co/v0/postings/${slug}?mode=json`
          );

          if (response.ok) {
            const jobs = await response.json();
            if (Array.isArray(jobs) && jobs.length > 0) {
              validSlugs.push(slug);
              console.log(`   ✅ ${slug} - ${jobs.length} active jobs`);
            } else {
              invalidSlugs.push(slug);
              console.log(`   ⚠️  ${slug} - no active jobs`);
            }
          } else {
            invalidSlugs.push(slug);
            console.log(`   ❌ ${slug} - invalid (${response.status})`);
          }
        } catch (error) {
          invalidSlugs.push(slug);
          console.log(`   ❌ ${slug} - error: ${error}`);
        }

        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 200));
      }

      console.log('\n' + '═'.repeat(60));
      console.log(`\n🎯 READY TO ADD (${validSlugs.length} valid companies):`);
      if (validSlugs.length > 0) {
        validSlugs.forEach(slug => console.log(`   ${slug}`));
        console.log('\n📋 Copy-paste for adding:');
        console.log(validSlugs.join('\n'));
      }
    }

    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('\n📈 SUMMARY:');
    console.log(`   Total slugs found: ${slugs.length}`);
    console.log(`   Already in DB: ${existingSlugs.length}`);
    console.log(`   New companies: ${newSlugs.length}`);
    console.log();

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
