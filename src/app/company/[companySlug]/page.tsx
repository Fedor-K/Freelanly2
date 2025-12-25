import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { JobCard } from '@/components/jobs/JobCard';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CompanyLogo } from '@/components/ui/CompanyLogo';
import { siteConfig } from '@/config/site';
import { prisma } from '@/lib/db';
import { getMaxJobAgeDate } from '@/lib/utils';

interface CompanyPageProps {
  params: Promise<{ companySlug: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params }: CompanyPageProps): Promise<Metadata> {
  const { companySlug } = await params;

  let company;
  try {
    company = await prisma.company.findUnique({
      where: { slug: companySlug },
      select: { name: true, description: true, industry: true },
    });
  } catch {
    return { title: 'Company Not Found' };
  }

  if (!company) {
    return { title: 'Company Not Found' };
  }

  // Truncate title to 60 chars for SEO
  const fullTitle = `${company.name} Remote Jobs - Work at ${company.name}`;
  const seoTitle = fullTitle.length > 60
    ? `${company.name} Remote Jobs`.slice(0, 57) + '...'
    : fullTitle;
  const description = company.description
    ? company.description.slice(0, 155)
    : `Find remote jobs at ${company.name}. Browse open positions and apply to work at ${company.name}.`;

  return {
    title: seoTitle,
    description,
    keywords: [
      `${company.name} jobs`,
      `${company.name} remote`,
      `${company.name} careers`,
      `work at ${company.name}`,
    ],
    openGraph: {
      title: seoTitle,
      description,
      url: `${siteConfig.url}/company/${companySlug}`,
      type: 'website',
    },
    alternates: {
      canonical: `${siteConfig.url}/company/${companySlug}`,
    },
  };
}

