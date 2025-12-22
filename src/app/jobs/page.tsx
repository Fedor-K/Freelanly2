import { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { JobCard } from '@/components/jobs/JobCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { siteConfig, categories, levels, jobTypes } from '@/config/site';
import { prisma } from '@/lib/db';
import { getMaxJobAgeDate } from '@/lib/utils';
import { JobFilters } from '@/components/jobs/JobFilters';

export const dynamic = 'force-dynamic';

interface JobsPageProps {
  searchParams: Promise<{
    page?: string;
    q?: string;
    level?: string | string[];
    type?: string | string[];
  }>;
}

const JOBS_PER_PAGE = 20;

export const metadata: Metadata = {
  title: 'Remote Jobs - Browse 1000+ Remote Work Positions | Freelanly',
  description: 'Find remote jobs from LinkedIn posts and top companies. Filter by category, level, location, and salary. Updated hourly with new remote opportunities.',
  keywords: [
    'remote jobs',
    'work from home jobs',
    'remote work',
    'remote developer jobs',
    'remote design jobs',
    'remote marketing jobs',
  ],
  openGraph: {
    title: 'Remote Jobs - Browse All Positions',
    description: 'Find remote jobs from LinkedIn posts and top companies. Filter by category, level, location, and salary.',
    url: `${siteConfig.url}/jobs`,
    siteName: siteConfig.name,
  },
  alternates: {
    canonical: `${siteConfig.url}/jobs`,
  },
};

// Fetch jobs from database with filters
async function getJobs(
  page: number,
  filters: {
    search?: string;
    levels?: string[];
    types?: string[];
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
      orderBy: { postedAt: 'desc' },
      skip,
      take: JOBS_PER_PAGE,
    }),
    prisma.job.count({ where }),
  ]);

  return { jobs, totalCount };
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

  const filters = {
    search: params.q,
    levels: toArray(params.level),
    types: toArray(params.type),
  };

  const { jobs, totalCount } = await getJobs(currentPage, filters);
  const totalPages = Math.ceil(totalCount / JOBS_PER_PAGE);

  const hasFilters = filters.search || filters.levels.length > 0 || filters.types.length > 0;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="container py-8">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Remote Jobs</h1>
            <p className="text-muted-foreground">
              {totalCount} jobs found
            </p>
          </div>

          <div className="flex gap-8">
            {/* Filters Sidebar */}
            <aside className="hidden lg:block w-64 flex-shrink-0">
              <div className="sticky top-20 space-y-6">
                {/* Search */}
                <JobFilters currentSearch={filters.search} />

                {/* Categories */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Category</label>
                  <div className="space-y-1">
                    {categories.map((category) => (
                      <Link
                        key={category.slug}
                        href={`/jobs/${category.slug}`}
                        className="block px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                      >
                        {category.icon} {category.name}
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Level */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Level</label>
                  <div className="space-y-1">
                    {levels.map((level) => {
                      const isActive = filters.levels.includes(level.value);
                      const newLevels = isActive
                        ? filters.levels.filter((l) => l !== level.value)
                        : [...filters.levels, level.value];
                      const href = buildFilterUrl(
                        { q: params.q, type: params.type },
                        { level: newLevels.length > 0 ? newLevels : undefined, page: undefined }
                      );

                      return (
                        <Link
                          key={level.value}
                          href={href}
                          className={`flex items-center gap-2 text-sm px-2 py-1 rounded hover:bg-muted ${
                            isActive ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground'
                          }`}
                        >
                          <span className={`w-4 h-4 border rounded flex items-center justify-center ${
                            isActive ? 'bg-primary border-primary text-white' : 'border-gray-300'
                          }`}>
                            {isActive && '✓'}
                          </span>
                          {level.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>

                {/* Job Type */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Job Type</label>
                  <div className="space-y-1">
                    {jobTypes.map((type) => {
                      const isActive = filters.types.includes(type.value);
                      const newTypes = isActive
                        ? filters.types.filter((t) => t !== type.value)
                        : [...filters.types, type.value];
                      const href = buildFilterUrl(
                        { q: params.q, level: params.level },
                        { type: newTypes.length > 0 ? newTypes : undefined, page: undefined }
                      );

                      return (
                        <Link
                          key={type.value}
                          href={href}
                          className={`flex items-center gap-2 text-sm px-2 py-1 rounded hover:bg-muted ${
                            isActive ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground'
                          }`}
                        >
                          <span className={`w-4 h-4 border rounded flex items-center justify-center ${
                            isActive ? 'bg-primary border-primary text-white' : 'border-gray-300'
                          }`}>
                            {isActive && '✓'}
                          </span>
                          {type.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </aside>

            {/* Job List */}
            <div className="flex-1">
              {/* Active Filters */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <span className="text-sm text-muted-foreground">Filters:</span>

                {filters.search && (
                  <Link href={buildFilterUrl({ level: params.level, type: params.type }, { q: undefined })}>
                    <Badge variant="secondary" className="cursor-pointer hover:bg-destructive/20">
                      Search: {filters.search} ×
                    </Badge>
                  </Link>
                )}

                {filters.levels.map((level) => {
                  const levelLabel = levels.find((l) => l.value === level)?.label || level;
                  const newLevels = filters.levels.filter((l) => l !== level);
                  return (
                    <Link
                      key={level}
                      href={buildFilterUrl(
                        { q: params.q, type: params.type },
                        { level: newLevels.length > 0 ? newLevels : undefined }
                      )}
                    >
                      <Badge variant="secondary" className="cursor-pointer hover:bg-destructive/20">
                        {levelLabel} ×
                      </Badge>
                    </Link>
                  );
                })}

                {filters.types.map((type) => {
                  const typeLabel = jobTypes.find((t) => t.value === type)?.label || type;
                  const newTypes = filters.types.filter((t) => t !== type);
                  return (
                    <Link
                      key={type}
                      href={buildFilterUrl(
                        { q: params.q, level: params.level },
                        { type: newTypes.length > 0 ? newTypes : undefined }
                      )}
                    >
                      <Badge variant="secondary" className="cursor-pointer hover:bg-destructive/20">
                        {typeLabel} ×
                      </Badge>
                    </Link>
                  );
                })}

                {!hasFilters && (
                  <Badge variant="outline">All Jobs</Badge>
                )}

                {hasFilters && (
                  <Link href="/jobs">
                    <Button variant="ghost" size="sm" className="text-xs">
                      Clear all
                    </Button>
                  </Link>
                )}
              </div>

              {/* Jobs */}
              {jobs.length > 0 ? (
                <div className="space-y-4">
                  {jobs.map((job) => (
                    <JobCard key={job.id} job={job} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
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
          </div>
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
