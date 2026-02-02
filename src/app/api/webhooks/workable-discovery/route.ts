/**
 * Workable Company Discovery Webhook
 *
 * Receives Google Search results from Apify actor and adds new Workable companies to DataSource.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { extractUniqueSlugs } from '@/config/workable-discovery';

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
  if (!validateAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    let results: ApifySearchResult[] = [];

    if (Array.isArray(body)) {
      if (body.length > 0 && body[0].organicResults) {
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
      return NextResponse.json({ message: 'No results to process', added: 0, skipped: 0 });
    }

    const urls = results
      .map((r) => r.url)
      .filter((url): url is string => typeof url === 'string');

    console.log(`[Workable Discovery] Processing ${urls.length} URLs`);

    const slugs = extractUniqueSlugs(urls);
    console.log(`[Workable Discovery] Found ${slugs.length} unique slugs:`, slugs);

    if (slugs.length === 0) {
      return NextResponse.json({
        message: 'No valid Workable company slugs found in URLs',
        added: 0,
        skipped: 0,
      });
    }

    const existingSources = await prisma.dataSource.findMany({
      where: { sourceType: 'WORKABLE', companySlug: { in: slugs } },
      select: { companySlug: true },
    });

    const existingSlugs = new Set(
      existingSources.map((s) => s.companySlug?.toLowerCase())
    );

    const newSlugs = slugs.filter((slug) => !existingSlugs.has(slug.toLowerCase()));

    if (newSlugs.length === 0) {
      return NextResponse.json({
        message: 'All companies already exist in database',
        added: 0,
        skipped: slugs.length,
      });
    }

    // Validate against Workable Widget API
    const validSlugs: string[] = [];
    for (const slug of newSlugs) {
      try {
        const response = await fetch(
          `https://apply.workable.com/api/v1/widget/accounts/${slug}`
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
            sourceType: 'WORKABLE',
            companySlug: slug,
            apiUrl: `https://apply.workable.com/api/v1/widget/accounts/${slug}`,
            isActive: true,
          },
        });

        addedCompanies.push(slug);
        console.log(`[Workable Discovery] Added: ${slug} (${displayName})`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push({ slug, error: errorMessage });
        console.error(`[Workable Discovery] Failed to add ${slug}:`, error);
      }
    }

    const response = {
      message: `Added ${addedCompanies.length} new Workable companies`,
      added: addedCompanies.length,
      skipped: slugs.length - validSlugs.length,
      validated: validSlugs.length,
      newCompanies: addedCompanies,
      errors: errors.length > 0 ? errors : undefined,
    };

    console.log('[Workable Discovery] Complete:', response);
    return NextResponse.json(response);
  } catch (error) {
    console.error('[Workable Discovery] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook', details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  if (!validateAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const workableCount = await prisma.dataSource.count({ where: { sourceType: 'WORKABLE' } });
    const activeCount = await prisma.dataSource.count({ where: { sourceType: 'WORKABLE', isActive: true } });

    const { WORKABLE_SEARCH_QUERIES } = await import('@/config/workable-discovery');

    return NextResponse.json({
      status: 'ready',
      workableSources: { total: workableCount, active: activeCount },
      searchQueries: { count: WORKABLE_SEARCH_QUERIES.length },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get status', details: String(error) },
      { status: 500 }
    );
  }
}
