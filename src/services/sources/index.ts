import { prisma } from '@/lib/db';
import { Source } from '@prisma/client';
import type { ProcessingStats, ProcessorContext } from './types';
import { processLeverSource } from './lever-processor';
import { notifySearchEngines } from '@/lib/indexing';

export * from './types';

// Map source types to their processors
const SOURCE_PROCESSORS: Partial<Record<Source, (context: ProcessorContext) => Promise<ProcessingStats>>> = {
  LEVER: processLeverSource,
  // TODO: Add more processors
  // GREENHOUSE: processGreenhouseSource,
  // ASHBY: processAshbySource,
};

// Process a single data source
export async function processDataSource(dataSourceId: string): Promise<ProcessingStats> {
  const dataSource = await prisma.dataSource.findUnique({
    where: { id: dataSourceId },
  });

  if (!dataSource) {
    throw new Error(`Data source not found: ${dataSourceId}`);
  }

  if (!dataSource.isActive) {
    throw new Error(`Data source is not active: ${dataSource.name}`);
  }

  const processor = SOURCE_PROCESSORS[dataSource.sourceType];
  if (!processor) {
    throw new Error(`No processor for source type: ${dataSource.sourceType}`);
  }

  console.log(`[Sources] Processing: ${dataSource.name} (${dataSource.sourceType})`);

  // Create import log
  const importLog = await prisma.importLog.create({
    data: {
      source: dataSource.sourceType,
      dataSourceId: dataSourceId,
      status: 'RUNNING',
    },
  });

  try {
    const stats = await processor({ importLogId: importLog.id, dataSourceId });

    // Create ImportedJob records for tracking
    if (stats.createdJobIds && stats.createdJobIds.length > 0) {
      await prisma.importedJob.createMany({
        data: stats.createdJobIds.map((jobId) => ({
          importLogId: importLog.id,
          jobId,
        })),
        skipDuplicates: true,
      });
    }

    // Update import log
    await prisma.importLog.update({
      where: { id: importLog.id },
      data: {
        status: 'COMPLETED',
        totalFetched: stats.total,
        totalNew: stats.created,
        totalUpdated: stats.updated,
        totalSkipped: stats.skipped,
        totalFailed: stats.failed,
        errors: stats.errors.length > 0 ? stats.errors : undefined,
        completedAt: new Date(),
      },
    });

    // Notify search engines about new jobs (IndexNow + Google)
    if (stats.createdJobUrls && stats.createdJobUrls.length > 0) {
      try {
        await notifySearchEngines(stats.createdJobUrls);
      } catch (indexError) {
        console.error('[Sources] Search engine notification failed:', indexError);
        // Don't fail the whole import if indexing fails
      }
    }

    console.log(`[Sources] Completed ${dataSource.name}: ${stats.created} created, ${stats.skipped} skipped, ${stats.failed} failed`);
    return stats;
  } catch (error) {
    await prisma.importLog.update({
      where: { id: importLog.id },
      data: {
        status: 'FAILED',
        errors: [String(error)],
        completedAt: new Date(),
      },
    });

    throw error;
  }
}

// Process all active data sources
export async function processAllSources(): Promise<Record<string, ProcessingStats>> {
  const results: Record<string, ProcessingStats> = {};

  const activeSources = await prisma.dataSource.findMany({
    where: { isActive: true },
    orderBy: { lastRunAt: 'asc' }, // Process oldest first
  });

  console.log(`[Sources] Processing ${activeSources.length} active sources`);

  for (const source of activeSources) {
    // Check rate limiting
    if (source.lastRunAt) {
      const secondsSinceLastRun = (Date.now() - source.lastRunAt.getTime()) / 1000;
      if (secondsSinceLastRun < source.minInterval) {
        console.log(`[Sources] Skipping ${source.name}: rate limited (${Math.round(secondsSinceLastRun)}s < ${source.minInterval}s)`);
        continue;
      }
    }

    try {
      results[source.id] = await processDataSource(source.id);
    } catch (error) {
      console.error(`[Sources] Error processing ${source.name}:`, error);
      results[source.id] = {
        total: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        failed: 1,
        errors: [String(error)],
      };
    }

    // Small delay between sources
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return results;
}

// Validate a data source configuration
export async function validateDataSource(sourceType: Source, companySlug?: string, apiUrl?: string): Promise<{
  valid: boolean;
  name?: string;
  jobCount?: number;
  error?: string;
}> {
  try {
    if (sourceType === 'LEVER' && companySlug) {
      // Support both US (api.lever.co) and EU (api.eu.lever.co) regions
      const leverApiUrl = apiUrl || `https://api.lever.co/v0/postings/${companySlug}?mode=json`;
      const response = await fetch(leverApiUrl);
      if (!response.ok) {
        return { valid: false, error: `Lever API returned ${response.status}` };
      }
      const jobs = await response.json();
      return {
        valid: true,
        name: companySlug,
        jobCount: Array.isArray(jobs) ? jobs.length : 0,
      };
    }

    if (sourceType === 'GREENHOUSE' && companySlug) {
      const response = await fetch(`https://boards-api.greenhouse.io/v1/boards/${companySlug}/jobs`);
      if (!response.ok) {
        return { valid: false, error: `Greenhouse API returned ${response.status}` };
      }
      const data = await response.json();
      return {
        valid: true,
        name: companySlug,
        jobCount: data.jobs?.length || 0,
      };
    }

    if (sourceType === 'ASHBY' && companySlug) {
      const response = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${companySlug}`);
      if (!response.ok) {
        return { valid: false, error: `Ashby API returned ${response.status}` };
      }
      const data = await response.json();
      return {
        valid: true,
        name: companySlug,
        jobCount: data.jobs?.length || 0,
      };
    }

    return { valid: false, error: 'Unknown source type' };
  } catch (error) {
    return { valid: false, error: String(error) };
  }
}

// Get available source types
export function getAvailableSourceTypes(): { type: Source; name: string; isAts: boolean; requiresSlug: boolean }[] {
  return [
    // ATS sources
    { type: 'LEVER', name: 'Lever', isAts: true, requiresSlug: true },
    { type: 'GREENHOUSE', name: 'Greenhouse', isAts: true, requiresSlug: true },
    { type: 'ASHBY', name: 'Ashby', isAts: true, requiresSlug: true },
    { type: 'WORKABLE', name: 'Workable', isAts: true, requiresSlug: true },
    { type: 'SMARTRECRUITERS', name: 'SmartRecruiters', isAts: true, requiresSlug: true },
    // LinkedIn (via Apify)
    { type: 'LINKEDIN', name: 'LinkedIn (Apify)', isAts: false, requiresSlug: false },
  ];
}
