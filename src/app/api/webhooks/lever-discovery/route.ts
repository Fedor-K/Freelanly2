/**
 * Lever Company Discovery Webhook
 *
 * Receives Google Search results from Apify actor and adds new Lever companies to DataSource.
 * Run weekly via Apify scheduler → webhook → this endpoint
 *
 * Apify actor: https://apify.com/apify/google-search-scraper
 *
 * Expected payload from Apify:
 * [
 *   { "url": "https://jobs.lever.co/stripe/abc123", "title": "...", ... },
 *   { "url": "https://jobs.lever.co/figma/xyz789", "title": "...", ... }
 * ]
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { extractUniqueSlugs } from '@/config/lever-discovery';

// Validate webhook secret (use CRON_SECRET for simplicity)
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
  // Other fields we don't need
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
      // Check if it's array of search pages (each with organicResults)
      // or array of direct results
      if (body.length > 0 && body[0].organicResults) {
        // Apify Google Search actor format: [{organicResults: [...]}, ...]
        for (const page of body) {
          if (page.organicResults && Array.isArray(page.organicResults)) {
            results.push(...page.organicResults);
          }
        }
      } else {
        // Direct array of results
        results = body;
      }
    } else if (body.items && Array.isArray(body.items)) {
      results = body.items;
    } else if (body.organicResults && Array.isArray(body.organicResults)) {
      // Single page with organicResults
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

    console.log(`[Lever Discovery] Processing ${urls.length} URLs`);

    // Extract unique company slugs
    const slugs = extractUniqueSlugs(urls);
    console.log(`[Lever Discovery] Found ${slugs.length} unique slugs:`, slugs);

    if (slugs.length === 0) {
      return NextResponse.json({
        message: 'No valid Lever company slugs found in URLs',
        added: 0,
        skipped: 0,
        urls: urls.slice(0, 5), // Show first 5 for debugging
      });
    }

    // Get existing Lever sources
    const existingSources = await prisma.dataSource.findMany({
      where: {
        sourceType: 'LEVER',
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
      `[Lever Discovery] ${newSlugs.length} new companies to add:`,
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

    // Add new companies
    const addedCompanies: string[] = [];
    const errors: { slug: string; error: string }[] = [];

    for (const slug of newSlugs) {
      try {
        // Generate display name from slug (stripe → Stripe, my-company → My Company)
        const displayName = slug
          .split('-')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
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
        console.log(`[Lever Discovery] Added: ${slug} (${displayName})`);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        errors.push({ slug, error: errorMessage });
        console.error(`[Lever Discovery] Failed to add ${slug}:`, error);
      }
    }

    const response = {
      message: `Added ${addedCompanies.length} new Lever companies`,
      added: addedCompanies.length,
      skipped: slugs.length - newSlugs.length,
      newCompanies: addedCompanies,
      errors: errors.length > 0 ? errors : undefined,
    };

    console.log('[Lever Discovery] Complete:', response);

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Lever Discovery] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook', details: String(error) },
      { status: 500 }
    );
  }
}

// GET endpoint to check status and list search queries
export async function GET(request: NextRequest) {
  // Validate authorization
  if (!validateAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get current Lever sources count
    const leverSourcesCount = await prisma.dataSource.count({
      where: { sourceType: 'LEVER' },
    });

    const activeCount = await prisma.dataSource.count({
      where: { sourceType: 'LEVER', isActive: true },
    });

    // Import queries to show
    const { LEVER_SEARCH_QUERIES } = await import(
      '@/config/lever-discovery'
    );

    return NextResponse.json({
      status: 'ready',
      leverSources: {
        total: leverSourcesCount,
        active: activeCount,
      },
      searchQueries: {
        count: LEVER_SEARCH_QUERIES.length,
        queries: LEVER_SEARCH_QUERIES,
      },
      usage: {
        apifyActor: 'https://apify.com/apify/google-search-scraper',
        webhookUrl: '/api/webhooks/lever-discovery',
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
