import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { JobCard } from '@/components/jobs/JobCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { siteConfig, categories, levels } from '@/config/site';
import { countries, getCountryBySlug, isHighVolumeCountry } from '@/config/countries';
import { getCountryContent } from '@/config/country-content';
import { getCategoryContent } from '@/config/category-content';
import { truncateTitle } from '@/lib/seo';
import { prisma } from '@/lib/db';
import { getMaxJobAgeDate } from '@/lib/utils';

// ISR: Revalidate every hour for programmatic pages
export const revalidate = 3600;

interface CategoryCountryPageProps {
  params: Promise<{ category: string; country: string }>;
  searchParams: Promise<{ page?: string }>;
}

// Generate static params for all category + country combinations
export async function generateStaticParams() {
  const params: { category: string; country: string }[] = [];

  for (const category of categories) {
    for (const country of countries) {
      params.push({
        category: category.slug,
        country: country.slug,
      });
    }
  }

  return params;
}

// Generate metadata
export async function generateMetadata({ params, searchParams }: CategoryCountryPageProps): Promise<Metadata> {
  const { category: categorySlug, country: countrySlug } = await params;
  const { page } = await searchParams;

  const category = categories.find((c) => c.slug === categorySlug);
  const country = getCountryBySlug(countrySlug);

  if (!category || !country) {
    return {
      title: 'Page Not Found',
      robots: { index: false, follow: true },
    };
  }

  const pageNum = parseInt(page || '1', 10);

  // Title max 60 chars
  const seoTitle = truncateTitle(`Remote ${category.name} Jobs in ${country.name}`);

  // Description 150-160 chars
  const description = `Browse remote ${category.name.toLowerCase()} jobs in ${country.name}. Find work from home ${category.name.toLowerCase()} positions at top ${country.name} companies. Updated daily.`;

  // Noindex pagination pages
  const shouldNoindex = pageNum > 1;

  return {
    title: seoTitle,
    description,
    keywords: [
      `remote ${category.name.toLowerCase()} jobs ${country.name}`,
      `${category.name.toLowerCase()} jobs ${country.name}`,
      `work from home ${category.name.toLowerCase()} ${country.name}`,
      `${country.name} remote ${category.name.toLowerCase()}`,
    ],
    openGraph: {
      title: seoTitle,
      description,
      url: `${siteConfig.url}/jobs/${category.slug}/country/${country.slug}`,
      type: 'website',
      siteName: siteConfig.name,
    },
    twitter: {
      card: 'summary_large_image',
      title: seoTitle,
      description,
    },
    alternates: {
      canonical: `${siteConfig.url}/jobs/${category.slug}/country/${country.slug}`,
    },
    ...(shouldNoindex && {
      robots: {
        index: false,
        follow: true,
      },
    }),
  };
}

