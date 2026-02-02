/**
 * SmartRecruiters Company Discovery Webhook
 *
 * Receives Google Search results from Apify actor and adds new SmartRecruiters companies to DataSource.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { extractUniqueSlugs } from '@/config/smartrecruiters-discovery';

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

    console.log(`[SmartRecruiters Discovery] Processing ${urls.length} URLs`);

    const slugs = extractUniqueSlugs(urls);
    console.log(`[SmartRecruiters Discovery] Found ${slugs.length} unique slugs:`, slugs);

    if (slugs.length === 0) {
      return NextResponse.json({
        message: 'No valid SmartRecruiters company slugs found in URLs',
        added: 0,
        skipped: 0,
      });
    }

    const existingSources = await prisma.dataSource.findMany({
      where: { sourceType: 'SMARTRECRUITERS', companySlug: { in: slugs } },
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

    // Validate against SmartRecruiters API
    const validSlugs: string[] = [];
    for (const slug of newSlugs) {
      try {
        const response = await fetch(
          `https://api.smartrecruiters.com/v1/companies/${slug}/postings`
        );
        if (response.ok) {
          const data = await response.json();
          if (data.content && data.content.length > 0) {
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
          .split(/[-_]/)
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');

        await prisma.dataSource.create({
          data: {
            name: displayName,
            sourceType: 'SMARTRECRUITERS',
            companySlug: slug,
            apiUrl: `https://api.smartrecruiters.com/v1/companies/${slug}/postings`,
            isActive: true,
          },
        });

        addedCompanies.push(slug);
        console.log(`[SmartRecruiters Discovery] Added: ${slug} (${displayName})`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push({ slug, error: errorMessage });
        console.error(`[SmartRecruiters Discovery] Failed to add ${slug}:`, error);
      }
    }

    const response = {
      message: `Added ${addedCompanies.length} new SmartRecruiters companies`,
      added: addedCompanies.length,
      skipped: slugs.length - validSlugs.length,
      validated: validSlugs.length,
      newCompanies: addedCompanies,
      errors: errors.length > 0 ? errors : undefined,
    };

    console.log('[SmartRecruiters Discovery] Complete:', response);
    return NextResponse.json(response);
  } catch (error) {
    console.error('[SmartRecruiters Discovery] Error:', error);
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
    const srCount = await prisma.dataSource.count({ where: { sourceType: 'SMARTRECRUITERS' } });
    const activeCount = await prisma.dataSource.count({ where: { sourceType: 'SMARTRECRUITERS', isActive: true } });

    const { SMARTRECRUITERS_SEARCH_QUERIES } = await import('@/config/smartrecruiters-discovery');

    return NextResponse.json({
      status: 'ready',
      smartrecruitersSources: { total: srCount, active: activeCount },
      searchQueries: { count: SMARTRECRUITERS_SEARCH_QUERIES.length },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get status', details: String(error) },
      { status: 500 }
    );
  }
}
