/**
 * ============================================================================
 * FILTER STAGE INTERFACES
 * ============================================================================
 *
 * Defines the contract for filter stages in the pipeline.
 * Each stage can filter jobs based on specific criteria.
 *
 * Used by: BaseFilterPipeline, all source-specific pipelines
 * ============================================================================
 */

import type { FilterReason } from '@prisma/client';

/**
 * Generic job interface - each source maps to this
 * Contains minimum required fields for filtering
 */
export interface FilterableJob {
  id: string;
  title: string;
  sourceUrl: string;
  location?: string | null;
  createdAt: number | Date;  // Unix timestamp (ms) or Date object
}

/**
 * Filtered job data for database storage
 */
export interface FilteredJobData {
  title: string;
  company: string;
  location: string | null;
  sourceUrl: string;
  reason: FilterReason;
}

/**
 * Context passed to filter stages
 * Can be extended with source-specific data
 */
export interface FilterContext {
  companyName: string;
  existingSourceIds?: Set<string>;
  existingSourceUrls?: Set<string>;
  // Extensible for source-specific context
  [key: string]: unknown;
}

/**
 * Result of a single filter stage
 */
export interface FilterStageResult<T> {
  passed: T[];
  rejected: Array<{ job: T; reason: FilterReason }>;
}

/**
 * Filter stage interface
 * Each stage implements this to provide filtering logic
 */
export interface FilterStage<T extends FilterableJob = FilterableJob> {
  /** Stage name for logging */
  name: string;

  /**
   * Filter a batch of jobs
   * @param jobs - Jobs to filter
   * @param context - Filter context with company info and existing IDs
   * @returns Jobs that passed and rejected with reasons
   */
  filter(jobs: T[], context: FilterContext): Promise<FilterStageResult<T>>;
}

/**
 * Pipeline statistics
 */
export interface PipelineStats {
  totalInput: number;
  stageStats: Record<string, number>;  // stage name → rejected count
  totalRejected: number;
  totalPassed: number;
}

/**
 * Pipeline result returned after all stages complete
 */
export interface PipelineResult<T extends FilterableJob> {
  jobsToProcess: T[];
  filteredJobs: FilteredJobData[];
  stats: PipelineStats;
  verified: boolean;
}
