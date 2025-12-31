import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { JobCard } from '@/components/jobs/JobCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { siteConfig, categories, levels } from '@/config/site';
import { salaryRanges, getSalaryRangeBySlug } from '@/config/salary-ranges';
import { getSalaryContent, getSalaryFAQs } from '@/config/salary-content';
import { getCategoryContent } from '@/config/category-content';
import { truncateTitle } from '@/lib/seo';
import { prisma } from '@/lib/db';
import { getMaxJobAgeDate } from '@/lib/utils';

// ISR: Revalidate every hour
export const revalidate = 3600;

interface CategorySalaryPageProps {
  params: Promise<{ category: string; range: string }>;
  searchParams: Promise<{ page?: string }>;
}

// Generate static params for all category + salary combinations
export async function generateStaticParams() {
  const params: { category: string; range: string }[] = [];

  for (const category of categories) {
    for (const range of salaryRanges) {
      params.push({
        category: category.slug,
        range: range.slug,
      });
    }
  }

  return params;
}

// Generate metadata
export async function generateMetadata({ params, searchParams }: CategorySalaryPageProps): Promise<Metadata> {
  const { category: categorySlug, range: rangeSlug } = await params;
  const { page } = await searchParams;

  const category = categories.find((c) => c.slug === categorySlug);
  const salaryRange = getSalaryRangeBySlug(rangeSlug);

  if (!category || !salaryRange) {
    return {
      title: 'Page Not Found',
      robots: { index: false, follow: true },
    };
  }

  const pageNum = parseInt(page || '1', 10);

  // Title max 60 chars
  const seoTitle = truncateTitle(`Remote ${category.name} Jobs ${salaryRange.label}/year`);

  // Description 150-160 chars
  const description = `Find remote ${category.name.toLowerCase()} jobs paying ${salaryRange.label} per year. Browse ${salaryRange.description.toLowerCase()}. Updated daily.`;

  // Noindex pagination pages
  const shouldNoindex = pageNum > 1;

  return {
    title: seoTitle,
    description,
    keywords: [
      `remote ${category.name.toLowerCase()} jobs ${salaryRange.label}`,
      `${category.name.toLowerCase()} salary ${salaryRange.label}`,
      `high paying ${category.name.toLowerCase()} jobs`,
      `remote ${category.name.toLowerCase()} ${rangeSlug}`,
    ],
    openGraph: {
      title: seoTitle,
      description,
      url: `${siteConfig.url}/jobs/${category.slug}/salary/${salaryRange.slug}`,
      type: 'website',
      siteName: siteConfig.name,
    },
    twitter: {
      card: 'summary_large_image',
      title: seoTitle,
      description,
    },
    alternates: {
      canonical: `${siteConfig.url}/jobs/${category.slug}/salary/${salaryRange.slug}`,
    },
    ...(shouldNoindex && {
      robots: {
        index: false,
        follow: true,
      },
    }),
  };
}

