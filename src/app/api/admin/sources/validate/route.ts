import { NextRequest, NextResponse } from 'next/server';
import { Source } from '@prisma/client';
import { prisma } from '@/lib/db';
import { validateDataSource } from '@/services/sources';

// POST /api/admin/sources/validate - Validate a source before adding
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceType, companySlug, apiUrl } = body;

    if (!sourceType) {
      return NextResponse.json(
        { error: 'sourceType is required' },
        { status: 400 }
      );
    }

    // Check if source already exists in database
    if (companySlug) {
      const existing = await prisma.dataSource.findFirst({
        where: {
          sourceType: sourceType as Source,
          companySlug: companySlug,
        },
      });
      if (existing) {
        return NextResponse.json({ valid: false, error: 'Already added' });
      }
    }

    // Pass apiUrl for Lever EU sources (api.eu.lever.co)
    const result = await validateDataSource(sourceType as Source, companySlug, apiUrl);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { valid: false, error: String(error) },
      { status: 500 }
    );
  }
}
