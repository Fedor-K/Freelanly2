/**
 * Source Scoring Service
 *
 * Calculates quality scores for data sources based on:
 * - Conversion rate (40%): % of fetched jobs that pass whitelist
 * - Activity (30%): jobs imported in last 7 days
 * - Stability (30%): error count and consistency
 */

import { prisma } from '@/lib/db';

// Score weights
const WEIGHT_CONVERSION = 0.4;
const WEIGHT_ACTIVITY = 0.3;
const WEIGHT_STABILITY = 0.3;

// Thresholds for activity scoring
const MAX_WEEKLY_FOR_100 = 50; // 50+ jobs/week = 100% activity score

// Quality status thresholds
const THRESHOLD_HIGH = 70;
const THRESHOLD_MEDIUM = 40;

export interface SourceScore {
  score: number;
  conversionRate: number;
  qualityStatus: 'high' | 'medium' | 'low';
  breakdown: {
    conversionScore: number;
    activityScore: number;
    stabilityScore: number;
  };
}

/**
 * Calculate score for a single source
 */
export function calculateScore(params: {
  totalImported: number;
  lastFetched: number;
  weeklyImported: number;
  errorCount: number;
  totalRuns?: number;
}): SourceScore {
  const { totalImported, lastFetched, weeklyImported, errorCount, totalRuns = 1 } = params;

  // 1. Conversion Rate (0-100)
  // If we have lastFetched data, use it. Otherwise estimate from totalImported
  let conversionRate = 0;
  if (lastFetched > 0) {
    conversionRate = Math.min(100, (totalImported / lastFetched) * 100);
  } else if (totalImported > 0) {
    // Assume ~50% conversion if we don't have fetch data
    conversionRate = 50;
  }
  const conversionScore = conversionRate;

  // 2. Activity Score (0-100)
  // Based on jobs imported in last 7 days
  const activityScore = Math.min(100, (weeklyImported / MAX_WEEKLY_FOR_100) * 100);

  // 3. Stability Score (0-100)
  // Start at 100, reduce by 20 for each error (min 0)
  const stabilityScore = Math.max(0, 100 - (errorCount * 20));

  // Combined score
  const score = Math.round(
    conversionScore * WEIGHT_CONVERSION +
    activityScore * WEIGHT_ACTIVITY +
    stabilityScore * WEIGHT_STABILITY
  );

  // Quality status
  let qualityStatus: 'high' | 'medium' | 'low';
  if (score >= THRESHOLD_HIGH) {
    qualityStatus = 'high';
  } else if (score >= THRESHOLD_MEDIUM) {
    qualityStatus = 'medium';
  } else {
    qualityStatus = 'low';
  }

  return {
    score,
    conversionRate: Math.round(conversionRate * 10) / 10,
    qualityStatus,
    breakdown: {
      conversionScore: Math.round(conversionScore),
      activityScore: Math.round(activityScore),
      stabilityScore: Math.round(stabilityScore),
    },
  };
}

/**
 * Recalculate score for a single source and save to DB
 */
export async function recalculateSourceScore(sourceId: string): Promise<SourceScore> {
  const source = await prisma.dataSource.findUnique({
    where: { id: sourceId },
  });

  if (!source) {
    throw new Error(`Source not found: ${sourceId}`);
  }

  // Get weekly imported count
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const weeklyStats = await prisma.importLog.aggregate({
    where: {
      dataSourceId: sourceId,
      status: 'COMPLETED',
      completedAt: { gte: weekAgo },
    },
    _sum: {
      totalNew: true,
    },
  });

  const weeklyImported = weeklyStats._sum.totalNew || 0;

  // Calculate score
  const scoreData = calculateScore({
    totalImported: source.totalImported,
    lastFetched: source.lastFetched,
    weeklyImported,
    errorCount: source.errorCount,
  });

  // Update source
  await prisma.dataSource.update({
    where: { id: sourceId },
    data: {
      score: scoreData.score,
      conversionRate: scoreData.conversionRate,
      qualityStatus: scoreData.qualityStatus,
      weeklyImported,
      lastScoreAt: new Date(),
    },
  });

  return scoreData;
}

/**
 * Recalculate scores for all sources
 */
export async function recalculateAllScores(): Promise<{
  updated: number;
  high: number;
  medium: number;
  low: number;
}> {
  const sources = await prisma.dataSource.findMany({
    select: { id: true },
  });

  let high = 0;
  let medium = 0;
  let low = 0;

  for (const source of sources) {
    try {
      const scoreData = await recalculateSourceScore(source.id);
      if (scoreData.qualityStatus === 'high') high++;
      else if (scoreData.qualityStatus === 'medium') medium++;
      else low++;
    } catch (error) {
      console.error(`Failed to score source ${source.id}:`, error);
    }
  }

  return {
    updated: sources.length,
    high,
    medium,
    low,
  };
}

/**
 * Get sources overview statistics
 */
