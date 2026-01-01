/**
 * ============================================================================
 * LEVER FILTER PIPELINE
 * ============================================================================
 *
 * Lever-specific implementation of the filter pipeline.
 *
 * Stages:
 * 1. AgeFilter - skip jobs older than 7 days
 * 2. DuplicateFilter - skip jobs already in database
 * 3. WhitelistFilter - skip non-target professions
 *
 * Usage:
 * ```typescript
 * const pipeline = new LeverFilterPipeline('Company Name');
 * const result = await pipeline.processLeverJobs(
 *   jobs,
 *   existingSourceIds,
 *   existingSourceUrls
 * );
 * ```
 * ============================================================================
 */

import { BaseFilterPipeline } from './base-filter-pipeline';
import {
  AgeFilterStage,
  DuplicateFilterStage,
  WhitelistFilterStage,
} from './common-stages';
import type { FilterableJob, PipelineResult } from './filter-stage';
import type { LeverJob } from '../types';

/**
 * Extended FilterableJob that preserves original Lever job data
 */
export interface LeverFilterableJob extends FilterableJob {
  _raw: LeverJob;
}

/**
 * Convert LeverJob to FilterableJob format
 */
function toLeverFilterable(job: LeverJob): LeverFilterableJob {
  return {
    id: job.id,
    title: job.text,
    sourceUrl: job.hostedUrl,
    location: job.categories.location || null,
    createdAt: job.createdAt,  // Unix timestamp in ms
    _raw: job,
  };
}

/**
 * Lever Filter Pipeline
 *
 * Configures the standard filter stages for Lever ATS:
 * 1. Age filter (7 days max)
 * 2. Duplicate filter
 * 3. Whitelist filter
 */
export class LeverFilterPipeline extends BaseFilterPipeline<LeverFilterableJob> {
  constructor(companyName: string) {
    super(companyName);

    // Configure stages in order
    this.addStage(new AgeFilterStage());
    this.addStage(new DuplicateFilterStage());
    this.addStage(new WhitelistFilterStage());
  }

  /**
   * Process raw Lever jobs through the pipeline
   *
   * @param jobs - Raw jobs from Lever API
   * @param existingSourceIds - Set of sourceIds already in database
   * @param existingSourceUrls - Set of sourceUrls already in database
   * @returns Pipeline result with original LeverJob objects
   */
  async processLeverJobs(
    jobs: LeverJob[],
    existingSourceIds: Set<string>,
    existingSourceUrls: Set<string>
  ): Promise<PipelineResult<LeverFilterableJob> & { originalJobs: LeverJob[] }> {
    // Convert to filterable format
    const filterableJobs = jobs.map(toLeverFilterable);

    // Run pipeline with context
    const result = await this.run(filterableJobs, {
      existingSourceIds,
      existingSourceUrls,
    });

    // Extract original LeverJob objects for further processing
    return {
      ...result,
      originalJobs: result.jobsToProcess.map(j => j._raw),
    };
  }
}
