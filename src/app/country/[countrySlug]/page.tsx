import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { JobCard } from '@/components/jobs/JobCard';
import { JobFilters } from '@/components/jobs/JobFilters';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { siteConfig, countries, jobRoles } from '@/config/site';
import { prisma } from '@/lib/db';

interface CountryPageProps {
  params: Promise<{ countrySlug: string }>;
  searchParams: Promise<{
    page?: string;
    tech?: string;
    salary?: string;
    size?: string;
    level?: string;
    type?: string;
  }>;
}

function getCountryBySlug(slug: string) {
  return countries.find(c => c.slug === slug);
}

export async function generateStaticParams() {
  return countries.map((country) => ({
    countrySlug: country.slug,
  }));
}

export async function generateMetadata({ params }: CountryPageProps): Promise<Metadata> {
  const { countrySlug } = await params;
  const country = getCountryBySlug(countrySlug);

  if (!country) {
    return { title: 'Country Not Found' };
  }

  const title = `Remote Jobs in ${country.name} ${country.flag} - Work From Home Jobs | Freelanly`;
  const description = `Find remote jobs in ${country.name}. Browse ${country.name === 'Worldwide' ? 'global' : country.name} remote work opportunities. Apply directly to companies hiring remote workers.`;

  return {
    title,
    description,
    keywords: [
      `remote jobs ${country.name}`,
      `work from home ${country.name}`,
      `remote work ${country.name}`,
      `${country.name} remote jobs`,
      `remote developer jobs ${country.name}`,
    ],
    openGraph: {
      title,
      description,
      url: `${siteConfig.url}/country/${countrySlug}`,
      siteName: siteConfig.name,
    },
    alternates: {
      canonical: `${siteConfig.url}/country/${countrySlug}`,
    },
  };
}

