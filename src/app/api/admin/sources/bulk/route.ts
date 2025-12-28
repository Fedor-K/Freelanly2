import { NextRequest, NextResponse } from 'next/server';
import {
  recalculateAllScores,
  bulkUpdateSources,
  bulkAddTag,
} from '@/services/source-scoring';
import { processDataSource } from '@/services/sources';
import { prisma } from '@/lib/db';

// POST /api/admin/sources/bulk - Bulk operations on sources
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ids, filter, data } = body;

    switch (action) {
      case 'recalculate-scores': {
        const result = await recalculateAllScores();
        return NextResponse.json({
          success: true,
          message: `Recalculated scores for ${result.updated} sources`,
          result,
        });
      }

      case 'enable': {
        const count = await bulkUpdateSources({
          ids,
          filter,
          update: { isActive: true },
        });
        return NextResponse.json({
          success: true,
          message: `Enabled ${count} sources`,
          count,
        });
      }

      case 'disable': {
        const count = await bulkUpdateSources({
          ids,
          filter,
          update: { isActive: false },
        });
        return NextResponse.json({
          success: true,
          message: `Disabled ${count} sources`,
          count,
        });
      }

      case 'add-tag': {
        if (!data?.tag) {
          return NextResponse.json(
            { error: 'Tag is required' },
            { status: 400 }
          );
        }
        const count = await bulkAddTag({
          ids,
          filter,
          tag: data.tag,
        });
        return NextResponse.json({
          success: true,
          message: `Added tag "${data.tag}" to ${count} sources`,
          count,
        });
      }

      case 'run-all': {
        // Get sources to run
        const where: Record<string, unknown> = { isActive: true };
        if (filter?.tag) {
          where.tags = { has: filter.tag };
        }
        if (filter?.qualityStatus) {
          where.qualityStatus = filter.qualityStatus;
        }

        const sources = await prisma.dataSource.findMany({
          where,
          select: { id: true, name: true },
          orderBy: { lastRunAt: 'asc' },
        });

        const results: { id: string; name: string; success: boolean; error?: string }[] = [];

        for (const source of sources) {
          try {
            await processDataSource(source.id);
            results.push({ id: source.id, name: source.name, success: true });
          } catch (error) {
            results.push({
              id: source.id,
              name: source.name,
              success: false,
              error: String(error),
            });
          }
          // Small delay between runs
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;

        return NextResponse.json({
          success: true,
          message: `Ran ${sources.length} sources: ${successCount} succeeded, ${failCount} failed`,
          results,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Bulk operation failed:', error);
    return NextResponse.json(
      { error: 'Bulk operation failed', details: String(error) },
      { status: 500 }
    );
  }
}
