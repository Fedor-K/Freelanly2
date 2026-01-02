import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Source } from '@prisma/client';
import { getAvailableSourceTypes, validateDataSource, buildAtsApiUrl } from '@/services/sources';
import { getSourcesOverview, getAvailableTags } from '@/services/source-scoring';

// GET /api/admin/sources - List all data sources with stats
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sortBy = searchParams.get('sortBy') || 'name';
    const sortOrder = searchParams.get('sortOrder') || 'asc';
    const filterTag = searchParams.get('tag');
    const filterStatus = searchParams.get('status'); // active, paused, all
    const filterQuality = searchParams.get('quality'); // high, medium, low

    // Build where clause
    const where: Record<string, unknown> = {};
    if (filterTag && filterTag !== 'all') {
      where.tags = { has: filterTag };
    }
    if (filterStatus === 'active') {
      where.isActive = true;
    } else if (filterStatus === 'paused') {
      where.isActive = false;
    }
    if (filterQuality && filterQuality !== 'all') {
      where.qualityStatus = filterQuality;
    }

    // Build orderBy
    const orderBy: Record<string, string>[] = [];
    if (sortBy === 'score') {
      orderBy.push({ score: sortOrder === 'asc' ? 'asc' : 'desc' });
    } else if (sortBy === 'totalImported') {
      orderBy.push({ totalImported: sortOrder === 'asc' ? 'asc' : 'desc' });
    } else if (sortBy === 'lastRunAt') {
      orderBy.push({ lastRunAt: sortOrder === 'asc' ? 'asc' : 'desc' });
    } else {
      orderBy.push({ name: 'asc' });
    }

    const sources = await prisma.dataSource.findMany({
      where,
      orderBy,
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

    // Calculate stats for each source
    const sourcesWithStats = sources.map((source) => {
      const lastLog = source.importLogs[0];

      return {
        id: source.id,
        name: source.name,
        sourceType: source.sourceType,
        companySlug: source.companySlug,
        apiUrl: source.apiUrl,  // For detecting Lever EU region
        isActive: source.isActive,
        lastRunAt: lastLog?.startedAt || null,
        lastSuccessAt: lastLog?.status === 'COMPLETED' ? lastLog.completedAt : null,
        totalImported: source.totalImported,
        lastCreated: lastLog?._count?.importedJobs || 0,
        lastSkipped: lastLog?._count?.filteredJobs || 0,
        lastFetched: source.lastFetched,
        lastError: lastLog?.status === 'FAILED' && lastLog.errors
          ? (Array.isArray(lastLog.errors) ? (lastLog.errors as string[])[0] : String(lastLog.errors))
          : null,
        errorCount: source.errorCount,
        // New scoring fields
        tags: source.tags,
        score: source.score,
        conversionRate: source.conversionRate,
        qualityStatus: source.qualityStatus,
        weeklyImported: source.weeklyImported,
        lastScoreAt: source.lastScoreAt,
      };
    });

    // Group by source type
    const grouped: Record<string, typeof sourcesWithStats> = {};
    for (const source of sourcesWithStats) {
      if (!grouped[source.sourceType]) {
        grouped[source.sourceType] = [];
      }
      grouped[source.sourceType].push(source);
    }

    // Get overview stats and available tags
    const [overview, availableTags] = await Promise.all([
      getSourcesOverview(),
      getAvailableTags(),
    ]);

    return NextResponse.json({
      sources: sourcesWithStats,
      grouped,
      sourceTypes: getAvailableSourceTypes(),
      overview,
      availableTags,
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

    // Validate the source (pass apiUrl for Lever EU sources)
    const validation = await validateDataSource(sourceType as Source, companySlug, apiUrl);
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
