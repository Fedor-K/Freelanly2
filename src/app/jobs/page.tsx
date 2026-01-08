import { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { JobCard } from '@/components/jobs/JobCard';
import { Button } from '@/components/ui/button';
import { siteConfig, categories, levels, jobTypes, countries, techStacks, salaryRanges } from '@/config/site';
import { prisma } from '@/lib/db';
import { getMaxJobAgeDate } from '@/lib/utils';
import { TopFilters } from '@/components/jobs/TopFilters';

// ISR: Revalidate every 60 seconds for fresh job listings
export const revalidate = 60;

interface JobsPageProps {
  searchParams: Promise<{
    page?: string;
    q?: string;
    level?: string | string[];
    type?: string | string[];
    country?: string;
    salary?: string;
    skills?: string | string[];
    category?: string;
    sourceLang?: string;
    targetLang?: string;
    workType?: string;
  }>;
}

const JOBS_PER_PAGE = 20;

export async function generateMetadata({ searchParams }: JobsPageProps): Promise<Metadata> {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page || '1', 10) || 1);

  // Build pagination links
  const prevPage = currentPage > 1 ? currentPage - 1 : null;
  const nextPageExists = currentPage < 100; // Assume max 100 pages, actual check in component

  // Build OG image URL
  const ogImageUrl = `${siteConfig.url}/api/og?title=Remote%20Jobs&type=category&category=All%20Categories`;

  // Count active filters (excluding pagination)
  const filterCount = [
    params.q,
    params.level,
    params.type,
    params.country,
    params.salary,
    params.skills,
  ].filter(Boolean).length;

  // Noindex pages to avoid duplicate content:
  // - Pagination pages (page > 1) - duplicate of main listing
  // - Pages with multiple filters - thin/duplicate content combinations
  const hasPagination = currentPage > 1 || params.page !== undefined;
  const shouldNoindex = hasPagination || filterCount >= 2;

  return {
    title: currentPage > 1
      ? `Remote Jobs - Page ${currentPage}`
      : 'Remote Jobs - Browse 1000+ Remote Work Positions',
    description: 'Find remote jobs from social media and top companies. Filter by category, level, location, and salary. Updated hourly with new remote opportunities.',
    keywords: [
      'remote jobs',
      'work from home jobs',
      'remote work',
      'remote developer jobs',
      'remote design jobs',
      'remote marketing jobs',
    ],
    ...(shouldNoindex && {
      robots: {
        index: false,
        follow: true,
      },
    }),
    openGraph: {
      title: 'Remote Jobs - Browse All Positions',
      description: 'Find remote jobs from social media and top companies. Filter by category, level, location, and salary.',
      url: `${siteConfig.url}/jobs`,
      siteName: siteConfig.name,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: 'Remote Jobs on Freelanly' }],
    },
    alternates: {
      canonical: `${siteConfig.url}/jobs`,
    },
    other: {
      ...(prevPage && { 'link-prev': `${siteConfig.url}/jobs?page=${prevPage}` }),
      ...(nextPageExists && { 'link-next': `${siteConfig.url}/jobs?page=${currentPage + 1}` }),
    },
  };
}

