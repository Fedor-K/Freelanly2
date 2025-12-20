import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  enrichCompanies,
  enrichAllPendingCompanies,
  enrichCompaniesByName,
  getEnrichmentStatus,
  getCompaniesForEnrichment,
} from '@/services/company-enrichment';

// GET - Get enrichment status and preview companies to enrich
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const preview = searchParams.get('preview') === 'true';
    const limit = parseInt(searchParams.get('limit') || '10');

    const status = await getEnrichmentStatus();

    if (preview) {
      const companies = await getCompaniesForEnrichment(limit);
      return NextResponse.json({
        status,
        preview: companies,
      });
    }

    return NextResponse.json({ status });
  } catch (error) {
    console.error('Error getting enrichment status:', error);
    return NextResponse.json(
      { error: 'Failed to get enrichment status' },
      { status: 500 }
    );
  }
}

// POST - Run company enrichment
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const all = body.all === true;
    const reset = body.reset === true;
    const byName = body.byName === true; // Enrich by company name/website
    const limit = body.limit || 10;

    // Reset all companies for re-enrichment
    if (reset) {
      console.log('Resetting all companies for re-enrichment...');
      const resetResult = await prisma.company.updateMany({
        where: {
          logo: { not: null },
        },
        data: {
          logo: null,
        },
      });
      console.log(`Reset ${resetResult.count} companies`);

      // Now enrich all by name (since reset clears all)
      console.log('Starting enrichment for ALL companies by name...');
      const stats = await enrichCompaniesByName(500);
      return NextResponse.json({
        success: true,
        message: `Reset ${resetResult.count} companies and re-enriched`,
        stats,
      });
    }

    // Enrich by company name/website (for companies without email)
    if (byName) {
      console.log(`Enriching companies by name/website (limit: ${limit})...`);
      const stats = await enrichCompaniesByName(limit);
      return NextResponse.json({
        success: true,
        message: 'Enriched companies by name/website',
        stats,
      });
    }

    if (all) {
      console.log('Starting enrichment for ALL pending companies...');
      // First try by email domain
      const emailStats = await enrichAllPendingCompanies();
      // Then try remaining by name
      const nameStats = await enrichCompaniesByName(500);

      return NextResponse.json({
        success: true,
        message: 'Enriched all pending companies',
        stats: {
          byEmail: emailStats,
          byName: nameStats,
          total: {
            enriched: emailStats.enriched + nameStats.enriched,
            skipped: emailStats.skipped + nameStats.skipped,
            failed: emailStats.failed + nameStats.failed,
          },
        },
      });
    }

    console.log(`Starting company enrichment for ${limit} companies...`);
    const stats = await enrichCompanies(limit);

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Error running company enrichment:', error);
    return NextResponse.json(
      { error: 'Failed to run company enrichment', details: String(error) },
      { status: 500 }
    );
  }
}
