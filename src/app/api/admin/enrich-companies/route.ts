import { NextResponse } from 'next/server';
import {
  enrichCompanies,
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
    const limit = body.limit || 10;

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
