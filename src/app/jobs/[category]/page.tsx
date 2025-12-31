import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { JobCard } from '@/components/jobs/JobCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { siteConfig, categories, levels, jobTypes, locationTypes } from '@/config/site';
import { getCategoryContent } from '@/config/category-content';
import { truncateTitle } from '@/lib/seo';
import { prisma } from '@/lib/db';
import { getMaxJobAgeDate } from '@/lib/utils';

// ISR: Revalidate every 60 seconds for fresh job listings
export const revalidate = 60;

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
export async function generateMetadata({ params, searchParams }: CategoryPageProps): Promise<Metadata> {
  const { category: categorySlug } = await params;
  const { location } = await searchParams;
  const category = categories.find((c) => c.slug === categorySlug);

  if (!category) {
    return {
      title: 'Category Not Found',
      robots: { index: false, follow: true },
    };
  }

  // Use SEO utility for consistent title truncation (max 60 chars)
  const seoTitle = truncateTitle(`Remote ${category.name} Jobs - Work From Home ${category.name} Positions`);
  const description = `Browse ${category.name.toLowerCase()} remote jobs. Find work from home ${category.name.toLowerCase()} positions at top companies. Updated daily with new opportunities.`;

  // Don't index pages that create duplicate/thin content:
  // - Pagination pages (page > 1)
  // - Onsite/hybrid filter pages (we're a remote job board)
  const resolvedSearchParams = await searchParams;
  const pageNum = parseInt(resolvedSearchParams.page || '1', 10);
  const noIndexLocations = ['onsite', 'hybrid'];
  const shouldNoIndex = pageNum > 1 || (location && noIndexLocations.includes(location.toLowerCase()));

  return {
    title: seoTitle,
    description,
    keywords: [
      `remote ${category.name.toLowerCase()} jobs`,
      `work from home ${category.name.toLowerCase()}`,
      `${category.name.toLowerCase()} remote positions`,
      `${category.name.toLowerCase()} jobs worldwide`,
      `remote ${category.name.toLowerCase()} careers`,
    ],
    openGraph: {
      title: seoTitle,
      description,
      url: `${siteConfig.url}/jobs/${category.slug}`,
      type: 'website',
      siteName: siteConfig.name,
    },
    twitter: {
      card: 'summary_large_image',
      title: seoTitle,
      description,
    },
    alternates: {
      canonical: `${siteConfig.url}/jobs/${category.slug}`,
    },
    ...(shouldNoIndex && {
      robots: {
        index: false,
        follow: true,
      },
    }),
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

  // Build filters - only show fresh jobs (max 60 days old)
  const maxAgeDate = getMaxJobAgeDate();
  const where: any = {
    isActive: true,
    postedAt: { gte: maxAgeDate },
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

  // Fetch jobs with pagination and additional stats for FAQ
  let jobs: any[] = [];
  let totalJobs = 0;
  let avgSalary = 0;
  let topCompanies: string[] = [];

  try {
    const [jobsResult, countResult, salaryResult, companiesResult] = await Promise.all([
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
        skip: (currentPage - 1) * perPage,
        take: perPage,
      }),
      prisma.job.count({ where }),
      // Get average salary for this category
      prisma.job.aggregate({
        where: {
          ...where,
          salaryMin: { gt: 10000 },
          salaryIsEstimate: false,
        },
        _avg: { salaryMin: true, salaryMax: true },
      }),
      // Get top companies hiring in this category
      prisma.job.groupBy({
        by: ['companyId'],
        where,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
    ]);

    jobs = jobsResult;
    totalJobs = countResult;

    // Calculate average salary
    if (salaryResult._avg.salaryMin && salaryResult._avg.salaryMax) {
      avgSalary = Math.round((salaryResult._avg.salaryMin + salaryResult._avg.salaryMax) / 2);
    }

    // Get company names for top companies
    if (companiesResult.length > 0) {
      const companyIds = companiesResult.map(c => c.companyId);
      const companies = await prisma.company.findMany({
        where: { id: { in: companyIds } },
        select: { name: true },
      });
      topCompanies = companies.map(c => c.name);
    }
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

                {/* Location Filter - only show remote options (we're a remote job board) */}
                <div>
                  <h2 className="text-sm font-medium mb-2">Location</h2>
                  <div className="space-y-1">
                    {locationTypes
                      .filter((loc) => loc.value.startsWith('REMOTE'))
                      .map((loc) => (
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

          {/* SEO Content Section - Rich category content */}
          {(() => {
            const content = getCategoryContent(category.slug);
            if (!content) return null;

            return (
              <section className="mt-16 border-t pt-8">
                <h2 className="text-2xl font-bold mb-4">
                  About Remote {category.name} Jobs
                </h2>

                {/* Intro paragraph - 300+ words */}
                <div className="prose prose-sm max-w-none text-muted-foreground mb-8">
                  <p>{content.intro}</p>
                  <p>{content.whatYouDo}</p>
                </div>

                {/* Skills and Tools Grid */}
                <div className="grid md:grid-cols-2 gap-8 mb-8">
                  {/* Key Skills */}
                  <div>
                    <h3 className="font-semibold mb-3">Key Skills for {category.name} Jobs</h3>
                    <div className="flex flex-wrap gap-2">
                      {content.keySkills.map((skill, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Popular Tools */}
                  <div>
                    <h3 className="font-semibold mb-3">Popular Tools & Technologies</h3>
                    <div className="flex flex-wrap gap-2">
                      {content.popularTools.map((tool, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {tool}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Salary Ranges */}
                <div className="bg-muted/50 rounded-lg p-6 mb-8">
                  <h3 className="font-semibold mb-4">Remote {category.name} Salary Ranges</h3>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-background rounded-lg">
                      <div className="text-sm text-muted-foreground mb-1">Entry Level</div>
                      <div className="font-semibold text-green-600">{content.salaryRange.entry}</div>
                    </div>
                    <div className="text-center p-4 bg-background rounded-lg">
                      <div className="text-sm text-muted-foreground mb-1">Mid Level</div>
                      <div className="font-semibold text-green-600">{content.salaryRange.mid}</div>
                    </div>
                    <div className="text-center p-4 bg-background rounded-lg">
                      <div className="text-sm text-muted-foreground mb-1">Senior Level</div>
                      <div className="font-semibold text-green-600">{content.salaryRange.senior}</div>
                    </div>
                  </div>
                </div>

                {/* Career Path */}
                <div className="mb-8">
                  <h3 className="font-semibold mb-3">{category.name} Career Path</h3>
                  <p className="text-sm text-muted-foreground">
                    {content.careerPath}
                  </p>
                </div>

                {/* Why Remote */}
                <div className="bg-primary/5 rounded-lg p-6 mb-8">
                  <h3 className="font-semibold mb-2">Why Work Remote in {category.name}?</h3>
                  <p className="text-sm text-muted-foreground">
                    {content.whyRemote}
                  </p>
                </div>

                {/* Related Links */}
                <div>
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
            );
          })()}

          {/* FAQ Section for Rich Snippets - with dynamic data */}
          <section className="mt-12">
            <h2 className="text-2xl font-bold mb-4">Frequently Asked Questions</h2>
            <div className="space-y-4">
              <details className="border rounded-lg p-4">
                <summary className="font-medium cursor-pointer">
                  How many remote {category.name.toLowerCase()} jobs are available right now?
                </summary>
                <p className="mt-2 text-muted-foreground">
                  Currently, there are <strong>{totalJobs} remote {category.name.toLowerCase()} positions</strong> available on Freelanly.
                  New jobs are added daily from LinkedIn and top company career pages.
                </p>
              </details>
              <details className="border rounded-lg p-4">
                <summary className="font-medium cursor-pointer">
                  What is the average salary for remote {category.name.toLowerCase()} jobs?
                </summary>
                <p className="mt-2 text-muted-foreground">
                  {avgSalary > 0 ? (
                    <>Based on current job postings, the average salary for remote {category.name.toLowerCase()} positions is approximately <strong>${avgSalary.toLocaleString()}/year</strong>. Salaries vary based on experience level, location, and company size.</>
                  ) : (
                    <>Salaries for remote {category.name.toLowerCase()} positions vary based on experience, location, and company size. Entry-level roles typically start at $50,000-$70,000, while senior positions can exceed $120,000-$180,000 annually.</>
                  )}
                </p>
              </details>
              <details className="border rounded-lg p-4">
                <summary className="font-medium cursor-pointer">
                  Which companies are hiring for remote {category.name.toLowerCase()} roles?
                </summary>
                <p className="mt-2 text-muted-foreground">
                  {topCompanies.length > 0 ? (
                    <>Top companies currently hiring for {category.name.toLowerCase()} positions include <strong>{topCompanies.join(', ')}</strong>, and many more. Browse our job listings to see all available opportunities.</>
                  ) : (
                    <>Many leading companies are hiring for remote {category.name.toLowerCase()} positions. Browse our job listings to discover opportunities from startups to Fortune 500 companies.</>
                  )}
                </p>
              </details>
              <details className="border rounded-lg p-4">
                <summary className="font-medium cursor-pointer">
                  How do I apply for {category.name.toLowerCase()} jobs on Freelanly?
                </summary>
                <p className="mt-2 text-muted-foreground">
                  Browse our {category.name.toLowerCase()} job listings and click on any position that interests you.
                  Each job posting includes application instructions — either a direct apply link or contact email.
                  PRO members get full access to all contact information and can apply unlimited.
                </p>
              </details>
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

      {/* FAQ Schema - with dynamic data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
              {
                '@type': 'Question',
                name: `How many remote ${category.name.toLowerCase()} jobs are available right now?`,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: `Currently, there are ${totalJobs} remote ${category.name.toLowerCase()} positions available on Freelanly. New jobs are added daily from LinkedIn and top company career pages.`,
                },
              },
              {
                '@type': 'Question',
                name: `What is the average salary for remote ${category.name.toLowerCase()} jobs?`,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: avgSalary > 0
                    ? `Based on current job postings, the average salary for remote ${category.name.toLowerCase()} positions is approximately $${avgSalary.toLocaleString()}/year. Salaries vary based on experience level, location, and company size.`
                    : `Salaries for remote ${category.name.toLowerCase()} positions vary based on experience, location, and company size. Entry-level roles typically start at $50,000-$70,000, while senior positions can exceed $120,000-$180,000 annually.`,
                },
              },
              {
                '@type': 'Question',
                name: `Which companies are hiring for remote ${category.name.toLowerCase()} roles?`,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: topCompanies.length > 0
                    ? `Top companies currently hiring for ${category.name.toLowerCase()} positions include ${topCompanies.join(', ')}, and many more. Browse our job listings to see all available opportunities.`
                    : `Many leading companies are hiring for remote ${category.name.toLowerCase()} positions. Browse our job listings to discover opportunities from startups to Fortune 500 companies.`,
                },
              },
              {
                '@type': 'Question',
                name: `How do I apply for ${category.name.toLowerCase()} jobs on Freelanly?`,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: `Browse our ${category.name.toLowerCase()} job listings and click on any position that interests you. Each job posting includes application instructions — either a direct apply link or contact email. PRO members get full access to all contact information.`,
                },
              },
            ],
          }),
        }}
      />
    </div>
  );
}
