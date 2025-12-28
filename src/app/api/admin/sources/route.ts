import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Source } from '@prisma/client';
import { getAvailableSourceTypes, validateDataSource, buildAtsApiUrl } from '@/services/sources';

// GET /api/admin/sources - List all data sources with stats
export async function GET() {
  try {
    const sources = await prisma.dataSource.findMany({
      orderBy: [
        { sourceType: 'asc' },
        { name: 'asc' },
      ],
      include: {
        importLogs: {
          orderBy: { startedAt: 'desc' },
          take: 1,
          include: {
            _count: {
              select: {
                importedJobs: true,
                filteredJobs: true,
              },
            },
          },
        },
      },
    });

    // Calculate total imported and last run stats
    const sourcesWithStats = await Promise.all(
      sources.map(async (source) => {
        // Get total imported jobs count
        const totalImported = await prisma.importedJob.count({
          where: {
            importLog: {
              dataSourceId: source.id,
            },
          },
        });

        const lastLog = source.importLogs[0];

        return {
          id: source.id,
          name: source.name,
          sourceType: source.sourceType,
          companySlug: source.companySlug,
          isActive: source.isActive,
          lastRunAt: lastLog?.startedAt || null,
          lastSuccessAt: lastLog?.status === 'COMPLETED' ? lastLog.completedAt : null,
          totalImported,
          lastCreated: lastLog?._count?.importedJobs || 0,
          lastSkipped: lastLog?._count?.filteredJobs || 0,
          lastError: lastLog?.status === 'FAILED' ? lastLog.errorMessage : null,
          errorCount: 0, // Could calculate from logs if needed
        };
      })
    );

    // Group by source type
    const grouped: Record<string, typeof sourcesWithStats> = {};
    for (const source of sourcesWithStats) {
      if (!grouped[source.sourceType]) {
        grouped[source.sourceType] = [];
      }
      grouped[source.sourceType].push(source);
    }

    return NextResponse.json({
      sources: sourcesWithStats,
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
