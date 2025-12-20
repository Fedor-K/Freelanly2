import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Source } from '@prisma/client';
import { getAvailableSourceTypes, validateDataSource, buildAtsApiUrl } from '@/services/sources';

// GET /api/admin/sources - List all data sources
export async function GET() {
  try {
    const sources = await prisma.dataSource.findMany({
      orderBy: [
        { sourceType: 'asc' },
        { name: 'asc' },
      ],
    });

    // Group by source type
    const grouped: Record<string, typeof sources> = {};
    for (const source of sources) {
      if (!grouped[source.sourceType]) {
        grouped[source.sourceType] = [];
      }
      grouped[source.sourceType].push(source);
    }

    return NextResponse.json({
      sources,
      grouped,
      sourceTypes: getAvailableSourceTypes(),
    });
  } catch (error) {
    console.error('Failed to fetch sources:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sources', details: String(error) },
      { status: 500 }
    );
  }
}

// POST /api/admin/sources - Create a new data source
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceType, companySlug, name, apiUrl, config } = body;

    if (!sourceType) {
      return NextResponse.json(
        { error: 'sourceType is required' },
        { status: 400 }
      );
    }

    // Check if source type is valid
    const availableTypes = getAvailableSourceTypes();
    const typeConfig = availableTypes.find(t => t.type === sourceType);
    if (!typeConfig) {
      return NextResponse.json(
        { error: 'Invalid source type' },
        { status: 400 }
      );
    }

    // Validate company slug for ATS sources
    if (typeConfig.requiresSlug && !companySlug) {
      return NextResponse.json(
        { error: 'companySlug is required for ATS sources' },
        { status: 400 }
      );
    }

    // Check for duplicates
    const existingSource = await prisma.dataSource.findFirst({
      where: {
        sourceType: sourceType as Source,
        companySlug: companySlug || null,
      },
    });

    if (existingSource) {
      return NextResponse.json(
        { error: 'A source with this configuration already exists' },
        { status: 409 }
      );
    }

    // Validate the source
    const validation = await validateDataSource(sourceType as Source, companySlug);
    if (!validation.valid) {
      return NextResponse.json(
        { error: `Invalid source: ${validation.error}` },
        { status: 400 }
      );
    }

    // Build API URL for ATS sources
    let finalApiUrl = apiUrl;
    if (!finalApiUrl && typeConfig.requiresSlug && companySlug) {
      try {
        finalApiUrl = buildAtsApiUrl(sourceType as Source, companySlug);
      } catch {
        // URL template not available
      }
    }

    // Create the source
    const dataSource = await prisma.dataSource.create({
      data: {
        name: name || validation.name || companySlug || typeConfig.name,
        sourceType: sourceType as Source,
        companySlug: companySlug || null,
        apiUrl: finalApiUrl,
        config: config || null,
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      source: dataSource,
      validation,
    });
  } catch (error) {
    console.error('Failed to create source:', error);
    return NextResponse.json(
      { error: 'Failed to create source', details: String(error) },
      { status: 500 }
    );
  }
}
