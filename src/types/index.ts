// Job-related types for frontend use
export interface JobCardData {
  id: string;
  slug: string;
  title: string;
  company: {
    name: string;
    slug: string;
    logo: string | null;
    website: string | null;
  };
  location: string | null;
  locationType: string;
  level: string;
  type: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: string | null;
  salaryIsEstimate: boolean;
  skills: string[];
  sourceLanguages: string[];
  targetLanguages: string[];
  source: string;
  sourceType: string;
  postedAt: Date;
  createdAt: Date;
  isDirectOpportunity: boolean;
}

export interface JobDetailData extends JobCardData {
  description: string;
  originalContent: string | null;
  authorLinkedIn: string | null;
  authorName: string | null;
  benefits: string[];
  applyUrl: string | null;
  applyEmail: string | null;
  sourceUrl: string;
  category: {
    name: string;
    slug: string;
  };
}

// Opportunity types for LinkedIn direct projects
export interface OpportunityCardData {
  id: string;
  slug: string;
  title: string;
  // Client info (the key difference from jobs)
  clientName: string;
  clientLinkedIn: string;
  clientType: string;  // 'profile' or 'company'
  clientHeadline: string | null;
  clientAvatar: string | null;
  // Optional company (extracted, not required)
  company: {
    name: string;
    slug: string;
    logo: string | null;
    website: string | null;
  } | null;
  location: string | null;
  locationType: string;
  level: string;
  type: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: string | null;
  salaryIsEstimate: boolean;
  skills: string[];
  sourceLanguages: string[];
  targetLanguages: string[];
  postedAt: Date;
  createdAt: Date;
}

export interface OpportunityDetailData extends OpportunityCardData {
  description: string;
  originalContent: string;
  applyUrl: string | null;
  applyEmail: string | null;
  sourceUrl: string;
  category: {
    name: string;
    slug: string;
  };
}

// Combined type for mixed feed
export type FeedItem =
  | { type: 'job'; data: JobCardData }
  | { type: 'opportunity'; data: OpportunityCardData };

export interface CompanyCardData {
  id: string;
  slug: string;
  name: string;
  logo: string | null;
  website: string | null;
  industry: string | null;
  size: string | null;
  jobCount: number;
}

export interface CategoryData {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  jobCount: number;
  avgSalary: number | null;
}

export interface FilterOptions {
  category?: string;
  level?: string;
  type?: string;
  location?: string;
  salaryMin?: number;
  search?: string;
}

// For SEO landing pages
export interface LandingPageData {
  slug: string;
  title: string;
  h1: string;
  metaDescription: string;
  content: string | null;
  jobCount: number;
  avgSalary: number | null;
  filters: FilterOptions;
}