export async function getSourcesOverview(): Promise<{
  total: number;
  active: number;
  paused: number;
  withErrors: number;
  byQuality: {
    high: number;
    medium: number;
    low: number;
    unscored: number;
  };
  totalImported: number;
  weeklyImported: number;
}> {
  const [
    total,
    active,
    withErrors,
    byQuality,
    totalImportedAgg,
    weeklyImportedAgg,
  ] = await Promise.all([
    prisma.dataSource.count(),
    prisma.dataSource.count({ where: { isActive: true } }),
    prisma.dataSource.count({ where: { errorCount: { gt: 0 } } }),
    prisma.dataSource.groupBy({
      by: ['qualityStatus'],
      _count: true,
    }),
    prisma.dataSource.aggregate({
      _sum: { totalImported: true },
    }),
    prisma.dataSource.aggregate({
      _sum: { weeklyImported: true },
    }),
  ]);

  const qualityCounts = {
    high: 0,
    medium: 0,
    low: 0,
    unscored: 0,
  };

  for (const q of byQuality) {
    if (q.qualityStatus === 'high') qualityCounts.high = q._count;
    else if (q.qualityStatus === 'medium') qualityCounts.medium = q._count;
    else if (q.qualityStatus === 'low') qualityCounts.low = q._count;
    else qualityCounts.unscored += q._count;
  }

  return {
    total,
    active,
    paused: total - active,
    withErrors,
    byQuality: qualityCounts,
    totalImported: totalImportedAgg._sum.totalImported || 0,
    weeklyImported: weeklyImportedAgg._sum.weeklyImported || 0,
  };
}

/**
 * Get available tags from all sources
 */
export async function getAvailableTags(): Promise<string[]> {
  const sources = await prisma.dataSource.findMany({
    select: { tags: true },
    where: { tags: { isEmpty: false } },
  });

  const tagSet = new Set<string>();
  for (const source of sources) {
    for (const tag of source.tags) {
      tagSet.add(tag);
    }
  }

  return Array.from(tagSet).sort();
}

/**
 * Add tag to source
 */
export async function addTagToSource(sourceId: string, tag: string): Promise<void> {
  const source = await prisma.dataSource.findUnique({
    where: { id: sourceId },
    select: { tags: true },
  });

  if (!source) {
    throw new Error(`Source not found: ${sourceId}`);
  }

  const normalizedTag = tag.toLowerCase().trim();
  if (!source.tags.includes(normalizedTag)) {
    await prisma.dataSource.update({
      where: { id: sourceId },
      data: {
        tags: [...source.tags, normalizedTag],
      },
    });
  }
}

/**
 * Remove tag from source
 */
export async function removeTagFromSource(sourceId: string, tag: string): Promise<void> {
  const source = await prisma.dataSource.findUnique({
    where: { id: sourceId },
    select: { tags: true },
  });

  if (!source) {
    throw new Error(`Source not found: ${sourceId}`);
  }

  const normalizedTag = tag.toLowerCase().trim();
  await prisma.dataSource.update({
    where: { id: sourceId },
    data: {
      tags: source.tags.filter(t => t !== normalizedTag),
    },
  });
}

/**
 * Bulk enable/disable sources
 */
export async function bulkUpdateSources(params: {
  ids?: string[];
  filter?: {
    qualityStatus?: string;
    tag?: string;
    isActive?: boolean;
  };
  update: {
    isActive?: boolean;
  };
}): Promise<number> {
  const { ids, filter, update } = params;

  // Build where clause
  const where: Record<string, unknown> = {};

  if (ids && ids.length > 0) {
    where.id = { in: ids };
  }

  if (filter) {
    if (filter.qualityStatus) {
      where.qualityStatus = filter.qualityStatus;
    }
    if (filter.tag) {
      where.tags = { has: filter.tag };
    }
    if (filter.isActive !== undefined) {
      where.isActive = filter.isActive;
    }
  }

  const result = await prisma.dataSource.updateMany({
    where,
    data: update,
  });

  return result.count;
}

/**
 * Bulk add tag to sources
 */
export async function bulkAddTag(params: {
  ids?: string[];
  filter?: {
    qualityStatus?: string;
    isActive?: boolean;
  };
  tag: string;
}): Promise<number> {
  const { ids, filter, tag } = params;
  const normalizedTag = tag.toLowerCase().trim();

  // Get sources to update
  const where: Record<string, unknown> = {};

  if (ids && ids.length > 0) {
    where.id = { in: ids };
  }

  if (filter) {
    if (filter.qualityStatus) {
      where.qualityStatus = filter.qualityStatus;
    }
    if (filter.isActive !== undefined) {
      where.isActive = filter.isActive;
    }
  }

  const sources = await prisma.dataSource.findMany({
    where,
    select: { id: true, tags: true },
  });

  let updated = 0;
  for (const source of sources) {
    if (!source.tags.includes(normalizedTag)) {
      await prisma.dataSource.update({
        where: { id: source.id },
        data: {
          tags: [...source.tags, normalizedTag],
        },
      });
      updated++;
    }
  }

  return updated;
}
