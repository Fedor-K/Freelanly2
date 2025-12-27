import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { JobCard } from '@/components/jobs/JobCard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { siteConfig, countries, jobRoles } from '@/config/site';
import { truncateTitle } from '@/lib/seo';
import { prisma } from '@/lib/db';
import { getMaxJobAgeDate } from '@/lib/utils';

interface CountryRolePageProps {
  params: Promise<{ countrySlug: string; roleSlug: string }>;
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

function getRoleBySlug(slug: string) {
  return jobRoles.find(r => r.slug === slug);
}

export async function generateStaticParams() {
  const params: { countrySlug: string; roleSlug: string }[] = [];

  for (const country of countries) {
    for (const role of jobRoles) {
      params.push({
        countrySlug: country.slug,
        roleSlug: role.slug,
      });
    }
  }

  return params;
}

export async function generateMetadata({ params }: CountryRolePageProps): Promise<Metadata> {
  const { countrySlug, roleSlug } = await params;
  const country = getCountryBySlug(countrySlug);
  const role = getRoleBySlug(roleSlug);

  if (!country || !role) {
    return { title: 'Page Not Found' };
  }

  // Use SEO utility for consistent title truncation (max 60 chars)
  const seoTitle = truncateTitle(`Remote ${role.name} Jobs in ${country.name} ${country.flag}`);
  const description = `Find remote ${role.name} jobs in ${country.name}. Browse ${role.name} positions from top companies hiring ${country.name === 'Worldwide' ? 'globally' : `in ${country.name}`}. Apply today!`;

  return {
    title: seoTitle,
    description,
    keywords: [
      `remote ${role.name.toLowerCase()} ${country.name}`,
      `${role.name.toLowerCase()} jobs ${country.name}`,
      `remote ${role.name.toLowerCase()}`,
      `work from home ${role.name.toLowerCase()}`,
      `${country.name} ${role.name.toLowerCase()} jobs`,
    ],
    openGraph: {
      title: seoTitle,
      description,
      url: `${siteConfig.url}/country/${countrySlug}/jobs/${roleSlug}`,
      siteName: siteConfig.name,
    },
    alternates: {
      canonical: `${siteConfig.url}/country/${countrySlug}/jobs/${roleSlug}`,
    },
  };
}

export default async function CountryRolePage({ params, searchParams }: CountryRolePageProps) {
  const { countrySlug, roleSlug } = await params;
  const filters = await searchParams;
  const country = getCountryBySlug(countrySlug);
  const role = getRoleBySlug(roleSlug);

  if (!country || !role) {
    notFound();
  }

  const currentPage = parseInt(filters.page || '1', 10) || 1;
  const perPage = 20;
  const maxAgeDate = getMaxJobAgeDate();

  // Build filter conditions
  const whereConditions: any = {
    isActive: true,
    postedAt: { gte: maxAgeDate },
    OR: role.keywords.map(keyword => ({
      title: { contains: keyword, mode: 'insensitive' },
    })),
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
          company: { select: { name: true, slug: true, logo: true, website: true, size: true } },
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

  // Get related roles
  const relatedRoles = jobRoles.filter(r => r.slug !== roleSlug).slice(0, 6);

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: siteConfig.url },
          { '@type': 'ListItem', position: 2, name: 'Countries', item: `${siteConfig.url}/country` },
          { '@type': 'ListItem', position: 3, name: country.name, item: `${siteConfig.url}/country/${countrySlug}` },
          { '@type': 'ListItem', position: 4, name: role.name, item: `${siteConfig.url}/country/${countrySlug}/jobs/${roleSlug}` },
        ],
      },
      {
        '@type': 'ItemList',
        name: `Remote ${role.name} Jobs in ${country.name}`,
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
            name: `How many remote ${role.name} jobs are available in ${country.name}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `Currently there are ${totalJobs} remote ${role.name} positions available in ${country.name} on Freelanly.`,
            },
          },
          {
            '@type': 'Question',
            name: `What is the average salary for remote ${role.name} in ${country.name}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `Remote ${role.name} salaries in ${country.name} typically range from $80,000 to $180,000 depending on experience level and company size.`,
            },
          },
          {
            '@type': 'Question',
            name: `What skills are required for remote ${role.name} jobs?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `Common skills for ${role.name} positions include ${role.keywords.join(', ')} and strong communication abilities for remote work.`,
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
              <li><Link href={`/country/${countrySlug}`} className="hover:text-foreground">{country.name}</Link></li>
              <li>/</li>
              <li className="text-foreground font-medium">{role.name}</li>
            </ol>
          </nav>

          {/* Page Header */}
          <header className="mb-8">
            <h1 className="text-3xl font-bold mb-2">
              {country.flag} Remote {role.name} Jobs in {country.name}
            </h1>
            <p className="text-muted-foreground">
              {totalJobs} {role.name.toLowerCase()} {totalJobs === 1 ? 'position' : 'positions'} available
              {country.name !== 'Worldwide' && ` in ${country.name}`}
            </p>
          </header>

          {/* Related Roles */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">Related Roles in {country.name}</h2>
            <div className="flex flex-wrap gap-2">
              {relatedRoles.map((r) => (
                <Link
                  key={r.slug}
                  href={`/country/${countrySlug}/jobs/${r.slug}`}
                  className="px-3 py-1.5 bg-muted hover:bg-muted/80 rounded-full text-sm transition-colors"
                >
                  {r.name}
                </Link>
              ))}
            </div>
          </section>

          <div>
            {/* Job List */}
            <div>
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
                      No {role.name.toLowerCase()} jobs found in {country.name} matching your filters.
                    </p>
                    <div className="flex gap-2 justify-center">
                      <Link href={`/country/${countrySlug}/jobs/${roleSlug}`}>
                        <Button variant="outline">Clear Filters</Button>
                      </Link>
                      <Link href={`/country/${countrySlug}`}>
                        <Button variant="ghost">View All Jobs</Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <nav className="mt-8 flex justify-center gap-2">
                  {currentPage > 1 && (
                    <Link href={`/country/${countrySlug}/jobs/${roleSlug}?page=${currentPage - 1}`}>
                      <Button variant="outline">Previous</Button>
                    </Link>
                  )}
                  <span className="flex items-center px-4 text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  {currentPage < totalPages && (
                    <Link href={`/country/${countrySlug}/jobs/${roleSlug}?page=${currentPage + 1}`}>
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
              Remote {role.name} Opportunities in {country.name}
            </h2>
            <div className="prose prose-sm max-w-none text-muted-foreground">
              <p>
                Find the best remote {role.name.toLowerCase()} jobs in {country.name} on Freelanly.
                We aggregate job postings from LinkedIn and leading tech companies to bring you
                quality {role.name.toLowerCase()} positions with competitive salaries and benefits.
              </p>
              <p>
                As a remote {role.name.toLowerCase()}, you can work from anywhere in {country.name}
                while collaborating with global teams. Use our filters to find positions that match
                your experience level, preferred tech stack, and salary expectations.
              </p>
            </div>

            {/* Other Countries for this role */}
            <div className="mt-8">
              <h3 className="font-semibold mb-3">{role.name} Jobs in Other Countries</h3>
              <div className="flex flex-wrap gap-2">
                {countries
                  .filter(c => c.slug !== countrySlug)
                  .slice(0, 10)
                  .map((c) => (
                    <Link
                      key={c.slug}
                      href={`/country/${c.slug}/jobs/${roleSlug}`}
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