export default async function CompanyPage({ params, searchParams }: CompanyPageProps) {
  const { companySlug } = await params;
  const { page = '1' } = await searchParams;

  const currentPage = parseInt(page, 10) || 1;
  const perPage = 20;

  let company;
  let jobs: any[] = [];
  let totalJobs = 0;

  try {
    const maxAgeDate = getMaxJobAgeDate();
    company = await prisma.company.findUnique({
      where: { slug: companySlug },
      include: {
        _count: {
          select: { jobs: { where: { isActive: true, postedAt: { gte: maxAgeDate } } } },
        },
      },
    });

    if (company) {
      [jobs, totalJobs] = await Promise.all([
        prisma.job.findMany({
          where: {
            companyId: company.id,
            isActive: true,
            postedAt: { gte: maxAgeDate },
          },
          include: {
            company: { select: { name: true, slug: true, logo: true, website: true } },
          },
          orderBy: { postedAt: 'desc' },
          skip: (currentPage - 1) * perPage,
          take: perPage,
        }),
        prisma.job.count({
          where: {
            companyId: company.id,
            isActive: true,
            postedAt: { gte: maxAgeDate },
          },
        }),
      ]);
    }
  } catch (error) {
    console.error('Failed to fetch company:', error);
  }

  if (!company) {
    notFound();
  }

  const totalPages = Math.ceil(totalJobs / perPage);

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: siteConfig.url },
          { '@type': 'ListItem', position: 2, name: company.name, item: `${siteConfig.url}/company/${companySlug}` },
        ],
      },
      {
        '@type': 'Organization',
        '@id': `${siteConfig.url}/company/${companySlug}#organization`,
        name: company.name,
        url: company.website || undefined,
        logo: company.logo || undefined,
        description: company.description || undefined,
        sameAs: [company.linkedinUrl, company.website].filter(Boolean),
        ...(company.foundedYear && { foundingDate: String(company.foundedYear) }),
        ...(company.headquarters && {
          address: {
            '@type': 'PostalAddress',
            addressLocality: company.headquarters,
          },
        }),
      },
      {
        '@type': 'ItemList',
        name: `Jobs at ${company.name}`,
        numberOfItems: totalJobs,
        itemListElement: jobs.map((job, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `${siteConfig.url}/company/${companySlug}/jobs/${job.slug}`,
          name: job.title,
        })),
      },
    ],
  };

  function formatSize(size: string | null): string {
    const map: Record<string, string> = {
      STARTUP: '1-10 employees',
      SMALL: '11-50 employees',
      MEDIUM: '51-200 employees',
      LARGE: '201-1000 employees',
      ENTERPRISE: '1000+ employees',
    };
    return size ? map[size] || size : 'Unknown';
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="container py-8">
          {/* Breadcrumbs - RRS style */}
          <nav className="mb-6 text-sm text-muted-foreground" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-2">
              <li><Link href="/" className="hover:text-foreground">Home</Link></li>
              <li>/</li>
              <li className="text-foreground font-medium">{company.name}</li>
            </ol>
          </nav>

          {/* Company Header */}
          <header className="mb-8 pb-8 border-b">
            <div className="flex items-start gap-6">
              <CompanyLogo
                name={company.name}
                logo={company.logo}
                website={company.website}
                size="xl"
                className="w-24 h-24 rounded-xl text-4xl"
              />
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold">{company.name}</h1>
                  {company.verified && (
                    <Badge variant="secondary">Verified</Badge>
                  )}
                </div>
                {company.industry && (
                  <p className="text-lg text-muted-foreground mb-2">{company.industry}</p>
                )}
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  {company.headquarters && (
                    <span>📍 {company.headquarters}</span>
                  )}
                  {company.size && (
                    <span>👥 {formatSize(company.size)}</span>
                  )}
                  {company.foundedYear && (
                    <span>📅 Founded {company.foundedYear}</span>
                  )}
                </div>
                <div className="flex gap-2 mt-4">
                  {company.website && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={company.website} target="_blank" rel="noopener noreferrer">
                        Website →
                      </a>
                    </Button>
                  )}
                  {company.linkedinUrl && (
                    <Button variant="ghost" size="sm" asChild>
                      <a href={company.linkedinUrl} target="_blank" rel="noopener noreferrer">
                        LinkedIn
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {company.description && (
              <div className="mt-6">
                <h2 className="font-semibold mb-2">About {company.name}</h2>
                <p className="text-muted-foreground">{company.description}</p>
              </div>
            )}
          </header>

          {/* Jobs Section */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">
                Open Positions at {company.name}
                {totalJobs > 0 && (
                  <span className="text-lg font-normal text-muted-foreground ml-2">
                    ({totalJobs} {totalJobs === 1 ? 'job' : 'jobs'})
                  </span>
                )}
              </h2>
              {totalJobs > 0 && (
                <Link href={`/company/${companySlug}/jobs`} className="text-primary hover:underline text-sm">
                  View all jobs →
                </Link>
              )}
            </div>

            {jobs.length > 0 ? (
              <div className="space-y-4">
                {jobs.map((job) => (
                  <JobCard key={job.id} job={job} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">
                    No open positions at {company.name} right now.
                  </p>
                  <Link href="/jobs" className="text-primary hover:underline mt-2 inline-block">
                    Browse all remote jobs
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <nav className="mt-8 flex justify-center gap-2">
                {currentPage > 1 && (
                  <Link href={`/company/${companySlug}?page=${currentPage - 1}`}>
                    <Button variant="outline">Previous</Button>
                  </Link>
                )}
                <span className="flex items-center px-4 text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                {currentPage < totalPages && (
                  <Link href={`/company/${companySlug}?page=${currentPage + 1}`}>
                    <Button variant="outline">Next</Button>
                  </Link>
                )}
              </nav>
            )}
          </section>

          {/* SEO Content */}
          <section className="mt-16 border-t pt-8">
            <h2 className="text-2xl font-bold mb-4">
              Working at {company.name}
            </h2>
            <div className="prose prose-sm max-w-none text-muted-foreground">
              <p>
                {company.name} is hiring for remote positions.
                {company.industry && ` As a ${company.industry.toLowerCase()} company,`} they offer
                opportunities for talented professionals to work from anywhere.
              </p>
              <p>
                Check out the open positions above and apply directly.
                We aggregate job postings from {company.name}&apos;s career page and LinkedIn
                to make it easier for you to find and apply.
              </p>
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
