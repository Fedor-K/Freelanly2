/**
 * ============================================================================
 * FILTER PIPELINE SYSTEM
 * ============================================================================
 *
 * Centralized job filtering for all sources.
 *
 * Architecture:
 * - FilterStage: Interface for individual filter stages
 * - BaseFilterPipeline: Abstract base class with common logic
 * - Common stages: AgeFilter, DuplicateFilter, WhitelistFilter
 * - Source pipelines: LeverFilterPipeline, etc.
 *
 * Adding a new source:
 * 1. Create a new pipeline class extending BaseFilterPipeline
 * 2. Configure stages in constructor
 * 3. Add adapter function for source-specific job format
 * 4. Export from this file
 * ============================================================================
 */

// Types and interfaces
export type {
  FilterableJob,
  FilteredJobData,
  FilterContext,
  FilterStageResult,
  FilterStage,
  PipelineStats,
  PipelineResult,
} from './filter-stage';

// Base class
export { BaseFilterPipeline } from './base-filter-pipeline';

// Common reusable stages
export {
  AgeFilterStage,
  DuplicateFilterStage,
  WhitelistFilterStage,
} from './common-stages';

// Source-specific pipelines
export { LeverFilterPipeline, type LeverFilterableJob } from './lever-pipeline';
