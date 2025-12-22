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
  salaryIsEstimate: boolean;
  skills: string[];
  source: string;
  sourceType: string;
  postedAt: Date;
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
