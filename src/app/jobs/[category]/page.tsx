import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { JobCard } from '@/components/jobs/JobCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { siteConfig, categories, levels, jobTypes, locationTypes } from '@/config/site';
import { prisma } from '@/lib/db';

interface CategoryPageProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ page?: string; level?: string; type?: string; location?: string }>;
}

// Generate static params for all categories
export async function generateStaticParams() {
  return categories.map((cat) => ({
    category: cat.slug,
  }));
}

// Generate metadata with rich SEO
export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { category: categorySlug } = await params;
  const category = categories.find((c) => c.slug === categorySlug);

  if (!category) {
    return { title: 'Category Not Found' };
  }

  const title = `Remote ${category.name} Jobs - Work From Home ${category.name} Positions`;
  const description = `Browse ${category.name.toLowerCase()} remote jobs. Find work from home ${category.name.toLowerCase()} positions at top companies. Updated daily with new opportunities.`;

  return {
    title,
    description,
    keywords: [
      `remote ${category.name.toLowerCase()} jobs`,
      `work from home ${category.name.toLowerCase()}`,
      `${category.name.toLowerCase()} remote positions`,
      `${category.name.toLowerCase()} jobs worldwide`,
      `remote ${category.name.toLowerCase()} careers`,
    ],
    openGraph: {
      title,
      description,
      url: `${siteConfig.url}/jobs/${category.slug}`,
      type: 'website',
      siteName: siteConfig.name,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    alternates: {
      canonical: `${siteConfig.url}/jobs/${category.slug}`,
    },
  };
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { category: categorySlug } = await params;
  const { page = '1', level, type, location } = await searchParams;

  const category = categories.find((c) => c.slug === categorySlug);

  if (!category) {
    notFound();
  }

  const currentPage = parseInt(page, 10) || 1;
  const perPage = 20;

  // Build filters
  const where: any = {
    isActive: true,
    category: {
      slug: categorySlug,
    },
  };

  if (level) {
    where.level = level.toUpperCase();
  }
  if (type) {
    where.type = type.toUpperCase();
  }
  if (location) {
    where.locationType = location.toUpperCase();
  }

  // Fetch jobs with pagination
  let jobs: any[] = [];
  let totalJobs = 0;

  try {
    [jobs, totalJobs] = await Promise.all([
      prisma.job.findMany({
        where,
        include: {
          company: {
            select: {
              name: true,
              slug: true,
              logo: true,
            },
          },
        },
        orderBy: { postedAt: 'desc' },
        skip: (currentPage - 1) * perPage,
        take: perPage,
      }),
      prisma.job.count({ where }),
    ]);
  } catch (error) {
    // Database might not be connected
    console.error('Failed to fetch jobs:', error);
  }

  const totalPages = Math.ceil(totalJobs / perPage);

  // Structured Data: ItemList + BreadcrumbList
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: siteConfig.url,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Jobs',
            item: `${siteConfig.url}/jobs`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: `${category.name} Jobs`,
            item: `${siteConfig.url}/jobs/${category.slug}`,
          },
        ],
      },
      {
        '@type': 'ItemList',
        name: `Remote ${category.name} Jobs`,
        description: `Find remote ${category.name.toLowerCase()} positions at top companies`,
        numberOfItems: totalJobs,
        itemListElement: jobs.map((job, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          url: `${siteConfig.url}/company/${job.company.slug}/jobs/${job.slug}`,
          name: job.title,
        })),
      },
      {
        '@type': 'WebPage',
        '@id': `${siteConfig.url}/jobs/${category.slug}`,
        name: `Remote ${category.name} Jobs`,
        description: `Browse ${totalJobs}+ remote ${category.name.toLowerCase()} jobs`,
        isPartOf: {
          '@id': siteConfig.url,
        },
      },
    ],
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="container py-8">
          {/* Breadcrumbs */}
          <nav className="mb-6 text-sm text-muted-foreground" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-2">
              <li>
                <Link href="/" className="hover:text-foreground">Home</Link>
              </li>
              <li>/</li>
              <li>
                <Link href="/jobs" className="hover:text-foreground">Jobs</Link>
              </li>
              <li>/</li>
              <li className="text-foreground font-medium">{category.name}</li>
            </ol>
          </nav>

          {/* Page Header with SEO-rich content */}
          <header className="mb-8">
            <h1 className="text-3xl font-bold mb-2">
              Remote {category.name} Jobs
            </h1>
            <p className="text-muted-foreground text-lg">
              {totalJobs > 0
                ? `${totalJobs} ${category.name.toLowerCase()} positions available`
                : `Browse ${category.name.toLowerCase()} remote opportunities`}
            </p>
          </header>

          <div className="flex gap-8">
            {/* Filters Sidebar */}
            <aside className="hidden lg:block w-64 flex-shrink-0">
              <div className="sticky top-20 space-y-6">
                {/* Level Filter */}
                <div>
                  <h2 className="text-sm font-medium mb-2">Experience Level</h2>
                  <div className="space-y-1">
                    {levels.map((lvl) => (
                      <Link
                        key={lvl.value}
                        href={`/jobs/${category.slug}/${lvl.value.toLowerCase()}`}
                        className="block px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                      >
                        {lvl.label}
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Other Categories */}
                <div>
                  <h2 className="text-sm font-medium mb-2">Other Categories</h2>
                  <div className="space-y-1">
                    {categories
                      .filter((c) => c.slug !== category.slug)
                      .map((cat) => (
                        <Link
                          key={cat.slug}
                          href={`/jobs/${cat.slug}`}
                          className="block px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                        >
                          {cat.icon} {cat.name}
                        </Link>
                      ))}
                  </div>
                </div>

                {/* Location Filter */}
                <div>
                  <h2 className="text-sm font-medium mb-2">Location</h2>
                  <div className="space-y-1">
                    {locationTypes.map((loc) => (
                      <Link
                        key={loc.value}
                        href={`/jobs/${category.slug}?location=${loc.value.toLowerCase()}`}
                        className="block px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                      >
                        {loc.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </aside>

            {/* Job List */}
            <div className="flex-1">
              {/* Active Filters */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <Badge>{category.name}</Badge>
                {level && <Badge variant="secondary">{level}</Badge>}
                {type && <Badge variant="secondary">{type}</Badge>}
                {location && <Badge variant="secondary">{location}</Badge>}
                <Link href={`/jobs/${category.slug}`}>
                  <Button variant="ghost" size="sm" className="text-xs">
                    Clear filters
                  </Button>
                </Link>
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
                  <p className="text-muted-foreground">
                    No {category.name.toLowerCase()} jobs found at the moment.
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Check back soon or browse other categories.
                  </p>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <nav className="mt-8 flex justify-center gap-2" aria-label="Pagination">
                  {currentPage > 1 && (
                    <Link href={`/jobs/${category.slug}?page=${currentPage - 1}`}>
                      <Button variant="outline">Previous</Button>
                    </Link>
                  )}
                  <span className="flex items-center px-4 text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  {currentPage < totalPages && (
                    <Link href={`/jobs/${category.slug}?page=${currentPage + 1}`}>
                      <Button variant="outline">Next</Button>
                    </Link>
                  )}
                </nav>
              )}
            </div>
          </div>

          {/* SEO Content Section */}
          <section className="mt-16 border-t pt-8">
            <h2 className="text-2xl font-bold mb-4">
              About Remote {category.name} Jobs
            </h2>
            <div className="prose prose-sm max-w-none text-muted-foreground">
              <p>
                Find the best remote {category.name.toLowerCase()} positions from top companies worldwide.
                Our job board aggregates opportunities from LinkedIn posts and leading ATS systems,
                giving you access to hundreds of {category.name.toLowerCase()} roles updated daily.
              </p>
              <p>
                Whether you're looking for entry-level {category.name.toLowerCase()} positions or senior roles,
                Freelanly helps you discover remote work opportunities that match your skills and experience level.
              </p>
            </div>

            {/* Related Links */}
            <div className="mt-8">
              <h3 className="font-semibold mb-3">Popular {category.name} Job Searches</h3>
              <div className="flex flex-wrap gap-2">
                {levels.slice(0, 5).map((lvl) => (
                  <Link
                    key={lvl.value}
                    href={`/jobs/${category.slug}/${lvl.value.toLowerCase()}`}
                    className="text-sm text-primary hover:underline"
                  >
                    {lvl.label} {category.name} Jobs
                  </Link>
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>

      <Footer />

      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
    </div>
  );
}
