import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Source } from '@prisma/client';
import { getAvailableSourceTypes, validateDataSource, buildAtsApiUrl } from '@/services/sources';
import { getSourcesOverview, getAvailableTags } from '@/services/source-scoring';

// GET /api/admin/sources - List data sources with pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sortBy = searchParams.get('sortBy') || 'name';
    const sortOrder = searchParams.get('sortOrder') || 'asc';
    const filterTag = searchParams.get('tag');
    const filterStatus = searchParams.get('status') || 'active'; // Default to active
    const filterQuality = searchParams.get('quality');
    const search = searchParams.get('search')?.toLowerCase();

    // Pagination params
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const skip = (page - 1) * limit;

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
    // 'all' = no filter
    if (filterQuality && filterQuality !== 'all') {
      where.qualityStatus = filterQuality;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { companySlug: { contains: search, mode: 'insensitive' } },
      ];
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

    // Get total count and paginated sources in parallel
    const [totalCount, sources] = await Promise.all([
      prisma.dataSource.count({ where }),
      prisma.dataSource.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        // No importLogs - use denormalized fields from DataSource
      }),
    ]);

    // Map sources to response format (using denormalized fields)
    const sourcesWithStats = sources.map((source) => ({
      id: source.id,
      name: source.name,
      sourceType: source.sourceType,
      companySlug: source.companySlug,
      apiUrl: source.apiUrl,
      isActive: source.isActive,
      lastRunAt: source.lastRunAt,
      lastSuccessAt: source.lastSuccessAt,
      totalImported: source.totalImported,
      lastCreated: source.lastCreated,
      lastFetched: source.lastFetched,
      lastError: source.lastError,
      errorCount: source.errorCount,
      tags: source.tags,
      score: source.score,
      conversionRate: source.conversionRate,
      qualityStatus: source.qualityStatus,
      weeklyImported: source.weeklyImported,
      lastScoreAt: source.lastScoreAt,
    }));

    // Get overview stats and available tags (cached/fast)
    const [overview, availableTags] = await Promise.all([
      getSourcesOverview(),
      getAvailableTags(),
    ]);

    return NextResponse.json({
      sources: sourcesWithStats,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: page * limit < totalCount,
        hasPrev: page > 1,
      },
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