export default async function CountryPage({ params, searchParams }: CountryPageProps) {
  const { countrySlug } = await params;
  const filters = await searchParams;
  const country = getCountryBySlug(countrySlug);

  if (!country) {
    notFound();
  }

  const currentPage = parseInt(filters.page || '1', 10) || 1;
  const perPage = 20;

  // Build filter conditions
  const whereConditions: any = {
    isActive: true,
  };

  // Country filter
  if (country.code) {
    whereConditions.country = country.code;
  }

  // Tech stack filter
  if (filters.tech) {
    whereConditions.skills = { hasSome: [filters.tech] };
  }

  // Salary filter
  if (filters.salary) {
    const [min, max] = filters.salary.split('-').map(Number);
    if (min) whereConditions.salaryMin = { gte: min };
    if (max) whereConditions.salaryMax = { lte: max };
  }

  // Company size filter
  if (filters.size) {
    whereConditions.company = { size: filters.size };
  }

  // Level filter
  if (filters.level) {
    whereConditions.level = filters.level;
  }

  // Job type filter
  if (filters.type) {
    whereConditions.type = filters.type;
  }

  let jobs: any[] = [];
  let totalJobs = 0;

  try {
    [jobs, totalJobs] = await Promise.all([
      prisma.job.findMany({
        where: whereConditions,
        include: {
          company: { select: { name: true, slug: true, logo: true, size: true } },
        },
        orderBy: { postedAt: 'desc' },
        skip: (currentPage - 1) * perPage,
        take: perPage,
      }),
      prisma.job.count({ where: whereConditions }),
    ]);
  } catch (error) {
    console.error('Failed to fetch jobs:', error);
  }

  const totalPages = Math.ceil(totalJobs / perPage);

  // Get popular roles for this country
  const popularRoles = jobRoles.slice(0, 8);

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: siteConfig.url },
          { '@type': 'ListItem', position: 2, name: 'Countries', item: `${siteConfig.url}/country` },
          { '@type': 'ListItem', position: 3, name: country.name, item: `${siteConfig.url}/country/${countrySlug}` },
        ],
      },
      {
        '@type': 'ItemList',
        name: `Remote Jobs in ${country.name}`,
        numberOfItems: totalJobs,
        itemListElement: jobs.map((job, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `${siteConfig.url}/company/${job.company.slug}/jobs/${job.slug}`,
          name: `${job.title} at ${job.company.name}`,
        })),
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: `How many remote jobs are available in ${country.name}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `Currently there are ${totalJobs} remote job opportunities available in ${country.name} on Freelanly.`,
            },
          },
          {
            '@type': 'Question',
            name: `What types of remote jobs are most common in ${country.name}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `Popular remote roles in ${country.name} include Software Engineer, Frontend Developer, Backend Developer, DevOps Engineer, and Product Manager positions.`,
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
              <li><Link href="/country" className="hover:text-foreground">Countries</Link></li>
              <li>/</li>
              <li className="text-foreground font-medium">{country.flag} {country.name}</li>
            </ol>
          </nav>

          {/* Page Header */}
          <header className="mb-8">
            <h1 className="text-3xl font-bold mb-2">
              {country.flag} Remote Jobs in {country.name}
            </h1>
            <p className="text-muted-foreground">
              {totalJobs} remote {totalJobs === 1 ? 'job' : 'jobs'} available
              {country.name !== 'Worldwide' && ` for ${country.name}-based professionals`}
            </p>
          </header>

          {/* Popular Roles Links */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">Popular Roles in {country.name}</h2>
            <div className="flex flex-wrap gap-2">
              {popularRoles.map((role) => (
                <Link
                  key={role.slug}
                  href={`/country/${countrySlug}/jobs/${role.slug}`}
                  className="px-3 py-1.5 bg-muted hover:bg-muted/80 rounded-full text-sm transition-colors"
                >
                  {role.name}
                </Link>
              ))}
            </div>
          </section>

          <div className="flex gap-8">
            {/* Filters Sidebar */}
            <aside className="hidden lg:block w-64 flex-shrink-0">
              <JobFilters
                basePath={`/country/${countrySlug}`}
                currentFilters={filters}
              />
            </aside>

            {/* Job List */}
            <div className="flex-1">
              {jobs.length > 0 ? (
                <div className="space-y-4">
                  {jobs.map((job) => (
                    <JobCard key={job.id} job={job} />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground mb-4">
                      No jobs found matching your filters in {country.name}.
                    </p>
                    <Link href={`/country/${countrySlug}`}>
                      <Button variant="outline">Clear Filters</Button>
                    </Link>
                  </CardContent>
                </Card>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <nav className="mt-8 flex justify-center gap-2">
                  {currentPage > 1 && (
                    <Link href={`/country/${countrySlug}?page=${currentPage - 1}`}>
                      <Button variant="outline">Previous</Button>
                    </Link>
                  )}
                  <span className="flex items-center px-4 text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  {currentPage < totalPages && (
                    <Link href={`/country/${countrySlug}?page=${currentPage + 1}`}>
                      <Button variant="outline">Next</Button>
                    </Link>
                  )}
                </nav>
              )}
            </div>
          </div>

          {/* SEO Content */}
          <section className="mt-16 border-t pt-8">
            <h2 className="text-2xl font-bold mb-4">
              Find Remote Work in {country.name}
            </h2>
            <div className="prose prose-sm max-w-none text-muted-foreground">
              <p>
                Looking for remote jobs in {country.name}? Freelanly aggregates remote job postings
                from LinkedIn and top tech companies hiring {country.name === 'Worldwide' ? 'globally' : `in ${country.name}`}.
                We update our job listings daily to ensure you have access to the latest opportunities.
              </p>
              <p>
                Whether you&apos;re a software engineer, designer, product manager, or marketing professional,
                you&apos;ll find quality remote positions that match your skills. Filter by tech stack,
                salary range, company size, and seniority level to find your perfect role.
              </p>
            </div>

            {/* Other Countries */}
            <div className="mt-8">
              <h3 className="font-semibold mb-3">Browse Jobs in Other Countries</h3>
              <div className="flex flex-wrap gap-2">
                {countries
                  .filter(c => c.slug !== countrySlug)
                  .slice(0, 10)
                  .map((c) => (
                    <Link
                      key={c.slug}
                      href={`/country/${c.slug}`}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      {c.flag} {c.name}
                    </Link>
                  ))}
              </div>
            </div>
          </section>
        </div>
      </main>

      <Footer />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
    </div>
  );
}