export default async function CategoryCountryPage({ params, searchParams }: CategoryCountryPageProps) {
  const { category: categorySlug, country: countrySlug } = await params;
  const { page = '1' } = await searchParams;

  const category = categories.find((c) => c.slug === categorySlug);
  const country = getCountryBySlug(countrySlug);

  if (!category || !country) {
    notFound();
  }

  const currentPage = parseInt(page, 10) || 1;
  const perPage = 20;

  // Build filters
  const maxAgeDate = getMaxJobAgeDate();
  const where: any = {
    isActive: true,
    postedAt: { gte: maxAgeDate },
    category: { slug: categorySlug },
    country: country.code,
  };

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
        orderBy: { postedAt: 'desc' },
        skip: (currentPage - 1) * perPage,
        take: perPage,
      }),
      prisma.job.count({ where }),
      prisma.job.aggregate({
        where: { ...where, salaryMin: { gt: 10000 }, salaryIsEstimate: false },
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
  const countryContent = getCountryContent(country.slug);
  const categoryContent = getCategoryContent(category.slug);

  // Check if should noindex (thin content)
  const shouldNoindex = totalJobs < 3 && !isHighVolumeCountry(country.slug);

  // Get nearby countries (same region)
  const nearbyCountries = countries
    .filter((c) => c.region === country.region && c.slug !== country.slug)
    .slice(0, 5);

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
          { '@type': 'ListItem', position: 4, name: country.name, item: `${siteConfig.url}/jobs/${category.slug}/country/${country.slug}` },
        ],
      },
      {
        '@type': 'ItemList',
        name: `Remote ${category.name} Jobs in ${country.name}`,
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
        mainEntity: [
          {
            '@type': 'Question',
            name: `How many remote ${category.name.toLowerCase()} jobs are available in ${country.name}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `Currently, there are ${totalJobs} remote ${category.name.toLowerCase()} positions in ${country.name} available on Freelanly. New jobs are added daily.`,
            },
          },
          {
            '@type': 'Question',
            name: `What is the average salary for remote ${category.name.toLowerCase()} jobs in ${country.name}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: avgSalary > 0
                ? `Based on current job postings, the average salary for remote ${category.name.toLowerCase()} positions in ${country.name} is approximately $${avgSalary.toLocaleString()}/year.`
                : `Salaries for remote ${category.name.toLowerCase()} positions in ${country.name} vary based on experience, company size, and specific role requirements.`,
            },
          },
          {
            '@type': 'Question',
            name: `Which companies are hiring for remote ${category.name.toLowerCase()} roles in ${country.name}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: topCompanies.length > 0
                ? `Top companies hiring for ${category.name.toLowerCase()} positions in ${country.name} include ${topCompanies.map((c) => c.name).join(', ')}.`
                : `Many companies are hiring for remote ${category.name.toLowerCase()} positions in ${country.name}. Browse our listings to find opportunities.`,
            },
          },
        ],
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
              <li className="text-foreground font-medium">{country.flag} {country.name}</li>
            </ol>
          </nav>

          {/* Page Header */}
          <header className="mb-8">
            <h1 className="text-3xl font-bold mb-2">
              Remote {category.name} Jobs in {country.name} {country.flag}
            </h1>
            <p className="text-muted-foreground text-lg">
              {totalJobs > 0
                ? `${totalJobs} ${category.name.toLowerCase()} positions in ${country.name}`
                : `Browse ${category.name.toLowerCase()} opportunities in ${country.name}`}
            </p>
          </header>

          <div className="flex gap-8">
            {/* Sidebar */}
            <aside className="hidden lg:block w-64 flex-shrink-0">
              <div className="sticky top-20 space-y-6">
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

                {/* Nearby Countries */}
                {nearbyCountries.length > 0 && (
                  <div>
                    <h2 className="text-sm font-medium mb-2">{category.name} in {country.region}</h2>
                    <div className="space-y-1">
                      {nearbyCountries.map((c) => (
                        <Link
                          key={c.slug}
                          href={`/jobs/${category.slug}/country/${c.slug}`}
                          className="block px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                        >
                          {c.flag} {c.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Other Categories in this Country */}
                <div>
                  <h2 className="text-sm font-medium mb-2">Other Jobs in {country.name}</h2>
                  <div className="space-y-1">
                    {categories
                      .filter((c) => c.slug !== category.slug)
                      .slice(0, 6)
                      .map((cat) => (
                        <Link
                          key={cat.slug}
                          href={`/jobs/${cat.slug}/country/${country.slug}`}
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
                <Badge variant="secondary">{country.flag} {country.name}</Badge>
                <Link href={`/jobs/${category.slug}`}>
                  <Button variant="ghost" size="sm" className="text-xs">
                    Clear country filter
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
                    No {category.name.toLowerCase()} jobs in {country.name} at the moment.
                  </p>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Try browsing:</p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      <Link href={`/jobs/${category.slug}`}>
                        <Button variant="outline" size="sm">All {category.name} Jobs</Button>
                      </Link>
                      {nearbyCountries.slice(0, 3).map((c) => (
                        <Link key={c.slug} href={`/jobs/${category.slug}/country/${c.slug}`}>
                          <Button variant="outline" size="sm">{c.flag} {c.name}</Button>
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
                    <Link href={`/jobs/${category.slug}/country/${country.slug}?page=${currentPage - 1}`}>
                      <Button variant="outline">Previous</Button>
                    </Link>
                  )}
                  <span className="flex items-center px-4 text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  {currentPage < totalPages && (
                    <Link href={`/jobs/${category.slug}/country/${country.slug}?page=${currentPage + 1}`}>
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
              About Remote {category.name} Jobs in {country.name}
            </h2>

            {/* Country-specific intro */}
            {countryContent && (
              <div className="prose prose-sm max-w-none text-muted-foreground mb-8">
                <p>{countryContent.intro}</p>
                <p>{countryContent.whyRemote}</p>
              </div>
            )}

            {/* Key Info Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {/* Salary Info */}
              <div className="bg-muted/50 rounded-lg p-4">
                <h3 className="font-semibold mb-2">Salary in {country.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {avgSalary > 0 ? (
                    <>Average: <span className="text-green-600 font-medium">${avgSalary.toLocaleString()}/yr</span></>
                  ) : (
                    countryContent?.salaryContext || 'Varies by role and experience'
                  )}
                </p>
              </div>

              {/* Timezone */}
              <div className="bg-muted/50 rounded-lg p-4">
                <h3 className="font-semibold mb-2">Timezone</h3>
                <p className="text-sm text-muted-foreground">{country.timezone}</p>
              </div>

              {/* Tech Hubs */}
              {countryContent && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Tech Hubs</h3>
                  <p className="text-sm text-muted-foreground">
                    {countryContent.techHubs.slice(0, 4).join(', ')}
                  </p>
                </div>
              )}
            </div>

            {/* Top Companies */}
            {topCompanies.length > 0 && (
              <div className="mb-8">
                <h3 className="font-semibold mb-3">Top Companies Hiring in {country.name}</h3>
                <div className="flex flex-wrap gap-2">
                  {topCompanies.map((company) => (
                    <Link key={company.slug} href={`/company/${company.slug}`}>
                      <Badge variant="outline" className="hover:bg-muted cursor-pointer">
                        {company.name}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Visa Info */}
            {countryContent && (
              <div className="bg-primary/5 rounded-lg p-6 mb-8">
                <h3 className="font-semibold mb-2">Work Authorization in {country.name}</h3>
                <p className="text-sm text-muted-foreground">{countryContent.visaInfo}</p>
              </div>
            )}

            {/* Skills from category content */}
            {categoryContent && (
              <div className="mb-8">
                <h3 className="font-semibold mb-3">Key Skills for {category.name} Jobs</h3>
                <div className="flex flex-wrap gap-2">
                  {categoryContent.keySkills.slice(0, 8).map((skill, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Related Pages */}
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-3">{category.name} in Other Countries</h3>
                <div className="flex flex-wrap gap-2">
                  {countries
                    .filter((c) => c.slug !== country.slug)
                    .slice(0, 8)
                    .map((c) => (
                      <Link
                        key={c.slug}
                        href={`/jobs/${category.slug}/country/${c.slug}`}
                        className="text-sm text-primary hover:underline"
                      >
                        {c.flag} {c.name}
                      </Link>
                    ))}
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-3">Other Categories in {country.name}</h3>
                <div className="flex flex-wrap gap-2">
                  {categories
                    .filter((c) => c.slug !== category.slug)
                    .slice(0, 8)
                    .map((cat) => (
                      <Link
                        key={cat.slug}
                        href={`/jobs/${cat.slug}/country/${country.slug}`}
                        className="text-sm text-primary hover:underline"
                      >
                        {cat.name}
                      </Link>
                    ))}
                </div>
              </div>
            </div>
          </section>

          {/* FAQ Section */}
          <section className="mt-12">
            <h2 className="text-2xl font-bold mb-4">Frequently Asked Questions</h2>
            <div className="space-y-4">
              <details className="border rounded-lg p-4">
                <summary className="font-medium cursor-pointer">
                  How many remote {category.name.toLowerCase()} jobs are available in {country.name}?
                </summary>
                <p className="mt-2 text-muted-foreground">
                  Currently, there are <strong>{totalJobs} remote {category.name.toLowerCase()} positions</strong> in {country.name} available on Freelanly.
                  New jobs are added daily from LinkedIn and company career pages.
                </p>
              </details>

              <details className="border rounded-lg p-4">
                <summary className="font-medium cursor-pointer">
                  What is the average salary for {category.name.toLowerCase()} jobs in {country.name}?
                </summary>
                <p className="mt-2 text-muted-foreground">
                  {avgSalary > 0 ? (
                    <>Based on current job postings, the average salary for remote {category.name.toLowerCase()} positions in {country.name} is approximately <strong>${avgSalary.toLocaleString()}/year</strong>.</>
                  ) : (
                    <>Salaries for remote {category.name.toLowerCase()} positions in {country.name} vary based on experience, company size, and specific role requirements. {countryContent?.salaryContext}</>
                  )}
                </p>
              </details>

              <details className="border rounded-lg p-4">
                <summary className="font-medium cursor-pointer">
                  Do I need a visa to work remotely for a {country.name} company?
                </summary>
                <p className="mt-2 text-muted-foreground">
                  {countryContent?.visaInfo || `Work authorization requirements vary. Many companies hire international contractors, while full-time employment may require specific work permits.`}
                </p>
              </details>

              <details className="border rounded-lg p-4">
                <summary className="font-medium cursor-pointer">
                  Which companies are hiring for {category.name.toLowerCase()} roles in {country.name}?
                </summary>
                <p className="mt-2 text-muted-foreground">
                  {topCompanies.length > 0 ? (
                    <>Top companies currently hiring include <strong>{topCompanies.map((c) => c.name).join(', ')}</strong>. Browse our listings to see all opportunities.</>
                  ) : (
                    <>Many companies are hiring for remote {category.name.toLowerCase()} positions in {country.name}. Browse our job listings to discover opportunities.</>
                  )}
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

      {/* Noindex for thin content */}
      {shouldNoindex && (
        <meta name="robots" content="noindex, follow" />
      )}
    </div>
  );
}
