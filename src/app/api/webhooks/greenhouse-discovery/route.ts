/**
 * Greenhouse Company Discovery Webhook
 *
 * Receives Google Search results from Apify actor and adds new Greenhouse companies to DataSource.
 * Run weekly via Apify scheduler → webhook → this endpoint
 *
 * Apify actor: https://apify.com/apify/google-search-scraper
 *
 * Expected payload from Apify:
 * [
 *   { "url": "https://boards.greenhouse.io/stripe/jobs/123", "title": "...", ... },
 *   { "url": "https://boards.greenhouse.io/airbnb/jobs/456", "title": "...", ... }
 * ]
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { extractUniqueSlugs } from '@/config/greenhouse-discovery';

// Validate webhook secret
function validateAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;

  const token = authHeader.replace('Bearer ', '');
  return token === process.env.CRON_SECRET;
}

interface ApifySearchResult {
  url: string;
  title?: string;
  description?: string;
}

export async function POST(request: NextRequest) {
  // Validate authorization
  if (!validateAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Handle various Apify payload formats
    let results: ApifySearchResult[] = [];

    if (Array.isArray(body)) {
      if (body.length > 0 && body[0].organicResults) {
        // Apify Google Search actor format: [{organicResults: [...]}, ...]
        for (const page of body) {
          if (page.organicResults && Array.isArray(page.organicResults)) {
            results.push(...page.organicResults);
          }
        }
      } else {
        results = body;
      }
    } else if (body.items && Array.isArray(body.items)) {
      results = body.items;
    } else if (body.organicResults && Array.isArray(body.organicResults)) {
      results = body.organicResults;
    } else {
      return NextResponse.json(
        { error: 'Invalid payload format. Expected array of search results.' },
        { status: 400 }
      );
    }

    if (results.length === 0) {
      return NextResponse.json({
        message: 'No results to process',
        added: 0,
        skipped: 0,
      });
    }

    // Extract URLs from results
    const urls = results
      .map((r) => r.url)
      .filter((url): url is string => typeof url === 'string');

    console.log(`[Greenhouse Discovery] Processing ${urls.length} URLs`);

    // Extract unique company slugs
    const slugs = extractUniqueSlugs(urls);
    console.log(`[Greenhouse Discovery] Found ${slugs.length} unique slugs:`, slugs);

    if (slugs.length === 0) {
      return NextResponse.json({
        message: 'No valid Greenhouse company slugs found in URLs',
        added: 0,
        skipped: 0,
        urls: urls.slice(0, 5),
      });
    }

    // Get existing Greenhouse sources
    const existingSources = await prisma.dataSource.findMany({
      where: {
        sourceType: 'GREENHOUSE',
        companySlug: { in: slugs },
      },
      select: { companySlug: true },
    });

    const existingSlugs = new Set(
      existingSources.map((s) => s.companySlug?.toLowerCase())
    );

    // Filter out already existing companies
    const newSlugs = slugs.filter(
      (slug) => !existingSlugs.has(slug.toLowerCase())
    );

    console.log(
      `[Greenhouse Discovery] ${newSlugs.length} new companies to add:`,
      newSlugs
    );

    if (newSlugs.length === 0) {
      return NextResponse.json({
        message: 'All companies already exist in database',
        added: 0,
        skipped: slugs.length,
        existingSlugs: slugs,
      });
    }

    // Validate against Greenhouse API before adding
    const validSlugs: string[] = [];
    for (const slug of newSlugs) {
      try {
        const response = await fetch(
          `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`
        );
        if (response.ok) {
          const data = await response.json();
          if (data.jobs && data.jobs.length > 0) {
            validSlugs.push(slug);
          }
        }
      } catch {
        // Skip invalid
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    // Add new companies
    const addedCompanies: string[] = [];
    const errors: { slug: string; error: string }[] = [];

    for (const slug of validSlugs) {
      try {
        const displayName = slug
          .split('-')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');

        await prisma.dataSource.create({
          data: {
            name: displayName,
            sourceType: 'GREENHOUSE',
            companySlug: slug,
            apiUrl: `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`,
            isActive: true,
          },
        });

        addedCompanies.push(slug);
        console.log(`[Greenhouse Discovery] Added: ${slug} (${displayName})`);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        errors.push({ slug, error: errorMessage });
        console.error(`[Greenhouse Discovery] Failed to add ${slug}:`, error);
      }
    }

    const response = {
      message: `Added ${addedCompanies.length} new Greenhouse companies`,
      added: addedCompanies.length,
      skipped: slugs.length - validSlugs.length,
      validated: validSlugs.length,
      newCompanies: addedCompanies,
      errors: errors.length > 0 ? errors : undefined,
    };

    console.log('[Greenhouse Discovery] Complete:', response);

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Greenhouse Discovery] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook', details: String(error) },
      { status: 500 }
    );
  }
}

// GET endpoint to check status
export async function GET(request: NextRequest) {
  if (!validateAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const greenhouseCount = await prisma.dataSource.count({
      where: { sourceType: 'GREENHOUSE' },
    });

    const activeCount = await prisma.dataSource.count({
      where: { sourceType: 'GREENHOUSE', isActive: true },
    });

    const { GREENHOUSE_SEARCH_QUERIES } = await import(
      '@/config/greenhouse-discovery'
    );

    return NextResponse.json({
      status: 'ready',
      greenhouseSources: {
        total: greenhouseCount,
        active: activeCount,
      },
      searchQueries: {
        count: GREENHOUSE_SEARCH_QUERIES.length,
        queries: GREENHOUSE_SEARCH_QUERIES,
      },
      usage: {
        apifyActor: 'https://apify.com/apify/google-search-scraper',
        webhookUrl: '/api/webhooks/greenhouse-discovery',
        method: 'POST',
        authHeader: 'Authorization: Bearer $CRON_SECRET',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get status', details: String(error) },
      { status: 500 }
    );
  }
}
