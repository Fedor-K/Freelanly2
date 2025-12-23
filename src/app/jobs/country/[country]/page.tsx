import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { JobCard } from '@/components/jobs/JobCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { siteConfig, countries, categories } from '@/config/site';
import { prisma } from '@/lib/db';
import { getMaxJobAgeDate } from '@/lib/utils';

interface CountryPageProps {
  params: Promise<{ country: string }>;
  searchParams: Promise<{ page?: string; category?: string }>;
}

const JOBS_PER_PAGE = 20;

export async function generateStaticParams() {
  return countries.map((c) => ({ country: c.slug }));
}

export async function generateMetadata({ params }: CountryPageProps): Promise<Metadata> {
  const { country: countrySlug } = await params;
  const country = countries.find((c) => c.slug === countrySlug);

  if (!country) {
    return { title: 'Not Found' };
  }

  const title = `Remote Jobs in ${country.name} - Work From Home Positions | Freelanly`;
  const description = `Find remote jobs available in ${country.name}. Browse work from home positions for ${country.name} residents. Updated daily.`;

  return {
    title,
    description,
    keywords: [
      `remote jobs ${country.name}`,
      `work from home ${country.name}`,
      `${country.name} remote positions`,
    ],
    openGraph: {
      title,
      description,
      url: `${siteConfig.url}/jobs/country/${country.slug}`,
      siteName: siteConfig.name,
      type: 'website',
    },
    alternates: {
      canonical: `${siteConfig.url}/jobs/country/${country.slug}`,
    },
  };
}

