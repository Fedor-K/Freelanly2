import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { JobCard } from '@/components/jobs/JobCard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { siteConfig } from '@/config/site';
import { prisma } from '@/lib/db';
import { getMaxJobAgeDate } from '@/lib/utils';

interface CompanyJobsPageProps {
  params: Promise<{ companySlug: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params }: CompanyJobsPageProps): Promise<Metadata> {
  const { companySlug } = await params;

  let company;
  try {
    company = await prisma.company.findUnique({
      where: { slug: companySlug },
      select: { name: true },
    });
  } catch {
    return { title: 'Jobs Not Found' };
  }

  if (!company) {
    return { title: 'Jobs Not Found' };
  }

  const title = `Jobs at ${company.name} - All Open Positions`;
  const description = `Browse all remote job openings at ${company.name}. Find your next opportunity and apply today.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${siteConfig.url}/company/${companySlug}/jobs`,
      type: 'website',
    },
    alternates: {
      canonical: `${siteConfig.url}/company/${companySlug}/jobs`,
    },
  };
}

export default async function CompanyJobsPage({ params, searchParams }: CompanyJobsPageProps) {
  const { companySlug } = await params;
  const { page = '1' } = await searchParams;

  const currentPage = parseInt(page, 10) || 1;
  const perPage = 20;
  const maxAgeDate = getMaxJobAgeDate();

  let company;
  let jobs: any[] = [];
  let totalJobs = 0;

  try {
    company = await prisma.company.findUnique({
      where: { slug: companySlug },
    });

    if (company) {
      const jobWhere = {
        companyId: company.id,
        isActive: true,
        postedAt: { gte: maxAgeDate },
      };
      [jobs, totalJobs] = await Promise.all([
        prisma.job.findMany({
          where: jobWhere,
          include: {
            company: { select: { name: true, slug: true, logo: true } },
          },
          orderBy: { postedAt: 'desc' },
          skip: (currentPage - 1) * perPage,
          take: perPage,
        }),
        prisma.job.count({ where: jobWhere }),
      ]);
    }
  } catch (error) {
    console.error('Failed to fetch company jobs:', error);
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
          { '@type': 'ListItem', position: 3, name: 'Jobs', item: `${siteConfig.url}/company/${companySlug}/jobs` },
        ],
      },
      {
        '@type': 'ItemList',
        name: `All Jobs at ${company.name}`,
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
              <li><Link href={`/company/${companySlug}`} className="hover:text-foreground">{company.name}</Link></li>
              <li>/</li>
              <li className="text-foreground font-medium">Jobs</li>
            </ol>
          </nav>

          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">
              Jobs at {company.name}
            </h1>
            <p className="text-muted-foreground">
              {totalJobs} {totalJobs === 1 ? 'open position' : 'open positions'}
            </p>
          </div>

          {/* Jobs List */}
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
                <Link href={`/company/${companySlug}/jobs?page=${currentPage - 1}`}>
                  <Button variant="outline">Previous</Button>
                </Link>
              )}
              <span className="flex items-center px-4 text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              {currentPage < totalPages && (
                <Link href={`/company/${companySlug}/jobs?page=${currentPage + 1}`}>
                  <Button variant="outline">Next</Button>
                </Link>
              )}
            </nav>
          )}
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
