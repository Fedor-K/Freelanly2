import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  enrichCompanies,
  enrichAllPendingCompanies,
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

      // Now enrich all
      console.log('Starting enrichment for ALL companies...');
      const stats = await enrichAllPendingCompanies();
      return NextResponse.json({
        success: true,
        message: `Reset ${resetResult.count} companies and re-enriched`,
        stats,
      });
    }

    if (all) {
      console.log('Starting enrichment for ALL pending companies...');
      const stats = await enrichAllPendingCompanies();
      return NextResponse.json({
        success: true,
        message: 'Enriched all pending companies',
        stats,
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
