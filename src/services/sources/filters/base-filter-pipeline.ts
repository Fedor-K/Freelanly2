/**
 * ============================================================================
 * BASE FILTER PIPELINE
 * ============================================================================
 *
 * Abstract base class for filtering jobs from any source.
 *
 * Features:
 * - Sequential stage execution
 * - Automatic filtered job collection
 * - Count verification (ensures no jobs are lost)
 * - Detailed logging
 *
 * Usage:
 * ```typescript
 * class MySourcePipeline extends BaseFilterPipeline<MyJob> {
 *   constructor(companyName: string) {
 *     super(companyName);
 *     this.addStage(new AgeFilterStage());
 *     this.addStage(new DuplicateFilterStage());
 *     this.addStage(new WhitelistFilterStage());
 *   }
 * }
 *
 * const pipeline = new MySourcePipeline('Company Name');
 * const result = await pipeline.run(jobs, { existingSourceIds, existingSourceUrls });
 * ```
 * ============================================================================
 */

import type { FilterReason } from '@prisma/client';
import type {
  FilterStage,
  FilterableJob,
  FilterContext,
  FilteredJobData,
  PipelineStats,
  PipelineResult,
} from './filter-stage';

/**
 * Base Filter Pipeline
 *
 * Provides common functionality for all source-specific pipelines.
 * Subclasses configure stages in their constructor.
 */
export abstract class BaseFilterPipeline<T extends FilterableJob> {
  protected stages: FilterStage<T>[] = [];
  protected filteredJobs: FilteredJobData[] = [];
  protected companyName: string;

  constructor(companyName: string) {
    this.companyName = companyName;
  }

  /**
   * Add a filter stage to the pipeline
   * Stages are executed in the order they are added
   */
  protected addStage(stage: FilterStage<T>): void {
    this.stages.push(stage);
  }

  /**
   * Run all filter stages sequentially
   *
   * @param jobs - Jobs to filter
   * @param context - Additional context (existing IDs, etc.)
   * @returns Pipeline result with filtered jobs and stats
   */
  async run(jobs: T[], context: Partial<FilterContext> = {}): Promise<PipelineResult<T>> {
    // Reset filtered jobs for this run
    this.filteredJobs = [];

    const fullContext: FilterContext = {
      companyName: this.companyName,
      ...context,
    };

    const stats: PipelineStats = {
      totalInput: jobs.length,
      stageStats: {},
      totalRejected: 0,
      totalPassed: 0,
    };

    let currentJobs = jobs;

    // Run each stage sequentially
    for (const stage of this.stages) {
      const stageStart = Date.now();

      try {
        const result = await stage.filter(currentJobs, fullContext);

        // Record rejected jobs
        for (const { job, reason } of result.rejected) {
          this.addFilteredJob(job, reason);
        }

        stats.stageStats[stage.name] = result.rejected.length;
        stats.totalRejected += result.rejected.length;
        currentJobs = result.passed;

        const stageTime = Date.now() - stageStart;
        console.log(
          `[Pipeline:${stage.name}] ${result.passed.length} passed, ` +
          `${result.rejected.length} rejected (${stageTime}ms)`
        );
      } catch (error) {
        console.error(`[Pipeline:${stage.name}] Stage failed:`, error);
        // On stage failure, treat all remaining jobs as passed
        // This prevents data loss on unexpected errors
        console.log(`[Pipeline:${stage.name}] Skipping stage, passing ${currentJobs.length} jobs`);
      }
    }

    stats.totalPassed = currentJobs.length;

    // Verification: ensure no jobs were lost
    const verified = this.verify(stats);

    // Summary log
    const stagesSummary = Object.entries(stats.stageStats)
      .map(([name, count]) => `${name}:${count}`)
      .join(', ');

    console.log(
      `[Pipeline] ${this.companyName}: ${stats.totalInput} input → ` +
      `${stats.totalPassed} passed (${stagesSummary}) ` +
      `[${verified ? 'VERIFIED' : 'MISMATCH'}]`
    );

    return {
      jobsToProcess: currentJobs,
      filteredJobs: this.filteredJobs,
      stats,
      verified,
    };
  }

  /**
   * Convert source job to FilteredJobData
   * Override in subclass for source-specific mapping
   */
  protected addFilteredJob(job: T, reason: FilterReason): void {
    this.filteredJobs.push({
      title: job.title,
      company: this.companyName,
      location: job.location || null,
      sourceUrl: job.sourceUrl,
      reason,
    });
  }

  /**
   * Verify that no jobs were lost in the pipeline
   * Returns true if input = rejected + passed
   */
  protected verify(stats: PipelineStats): boolean {
    const expectedSum = stats.totalRejected + stats.totalPassed;

    if (expectedSum !== stats.totalInput) {
      console.error(
        `[Pipeline] VERIFICATION FAILED for ${this.companyName}: ` +
        `input=${stats.totalInput}, ` +
        `rejected=${stats.totalRejected}, ` +
        `passed=${stats.totalPassed}, ` +
        `sum=${expectedSum}`
      );
      return false;
    }

    return true;
  }

  /**
   * Get the number of stages in this pipeline
   */
  getStageCount(): number {
    return this.stages.length;
  }

  /**
   * Get stage names for debugging
   */
  getStageNames(): string[] {
    return this.stages.map(s => s.name);
  }
}