export default async function CountryPage({ params, searchParams }: CountryPageProps) {
  const { country: countrySlug } = await params;
  const { page = '1', category } = await searchParams;

  const country = countries.find((c) => c.slug === countrySlug);

  if (!country) {
    notFound();
  }

  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const maxAgeDate = getMaxJobAgeDate();

  const where: any = {
    isActive: true,
    postedAt: { gte: maxAgeDate },
  };

  if (country.code) {
    where.country = country.code;
  }

  if (category) {
    where.category = { slug: category };
  }

  const [jobs, totalJobs] = await Promise.all([
    prisma.job.findMany({
      where,
      include: {
        company: { select: { name: true, slug: true, logo: true, website: true } },
      },
      orderBy: { postedAt: 'desc' },
      skip: (currentPage - 1) * JOBS_PER_PAGE,
      take: JOBS_PER_PAGE,
    }),
    prisma.job.count({ where }),
  ]);

  const totalPages = Math.ceil(totalJobs / JOBS_PER_PAGE);
  const otherCountries = countries.filter((c) => c.slug !== country.slug).slice(0, 10);

  const buildUrl = (newPage: number) => {
    const urlParams = new URLSearchParams();
    if (newPage > 1) urlParams.set('page', String(newPage));
    if (category) urlParams.set('category', category);
    const queryString = urlParams.toString();
    return `/jobs/country/${countrySlug}${queryString ? '?' + queryString : ''}`;
  };

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: siteConfig.url },
          { '@type': 'ListItem', position: 2, name: 'Jobs', item: `${siteConfig.url}/jobs` },
          { '@type': 'ListItem', position: 3, name: `Jobs in ${country.name}`, item: `${siteConfig.url}/jobs/country/${countrySlug}` },
        ],
      },
      {
        '@type': 'ItemList',
        name: `Remote Jobs in ${country.name}`,
        numberOfItems: totalJobs,
        itemListElement: jobs.map((job, i) => ({
          '@type': 'ListItem',
          position: (currentPage - 1) * JOBS_PER_PAGE + i + 1,
          url: `${siteConfig.url}/company/${job.company.slug}/jobs/${job.slug}`,
          name: `${job.title} at ${job.company.name}`,
        })),
      },
    ],
  };

  const faqData = [
    {
      question: `How many remote jobs are available in ${country.name}?`,
      answer: `We currently have ${totalJobs} remote positions available for ${country.name}. New jobs are added daily.`,
    },
    {
      question: `Do I need to be located in ${country.name}?`,
      answer: `Most jobs listed accept applicants from ${country.name}. Check each listing for specific requirements.`,
    },
  ];

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqData.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="container py-8">
          <nav className="mb-6 text-sm text-muted-foreground" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-2">
              <li><Link href="/" className="hover:text-foreground">Home</Link></li>
              <li>/</li>
              <li><Link href="/jobs" className="hover:text-foreground">Jobs</Link></li>
              <li>/</li>
              <li className="text-foreground font-medium">{country.name}</li>
            </ol>
          </nav>

          <header className="mb-8 pb-8 border-b">
            <h1 className="text-4xl font-bold mb-4">
              {country.flag} Remote Jobs in {country.name}
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl">
              Find remote positions available for {country.name} residents.
              {totalJobs > 0 && ` ${totalJobs} jobs available.`}
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              <Badge variant="secondary">{country.name}</Badge>
              <Badge variant="outline">Remote</Badge>
              <Badge variant="outline">{totalJobs} positions</Badge>
            </div>
          </header>

          <div className="flex gap-8">
            <aside className="hidden lg:block w-64 flex-shrink-0">
              <div className="sticky top-20 space-y-6">
                <div>
                  <h2 className="text-sm font-medium mb-2">Filter by Category</h2>
                  <div className="space-y-1">
                    <Link
                      href={`/jobs/country/${countrySlug}`}
                      className={`block px-3 py-1.5 text-sm rounded ${!category ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                    >
                      All Categories
                    </Link>
                    {categories.slice(0, 10).map((cat) => (
                      <Link
                        key={cat.slug}
                        href={`/jobs/country/${countrySlug}?category=${cat.slug}`}
                        className={`block px-3 py-1.5 text-sm rounded ${category === cat.slug ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                      >
                        {cat.icon} {cat.name}
                      </Link>
                    ))}
                  </div>
                </div>
                <div>
                  <h2 className="text-sm font-medium mb-2">Other Countries</h2>
                  <div className="space-y-1">
                    {otherCountries.map((c) => (
                      <Link
                        key={c.slug}
                        href={`/jobs/country/${c.slug}`}
                        className="block px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                      >
                        {c.flag} {c.name}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </aside>

            <div className="flex-1">
              {category && (
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-sm text-muted-foreground">Filters:</span>
                  <Link href={`/jobs/country/${countrySlug}`}>
                    <Badge variant="secondary" className="cursor-pointer hover:bg-destructive/20">
                      {categories.find((c) => c.slug === category)?.name || category} ×
                    </Badge>
                  </Link>
                </div>
              )}

              {jobs.length > 0 ? (
                <div className="space-y-4">
                  {jobs.map((job) => (
                    <JobCard key={job.id} job={job} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No jobs found for {country.name}.</p>
                  <Link href="/jobs" className="text-primary hover:underline mt-2 inline-block">
                    Browse all jobs
                  </Link>
                </div>
              )}

              {totalPages > 1 && (
                <nav className="mt-8 flex justify-center gap-2">
                  {currentPage > 1 && (
                    <Link href={buildUrl(currentPage - 1)}>
                      <Button variant="outline">Previous</Button>
                    </Link>
                  )}
                  <span className="flex items-center px-4 text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  {currentPage < totalPages && (
                    <Link href={buildUrl(currentPage + 1)}>
                      <Button variant="outline">Next</Button>
                    </Link>
                  )}
                </nav>
              )}
            </div>
          </div>

          <section className="mt-16 border-t pt-8">
            <h2 className="text-2xl font-bold mb-4">About Remote Jobs in {country.name}</h2>
            <div className="prose prose-sm max-w-none text-muted-foreground space-y-4">
              <p>
                {country.name} has a thriving remote work scene. We aggregate remote jobs from LinkedIn,
                company career pages, and job boards, filtering for positions available to {country.name} residents.
              </p>
            </div>
            <div className="mt-8">
              <h3 className="font-semibold mb-3">Explore Jobs by Country</h3>
              <div className="flex flex-wrap gap-2">
                {otherCountries.map((c) => (
                  <Link
                    key={c.slug}
                    href={`/jobs/country/${c.slug}`}
                    className="text-sm px-3 py-1 bg-muted rounded-full hover:bg-muted/80"
                  >
                    {c.flag} {c.name}
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-12">
            <h2 className="text-2xl font-bold mb-4">FAQ</h2>
            <div className="space-y-4">
              {faqData.map((faq, i) => (
                <details key={i} className="border rounded-lg p-4">
                  <summary className="font-medium cursor-pointer">{faq.question}</summary>
                  <p className="mt-2 text-muted-foreground">{faq.answer}</p>
                </details>
              ))}
            </div>
          </section>
        </div>
      </main>
      <Footer />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </div>
  );
}