// Fetch jobs from database with filters
async function getJobs(
  page: number,
  filters: {
    search?: string;
    levels?: string[];
    types?: string[];
    country?: string;
    salaryMin?: number;
    skills?: string[];
    category?: string;
    sourceLang?: string;
    targetLang?: string;
    workType?: string;
  }
) {
  const maxAgeDate = getMaxJobAgeDate();
  const skip = (page - 1) * JOBS_PER_PAGE;

  const where: any = {
    isActive: true,
    postedAt: { gte: maxAgeDate },
  };

  // Search filter
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { company: { name: { contains: filters.search, mode: 'insensitive' } } },
      { skills: { hasSome: [filters.search] } },
    ];
  }

  // Level filter
  if (filters.levels && filters.levels.length > 0) {
    where.level = { in: filters.levels };
  }

  // Type filter
  if (filters.types && filters.types.length > 0) {
    where.type = { in: filters.types };
  }

  // Country filter
  if (filters.country) {
    const countryData = countries.find(c => c.slug === filters.country);
    if (countryData?.code) {
      where.country = countryData.code;
    } else if (filters.country === 'worldwide') {
      // No filter for worldwide
    }
  }

  // Salary filter
  if (filters.salaryMin && filters.salaryMin > 0) {
    where.salaryMin = { gte: filters.salaryMin };
  }

  // Skills filter
  if (filters.skills && filters.skills.length > 0) {
    // Get keywords for selected tech stacks
    const skillKeywords: string[] = [];
    for (const skillSlug of filters.skills) {
      const techStack = techStacks.find(t => t.slug === skillSlug);
      if (techStack) {
        skillKeywords.push(...techStack.keywords);
      }
    }
    if (skillKeywords.length > 0) {
      where.skills = { hasSome: skillKeywords };
    }
  }

  // Category filter
  if (filters.category) {
    where.category = { slug: filters.category };
  }

  // Language filters (for translation jobs)
  if (filters.sourceLang) {
    where.sourceLanguages = { has: filters.sourceLang.toUpperCase() };
  }
  if (filters.targetLang) {
    where.targetLanguages = { has: filters.targetLang.toUpperCase() };
  }

  // Work type filter (for translation jobs)
  if (filters.workType) {
    where.translationTypes = { has: filters.workType };
  }

  try {
    const [jobs, totalCount] = await Promise.all([
      prisma.job.findMany({
        where,
        include: {
          company: {
            select: {
              name: true,
              slug: true,
              logo: true,
              website: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: JOBS_PER_PAGE,
      }),
      prisma.job.count({ where }),
    ]);

    return { jobs, totalCount };
  } catch (error) {
    console.error('Failed to fetch jobs:', error);
    return { jobs: [], totalCount: 0 };
  }
}

// Helper to normalize array params
function toArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

// Build URL with filters
function buildFilterUrl(
  baseParams: Record<string, string | string[] | undefined>,
  changes: Record<string, string | string[] | undefined>
): string {
  const params = new URLSearchParams();
  const merged = { ...baseParams, ...changes };

  for (const [key, value] of Object.entries(merged)) {
    if (!value) continue;
    if (Array.isArray(value)) {
      value.forEach((v) => params.append(key, v));
    } else {
      params.set(key, value);
    }
  }

  const queryString = params.toString();
  return queryString ? `/jobs?${queryString}` : '/jobs';
}

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page || '1', 10) || 1);

  // Parse salary filter
  const salaryRange = params.salary ? salaryRanges.find(r => r.value === params.salary) : null;

  const filters = {
    search: params.q,
    levels: toArray(params.level),
    types: toArray(params.type),
    country: params.country,
    salaryMin: salaryRange?.min,
    skills: toArray(params.skills),
    category: params.category,
    sourceLang: params.sourceLang,
    targetLang: params.targetLang,
    workType: params.workType,
  };

  const { jobs, totalCount } = await getJobs(currentPage, filters);
  const totalPages = Math.ceil(totalCount / JOBS_PER_PAGE);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="container py-6 sm:py-8">
          {/* Page Header */}
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold mb-1">Remote Jobs</h1>
            <p className="text-muted-foreground text-sm">
              Find your next remote opportunity
            </p>
          </div>

          {/* Top Filters */}
          <div className="mb-6">
            <TopFilters
              currentFilters={{
                search: filters.search,
                levels: filters.levels,
                types: filters.types,
                country: filters.country,
                salary: params.salary,
                skills: filters.skills,
                category: filters.category,
                sourceLang: filters.sourceLang,
                targetLang: filters.targetLang,
                workType: filters.workType,
              }}
              totalCount={totalCount}
            />
          </div>

          {/* Jobs Grid */}
          {jobs.length > 0 ? (
            <div className="space-y-4">
              {jobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 border rounded-lg bg-muted/30">
              <p className="text-muted-foreground mb-4">No jobs found matching your filters.</p>
              <Link href="/jobs">
                <Button variant="outline">Clear filters</Button>
              </Link>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <nav className="mt-8 flex justify-center gap-2">
              {currentPage > 1 ? (
                <Link href={buildFilterUrl(params, { page: String(currentPage - 1) })}>
                  <Button variant="outline">Previous</Button>
                </Link>
              ) : (
                <Button variant="outline" disabled>Previous</Button>
              )}

              <span className="flex items-center px-4 text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>

              {currentPage < totalPages ? (
                <Link href={buildFilterUrl(params, { page: String(currentPage + 1) })}>
                  <Button variant="outline">Next</Button>
                </Link>
              ) : (
                <Button variant="outline" disabled>Next</Button>
              )}
            </nav>
          )}
        </div>
      </main>

      <Footer />

      {/* ItemList Schema for Job Listings */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: 'Remote Jobs',
            description: 'Browse all remote job opportunities',
            numberOfItems: totalCount,
            itemListElement: jobs.map((job, index) => ({
              '@type': 'ListItem',
              position: (currentPage - 1) * JOBS_PER_PAGE + index + 1,
              url: `${siteConfig.url}/company/${job.company.slug}/jobs/${job.slug}`,
              name: `${job.title} at ${job.company.name}`,
            })),
          }),
        }}
      />

      {/* BreadcrumbList Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: siteConfig.url },
              { '@type': 'ListItem', position: 2, name: 'Remote Jobs', item: `${siteConfig.url}/jobs` },
            ],
          }),
        }}
      />
    </div>
  );
}
