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
 *
 * Usage:
 *   this.addStage(new AgeFilterStage());
 *   this.addStage(new DuplicateFilterStage());
 *   this.addStage(new WhitelistFilterStage());
 * ============================================================================
 */

import { getMaxJobAgeDate } from '@/lib/utils';
import { shouldImportByProfession } from '@/config/target-professions';
import type { FilterStage, FilterableJob, FilterContext, FilterStageResult } from './filter-stage';
import type { FilterReason } from '@prisma/client';

/**
 * Age Filter Stage
 *
 * Filters out jobs older than MAX_JOB_AGE_DAYS (7 days).
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