export default async function CategorySalaryPage({ params, searchParams }: CategorySalaryPageProps) {
  const { category: categorySlug, range: rangeSlug } = await params;
  const { page = '1' } = await searchParams;

  const category = categories.find((c) => c.slug === categorySlug);
  const salaryRange = getSalaryRangeBySlug(rangeSlug);

  if (!category || !salaryRange) {
    notFound();
  }

  const currentPage = parseInt(page, 10) || 1;
  const perPage = 20;

  // Build filters - only annual salaries
  const maxAgeDate = getMaxJobAgeDate();
  const where: any = {
    isActive: true,
    postedAt: { gte: maxAgeDate },
    category: { slug: categorySlug },
    salaryMin: { not: null },
    salaryPeriod: 'YEAR',
  };

  // Add salary range filter
  if (salaryRange.max !== null) {
    where.salaryMin = { gte: salaryRange.min, lt: salaryRange.max };
  } else {
    where.salaryMin = { gte: salaryRange.min };
  }

  // Fetch jobs and stats
  let jobs: any[] = [];
  let totalJobs = 0;
  let avgSalary = 0;
  let topCompanies: { name: string; slug: string }[] = [];

  try {
    const [jobsResult, countResult, salaryResult, companiesResult] = await Promise.all([
      prisma.job.findMany({
        where,
        include: {
          company: {
            select: { name: true, slug: true, logo: true, website: true },
          },
        },
        orderBy: { salaryMin: 'desc' },
        skip: (currentPage - 1) * perPage,
        take: perPage,
      }),
      prisma.job.count({ where }),
      prisma.job.aggregate({
        where: { ...where, salaryIsEstimate: false },
        _avg: { salaryMin: true, salaryMax: true },
      }),
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

    if (salaryResult._avg.salaryMin && salaryResult._avg.salaryMax) {
      avgSalary = Math.round((salaryResult._avg.salaryMin + salaryResult._avg.salaryMax) / 2);
    }

    if (companiesResult.length > 0) {
      const companyIds = companiesResult.map((c) => c.companyId);
      const companiesData = await prisma.company.findMany({
        where: { id: { in: companyIds } },
        select: { name: true, slug: true },
      });
      topCompanies = companiesData;
    }
  } catch (error) {
    console.error('Failed to fetch jobs:', error);
  }

  const totalPages = Math.ceil(totalJobs / perPage);

  // Get content
  const salaryContent = getSalaryContent(salaryRange.slug);
  const categoryContent = getCategoryContent(category.slug);

  // Thin content check - noindex if < 3 jobs
  const shouldNoindex = totalJobs < 3;

  // Get other salary ranges for navigation
  const otherRanges = salaryRanges.filter((r) => r.slug !== salaryRange.slug);

  // FAQs
  const faqs = getSalaryFAQs(category.name, salaryRange.slug, totalJobs);

  // Structured Data
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: siteConfig.url },
          { '@type': 'ListItem', position: 2, name: 'Jobs', item: `${siteConfig.url}/jobs` },
          { '@type': 'ListItem', position: 3, name: category.name, item: `${siteConfig.url}/jobs/${category.slug}` },
          { '@type': 'ListItem', position: 4, name: salaryRange.label, item: `${siteConfig.url}/jobs/${category.slug}/salary/${salaryRange.slug}` },
        ],
      },
      {
        '@type': 'ItemList',
        name: `Remote ${category.name} Jobs ${salaryRange.label}`,
        numberOfItems: totalJobs,
        itemListElement: jobs.map((job, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          url: `${siteConfig.url}/company/${job.company.slug}/jobs/${job.slug}`,
          name: job.title,
        })),
      },
      {
        '@type': 'FAQPage',
        mainEntity: faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
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
              <li><Link href="/" className="hover:text-foreground">Home</Link></li>
              <li>/</li>
              <li><Link href="/jobs" className="hover:text-foreground">Jobs</Link></li>
              <li>/</li>
              <li><Link href={`/jobs/${category.slug}`} className="hover:text-foreground">{category.name}</Link></li>
              <li>/</li>
              <li className="text-foreground font-medium">{salaryRange.label}</li>
            </ol>
          </nav>

          {/* Page Header */}
          <header className="mb-8">
            <h1 className="text-3xl font-bold mb-2">
              Remote {category.name} Jobs {salaryRange.label}/year
            </h1>
            <p className="text-muted-foreground text-lg">
              {totalJobs > 0
                ? `${totalJobs} ${category.name.toLowerCase()} positions paying ${salaryRange.label} annually`
                : `Browse ${category.name.toLowerCase()} jobs in the ${salaryRange.label} salary range`}
            </p>
          </header>

          <div className="flex gap-8">
            {/* Sidebar */}
            <aside className="hidden lg:block w-64 flex-shrink-0">
              <div className="sticky top-20 space-y-6">
                {/* Salary Ranges */}
                <div>
                  <h2 className="text-sm font-medium mb-2">Salary Ranges</h2>
                  <div className="space-y-1">
                    {salaryRanges.map((range) => (
                      <Link
                        key={range.slug}
                        href={`/jobs/${category.slug}/salary/${range.slug}`}
                        className={`block px-3 py-1.5 text-sm rounded ${
                          range.slug === salaryRange.slug
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`}
                      >
                        {range.label}
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Experience Level */}
                <div>
                  <h2 className="text-sm font-medium mb-2">Experience Level</h2>
                  <div className="space-y-1">
                    {levels.slice(0, 5).map((lvl) => (
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
                  <h2 className="text-sm font-medium mb-2">{salaryRange.label} Jobs</h2>
                  <div className="space-y-1">
                    {categories
                      .filter((c) => c.slug !== category.slug)
                      .slice(0, 6)
                      .map((cat) => (
                        <Link
                          key={cat.slug}
                          href={`/jobs/${cat.slug}/salary/${salaryRange.slug}`}
                          className="block px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                        >
                          {cat.icon} {cat.name}
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
                <Badge variant="secondary">{salaryRange.label}/yr</Badge>
                <Link href={`/jobs/${category.slug}`}>
                  <Button variant="ghost" size="sm" className="text-xs">
                    Clear salary filter
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
                <div className="text-center py-12 border rounded-lg bg-muted/30">
                  <p className="text-muted-foreground mb-4">
                    No {category.name.toLowerCase()} jobs in the {salaryRange.label} range at the moment.
                  </p>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Try other salary ranges:</p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      <Link href={`/jobs/${category.slug}`}>
                        <Button variant="outline" size="sm">All {category.name} Jobs</Button>
                      </Link>
                      {otherRanges.slice(0, 3).map((range) => (
                        <Link key={range.slug} href={`/jobs/${category.slug}/salary/${range.slug}`}>
                          <Button variant="outline" size="sm">{range.label}</Button>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <nav className="mt-8 flex justify-center gap-2" aria-label="Pagination">
                  {currentPage > 1 && (
                    <Link href={`/jobs/${category.slug}/salary/${salaryRange.slug}?page=${currentPage - 1}`}>
                      <Button variant="outline">Previous</Button>
                    </Link>
                  )}
                  <span className="flex items-center px-4 text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  {currentPage < totalPages && (
                    <Link href={`/jobs/${category.slug}/salary/${salaryRange.slug}?page=${currentPage + 1}`}>
                      <Button variant="outline">Next</Button>
                    </Link>
                  )}
                </nav>
              )}
            </div>
          </div>

          {/* SEO Content Section */}
          {salaryContent && (
            <section className="mt-12 border-t pt-8">
              <div className="max-w-4xl">
                <h2 className="text-2xl font-bold mb-4">
                  {salaryContent.getTitle(category.name)}
                </h2>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  {salaryContent.getIntro(category.name)}
                </p>

                <div className="grid md:grid-cols-2 gap-8 mb-8">
                  {/* Expectations */}
                  <div>
                    <h3 className="font-semibold mb-3">What to Expect</h3>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {salaryContent.expectations.map((item, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-primary">-</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Skills */}
                  <div>
                    <h3 className="font-semibold mb-3">Key Skills</h3>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {salaryContent.skills.map((item, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-primary">-</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Negotiation Tips */}
                <div className="bg-muted/30 rounded-lg p-6 mb-8">
                  <h3 className="font-semibold mb-3">Salary Negotiation Tips</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {salaryContent.negotiationTips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-primary font-bold">{i + 1}.</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* FAQs */}
                <div>
                  <h3 className="font-semibold mb-4">Frequently Asked Questions</h3>
                  <div className="space-y-4">
                    {faqs.map((faq, i) => (
                      <details key={i} className="group border rounded-lg">
                        <summary className="flex cursor-pointer items-center justify-between p-4 font-medium">
                          {faq.question}
                          <span className="transition group-open:rotate-180">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </span>
                        </summary>
                        <p className="px-4 pb-4 text-muted-foreground">{faq.answer}</p>
                      </details>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Internal Links */}
          <section className="mt-8 border-t pt-8">
            <h2 className="text-lg font-semibold mb-4">Browse More Jobs</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <h3 className="text-sm font-medium mb-2">{category.name} by Salary</h3>
                <div className="space-y-1">
                  {salaryRanges.map((range) => (
                    <Link
                      key={range.slug}
                      href={`/jobs/${category.slug}/salary/${range.slug}`}
                      className="block text-sm text-muted-foreground hover:text-foreground"
                    >
                      {category.name} Jobs {range.label}
                    </Link>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-2">{salaryRange.label} Jobs</h3>
                <div className="space-y-1">
                  {categories.slice(0, 6).map((cat) => (
                    <Link
                      key={cat.slug}
                      href={`/jobs/${cat.slug}/salary/${salaryRange.slug}`}
                      className="block text-sm text-muted-foreground hover:text-foreground"
                    >
                      {cat.name} {salaryRange.label}
                    </Link>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-2">Popular Categories</h3>
                <div className="space-y-1">
                  {categories.slice(0, 6).map((cat) => (
                    <Link
                      key={cat.slug}
                      href={`/jobs/${cat.slug}`}
                      className="block text-sm text-muted-foreground hover:text-foreground"
                    >
                      Remote {cat.name} Jobs
                    </Link>
                  ))}
                </div>
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

      {/* Noindex if thin content */}
      {shouldNoindex && (
        <meta name="robots" content="noindex, follow" />
      )}
    </div>
  );
}
