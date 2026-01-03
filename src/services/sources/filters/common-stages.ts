/**
 * ============================================================================
 * COMMON FILTER STAGES
 * ============================================================================
 *
 * Reusable filter stages that can be used by any source pipeline.
 *
 * Stages:
 * - AgeFilterStage: Filter jobs older than MAX_JOB_AGE_DAYS
 * - DuplicateFilterStage: Filter jobs that already exist in database
 * - WhitelistFilterStage: Filter jobs not matching target professions
 * - AIFilterStage: AI-based second level filter (Z.ai/DeepSeek)
 *
 * Usage:
 *   this.addStage(new AgeFilterStage());
 *   this.addStage(new DuplicateFilterStage());
 *   this.addStage(new WhitelistFilterStage());
 *   this.addStage(new AIFilterStage()); // Optional: AI verification
 * ============================================================================
 */

import { getMaxJobAgeDate } from '@/lib/utils';
import { shouldImportByProfession } from '@/config/target-professions';
import { isTargetRemoteJob } from '@/lib/deepseek';
import type { FilterStage, FilterableJob, FilterContext, FilterStageResult } from './filter-stage';
import type { FilterReason } from '@prisma/client';

/**
 * Age Filter Stage
 *
 * Filters out jobs older than MAX_JOB_AGE_DAYS (14 days).
 * Uses TOO_OLD as the filter reason.
 */
export class AgeFilterStage<T extends FilterableJob> implements FilterStage<T> {
  name = 'AgeFilter';

  async filter(jobs: T[], _context: FilterContext): Promise<FilterStageResult<T>> {
    const maxAgeDate = getMaxJobAgeDate();
    const passed: T[] = [];
    const rejected: Array<{ job: T; reason: FilterReason }> = [];

    for (const job of jobs) {
      const jobDate = job.createdAt instanceof Date
        ? job.createdAt
        : new Date(job.createdAt);

      if (jobDate >= maxAgeDate) {
        passed.push(job);
      } else {
        rejected.push({ job, reason: 'TOO_OLD' });
      }
    }

    return { passed, rejected };
  }
}

/**
 * Duplicate Filter Stage
 *
 * Filters out jobs that already exist in the database.
 * Checks both sourceId and sourceUrl.
 * Uses DUPLICATE as the filter reason.
 *
 * Requires context.existingSourceIds and context.existingSourceUrls
 */
export class DuplicateFilterStage<T extends FilterableJob> implements FilterStage<T> {
  name = 'DuplicateFilter';

  async filter(jobs: T[], context: FilterContext): Promise<FilterStageResult<T>> {
    const existingSourceIds = context.existingSourceIds || new Set<string>();
    const existingSourceUrls = context.existingSourceUrls || new Set<string>();

    const passed: T[] = [];
    const rejected: Array<{ job: T; reason: FilterReason }> = [];

    for (const job of jobs) {
      if (existingSourceIds.has(job.id) || existingSourceUrls.has(job.sourceUrl)) {
        rejected.push({ job, reason: 'DUPLICATE' });
      } else {
        passed.push(job);
      }
    }

    return { passed, rejected };
  }
}

/**
 * Whitelist Filter Stage
 *
 * Filters jobs based on target profession whitelist/blacklist.
 * Uses shouldImportByProfession() from target-professions.ts.
 * Uses NON_TARGET_TITLE as the filter reason.
 */
export class WhitelistFilterStage<T extends FilterableJob> implements FilterStage<T> {
  name = 'WhitelistFilter';

  async filter(jobs: T[], _context: FilterContext): Promise<FilterStageResult<T>> {
    const passed: T[] = [];
    const rejected: Array<{ job: T; reason: FilterReason }> = [];

    for (const job of jobs) {
      if (shouldImportByProfession(job.title)) {
        passed.push(job);
      } else {
        rejected.push({ job, reason: 'NON_TARGET_TITLE' });
      }
    }

    return { passed, rejected };
  }
}

/**
 * AI Filter Stage
 *
 * Second-level AI verification for jobs that passed whitelist.
 * Uses Z.ai/DeepSeek to verify job relevance.
 * Uses AI_REJECTED as the filter reason.
 *
 * Enable via: AI_FILTER_ENABLED=true
 *
 * Cost: ~$0.00001 per job with Z.ai GLM-4-32B
 */
export class AIFilterStage<T extends FilterableJob> implements FilterStage<T> {
  name = 'AIFilter';

  async filter(jobs: T[], _context: FilterContext): Promise<FilterStageResult<T>> {
    // Check if AI filter is enabled
    const enabled = process.env.AI_FILTER_ENABLED === 'true';
    if (!enabled) {
      console.log('[AIFilter] Disabled (set AI_FILTER_ENABLED=true to enable)');
      return { passed: jobs, rejected: [] };
    }

    const passed: T[] = [];
    const rejected: Array<{ job: T; reason: FilterReason }> = [];

    console.log(`[AIFilter] Verifying ${jobs.length} jobs with AI...`);

    for (const job of jobs) {
      try {
        const result = await isTargetRemoteJob(job.title);

        if (result.import) {
          passed.push(job);
        } else {
          rejected.push({ job, reason: 'AI_REJECTED' });
          console.log(`[AIFilter] Rejected: "${job.title}" - ${result.reason}`);
        }

        // Rate limit: 100ms between requests
        await new Promise(r => setTimeout(r, 100));
      } catch (error) {
        // On error, let job pass (be permissive)
        console.error(`[AIFilter] Error checking "${job.title}":`, error);
        passed.push(job);
      }
    }

    console.log(`[AIFilter] Passed: ${passed.length}, Rejected: ${rejected.length}`);
    return { passed, rejected };
  }
}
