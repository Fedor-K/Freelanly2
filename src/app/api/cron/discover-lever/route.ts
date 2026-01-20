/**
 * Cron: Discover new Lever companies via Apify Google Search
 *
 * Runs weekly to find new companies using Lever ATS.
 * Schedule: Once per week (e.g., Sunday 3:00 UTC)
 *
 * Usage:
 *   curl -X POST "https://freelanly.com/api/cron/discover-lever" \
 *     -H "Authorization: Bearer $CRON_SECRET"
 */

import { NextRequest, NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';
import { prisma } from '@/lib/db';
import {
  extractUniqueSlugs,
  LEVER_SEARCH_QUERIES,
} from '@/config/lever-discovery';
import { isCronAuthorized, logUnauthorizedCronAttempt } from '@/lib/cron-auth';

const GOOGLE_SEARCH_ACTOR = 'apify/google-search-scraper';

// Use subset of queries to save Apify credits (rotate twice weekly)
const QUERIES_PER_RUN = 40;

interface GoogleSearchResult {
  url: string;
  title?: string;
}

interface ApifyGoogleSearchPage {
  organicResults?: GoogleSearchResult[];
}

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    logUnauthorizedCronAttempt(request);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.APIFY_API_TOKEN) {
    return NextResponse.json(
      { error: 'APIFY_API_TOKEN not configured' },
      { status: 500 }
    );
  }

  const startTime = Date.now();

  try {
    // Rotate queries based on week number
    const weekNumber = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
    const startIndex =
      (weekNumber * QUERIES_PER_RUN) % LEVER_SEARCH_QUERIES.length;
    const queries = [
      ...LEVER_SEARCH_QUERIES.slice(startIndex, startIndex + QUERIES_PER_RUN),
      ...LEVER_SEARCH_QUERIES.slice(
        0,
        Math.max(0, startIndex + QUERIES_PER_RUN - LEVER_SEARCH_QUERIES.length)
      ),
    ].slice(0, QUERIES_PER_RUN);

    console.log(
      `[Lever Discovery] Starting with ${queries.length} queries (week ${weekNumber})`
    );

    const apify = new ApifyClient({
      token: process.env.APIFY_API_TOKEN,
    });

    // Run Google Search Scraper
    const input = {
      queries: queries.join('\n'),
      maxPagesPerQuery: 3,
      resultsPerPage: 10,
      languageCode: 'en',
      mobileResults: false,
    };

    const run = await apify.actor(GOOGLE_SEARCH_ACTOR).call(input, {
      waitSecs: 300,
    });

    if (run.status !== 'SUCCEEDED') {
      throw new Error(`Apify run failed: ${run.status}`);
    }

    // Get results
    const { items } = await apify.dataset(run.defaultDatasetId).listItems();

    // Extract URLs
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

    // Extract unique slugs
    const slugs = extractUniqueSlugs(allUrls);

    if (slugs.length === 0) {
      return NextResponse.json({
        message: 'No Lever companies found',
        duration: Date.now() - startTime,
      });
    }

    // Check existing
    const existingSources = await prisma.dataSource.findMany({
      where: {
        sourceType: 'LEVER',
        companySlug: { in: slugs },
      },
      select: { companySlug: true },
    });

    const existingSlugsSet = new Set(
      existingSources.map((s) => s.companySlug?.toLowerCase()).filter(Boolean)
    );

    const newSlugs = slugs.filter((slug) => !existingSlugsSet.has(slug));

    if (newSlugs.length === 0) {
      return NextResponse.json({
        message: 'All companies already in database',
        found: slugs.length,
        existing: existingSlugsSet.size,
        new: 0,
        duration: Date.now() - startTime,
      });
    }

    // Validate new slugs against Lever API
    const validSlugs: { slug: string; jobCount: number }[] = [];

    for (const slug of newSlugs) {
      try {
        const response = await fetch(
          `https://api.lever.co/v0/postings/${slug}?mode=json`
        );

        if (response.ok) {
          const jobs = await response.json();
          if (Array.isArray(jobs) && jobs.length > 0) {
            validSlugs.push({ slug, jobCount: jobs.length });
          }
        }
      } catch {
        // Skip invalid slugs
      }

      // Rate limiting
      await new Promise((r) => setTimeout(r, 200));
    }

    // Add valid companies to database
    const addedCompanies: string[] = [];

    for (const { slug } of validSlugs) {
      try {
        const displayName = slug
          .split('-')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');

        await prisma.dataSource.create({
          data: {
            name: displayName,
            sourceType: 'LEVER',
            companySlug: slug,
            apiUrl: `https://api.lever.co/v0/postings/${slug}?mode=json`,
            isActive: true,
          },
        });

        addedCompanies.push(slug);
        console.log(`[Lever Discovery] Added: ${slug}`);
      } catch (error) {
        console.error(`[Lever Discovery] Failed to add ${slug}:`, error);
      }
    }

    const result = {
      message: `Added ${addedCompanies.length} new Lever companies`,
      found: slugs.length,
      existing: existingSlugsSet.size,
      newFound: newSlugs.length,
      validated: validSlugs.length,
      added: addedCompanies.length,
      companies: addedCompanies,
      duration: Date.now() - startTime,
    };

    console.log('[Lever Discovery] Complete:', result);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Lever Discovery] Error:', error);
    return NextResponse.json(
      { error: 'Discovery failed', details: String(error) },
      { status: 500 }
    );
  }
}

// GET endpoint for status check
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    logUnauthorizedCronAttempt(request);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const leverCount = await prisma.dataSource.count({
    where: { sourceType: 'LEVER' },
  });

  const activeCount = await prisma.dataSource.count({
    where: { sourceType: 'LEVER', isActive: true },
  });

  return NextResponse.json({
    status: 'ready',
    leverSources: { total: leverCount, active: activeCount },
    queriesTotal: LEVER_SEARCH_QUERIES.length,
    queriesPerRun: QUERIES_PER_RUN,
    apifyConfigured: !!process.env.APIFY_API_TOKEN,
  });
}
