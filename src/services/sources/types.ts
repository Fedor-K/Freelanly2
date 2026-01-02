import { Source } from '@prisma/client';

export interface ProcessingStats {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
  // URLs of created jobs for search engine indexing
  createdJobUrls?: string[];
  // IDs of created jobs for linking to ImportLog
  createdJobIds?: string[];
}

export interface ProcessorContext {
  importLogId: string;
  dataSourceId: string;
}

export interface SourceProcessor {
  sourceType: Source;
  process(context: ProcessorContext): Promise<ProcessingStats>;
}

export interface LeverJob {
  id: string;
  text: string;  // Job title
  hostedUrl: string;
  applyUrl: string;
  categories: {
    commitment?: string;  // Full-time, Part-time
    department?: string;
    location?: string;
    team?: string;
    allLocations?: string[];
  };
  descriptionPlain?: string;
  description?: string;  // HTML
  lists?: Array<{
    text: string;
    content: string;
  }>;
  additional?: string;
  additionalPlain?: string;
  salaryRange?: {
    min?: number;
    max?: number;
    currency?: string;
    interval?: string;
  };
  createdAt: number;
  workplaceType?: string;  // remote, onsite, hybrid
}

// ATS API URL templates
export const ATS_API_TEMPLATES: Record<string, string> = {
  LEVER: 'https://api.lever.co/v0/postings/{companySlug}?mode=json',
  LEVER_EU: 'https://api.eu.lever.co/v0/postings/{companySlug}?mode=json',
  GREENHOUSE: 'https://boards-api.greenhouse.io/v1/boards/{companySlug}/jobs',
  ASHBY: 'https://api.ashbyhq.com/posting-api/job-board/{companySlug}',
  SMARTRECRUITERS: 'https://api.smartrecruiters.com/v1/companies/{companySlug}/postings',
  WORKABLE: 'https://apply.workable.com/api/v1/widget/accounts/{companySlug}',
};

// Lever region detection from API URL
export function getLeverRegion(apiUrl?: string | null): 'us' | 'eu' {
  if (apiUrl && apiUrl.includes('.eu.lever.co')) {
    return 'eu';
  }
  return 'us';
}

// Get Lever job page base URL based on region
export function getLeverJobsBaseUrl(region: 'us' | 'eu'): string {
  return region === 'eu'
    ? 'https://jobs.eu.lever.co'
    : 'https://jobs.lever.co';
}

// Build API URL for ATS source
export function buildAtsApiUrl(sourceType: Source, companySlug: string): string {
  const template = ATS_API_TEMPLATES[sourceType];
  if (!template) throw new Error(`Unknown ATS type: ${sourceType}`);
  return template.replace('{companySlug}', companySlug);
}

// Check if source is an ATS (vs aggregator)
export function isAtsSource(sourceType: Source): boolean {
  return ['LEVER', 'GREENHOUSE', 'ASHBY', 'WORKABLE', 'SMARTRECRUITERS', 'BAMBOO', 'WORKDAY'].includes(sourceType);
}

// Check if source is an aggregator
export function isAggregatorSource(sourceType: Source): boolean {
  return ['REMOTIVE', 'HIMALAYAS', 'WORKINGNOMADS', 'INDEED'].includes(sourceType);
}
