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
}

export interface SourceProcessor {
  sourceType: Source;
  process(dataSourceId: string): Promise<ProcessingStats>;
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

export interface RemoteOKJob {
  id: string;
  slug: string;
  company: string;
  company_logo: string;
  position: string;
  tags: string[];
  location: string;
  salary_min?: number;
  salary_max?: number;
  date: string;
  url: string;
  description?: string;
  apply_url?: string;
}

export interface WWRJob {
  id: number;
  title: string;
  company: {
    name: string;
    logo_url?: string;
  };
  url: string;
  location: string;
  tags: string[];
  date: string;
}

export interface HackerNewsJob {
  id: number;
  text: string;
  by: string;
  time: number;
  parent: number;
}

// ATS API URL templates
export const ATS_API_TEMPLATES: Record<string, string> = {
  LEVER: 'https://api.lever.co/v0/postings/{companySlug}?mode=json',
  GREENHOUSE: 'https://boards-api.greenhouse.io/v1/boards/{companySlug}/jobs',
  ASHBY: 'https://api.ashbyhq.com/posting-api/job-board/{companySlug}',
  SMARTRECRUITERS: 'https://api.smartrecruiters.com/v1/companies/{companySlug}/postings',
  WORKABLE: 'https://apply.workable.com/api/v1/widget/accounts/{companySlug}',
};

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
  return ['REMOTEOK', 'WEWORKREMOTELY', 'HACKERNEWS', 'REMOTIVE', 'HIMALAYAS', 'WORKINGNOMADS', 'INDEED'].includes(sourceType);
}
