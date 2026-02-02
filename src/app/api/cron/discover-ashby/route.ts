/**
 * Cron: Discover new Ashby companies via Apify Google Search
 *
 * Runs weekly to find new companies using Ashby ATS.
 * Schedule: Once per week (e.g., Sunday ~5:00 UTC - offset from Lever/Greenhouse)
 */

import { NextRequest, NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';
import { prisma } from '@/lib/db';
import {
  extractUniqueSlugs,
  ASHBY_SEARCH_QUERIES,
} from '@/config/ashby-discovery';
import { isCronAuthorized, logUnauthorizedCronAttempt } from '@/lib/cron-auth';

const GOOGLE_SEARCH_ACTOR = 'apify/google-search-scraper';
const QUERIES_PER_RUN = 25;

interface ApifyGoogleSearchPage {
  organicResults?: { url: string; title?: string }[];
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
    // Rotate queries (offset +2 from Lever to avoid overlap)
    const weekNumber = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
    const startIndex =
      ((weekNumber + 2) * QUERIES_PER_RUN) % ASHBY_SEARCH_QUERIES.length;
    const queries = [
      ...ASHBY_SEARCH_QUERIES.slice(startIndex, startIndex + QUERIES_PER_RUN),
      ...ASHBY_SEARCH_QUERIES.slice(
        0,
        Math.max(0, startIndex + QUERIES_PER_RUN - ASHBY_SEARCH_QUERIES.length)
      ),
    ].slice(0, QUERIES_PER_RUN);

    console.log(
      `[Ashby Discovery] Starting with ${queries.length} queries (week ${weekNumber})`
    );

    const apify = new ApifyClient({
      token: process.env.APIFY_API_TOKEN,
    });

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

    const { items } = await apify.dataset(run.defaultDatasetId).listItems();

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

    const slugs = extractUniqueSlugs(allUrls);

    if (slugs.length === 0) {
      return NextResponse.json({
        message: 'No Ashby companies found',
        duration: Date.now() - startTime,
      });
    }

    const existingSources = await prisma.dataSource.findMany({
      where: {
        sourceType: 'ASHBY',
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

    // Validate new slugs against Ashby API
    const validSlugs: { slug: string; jobCount: number }[] = [];

    for (const slug of newSlugs) {
      try {
        const response = await fetch(
          `https://api.ashbyhq.com/posting-api/job-board/${slug}`
        );

        if (response.ok) {
          const data = await response.json();
          const jobs = data.jobs || [];
          if (Array.isArray(jobs) && jobs.length > 0) {
            validSlugs.push({ slug, jobCount: jobs.length });
          }
        }
      } catch {
        // Skip invalid slugs
      }

      await new Promise((r) => setTimeout(r, 200));
    }

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
            sourceType: 'ASHBY',
            companySlug: slug,
            apiUrl: `https://api.ashbyhq.com/posting-api/job-board/${slug}`,
            isActive: true,
          },
        });

        addedCompanies.push(slug);
        console.log(`[Ashby Discovery] Added: ${slug}`);
      } catch (error) {
        console.error(`[Ashby Discovery] Failed to add ${slug}:`, error);
      }
    }

    const result = {
      message: `Added ${addedCompanies.length} new Ashby companies`,
      found: slugs.length,
      existing: existingSlugsSet.size,
      newFound: newSlugs.length,
      validated: validSlugs.length,
      added: addedCompanies.length,
      companies: addedCompanies,
      duration: Date.now() - startTime,
    };

    console.log('[Ashby Discovery] Complete:', result);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Ashby Discovery] Error:', error);
    return NextResponse.json(
      { error: 'Discovery failed', details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    logUnauthorizedCronAttempt(request);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ashbyCount = await prisma.dataSource.count({
    where: { sourceType: 'ASHBY' },
  });

  const activeCount = await prisma.dataSource.count({
    where: { sourceType: 'ASHBY', isActive: true },
  });

  return NextResponse.json({
    status: 'ready',
    ashbySources: { total: ashbyCount, active: activeCount },
    queriesTotal: ASHBY_SEARCH_QUERIES.length,
    queriesPerRun: QUERIES_PER_RUN,
    apifyConfigured: !!process.env.APIFY_API_TOKEN,
  });
}
