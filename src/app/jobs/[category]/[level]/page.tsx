import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { JobCard } from '@/components/jobs/JobCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { siteConfig, categories, levels } from '@/config/site';
import { truncateTitle } from '@/lib/seo';
import { prisma } from '@/lib/db';
import { getMaxJobAgeDate } from '@/lib/utils';

interface CategoryLevelPageProps {
  params: Promise<{ category: string; level: string }>;
  searchParams: Promise<{ page?: string }>;
}

// Generate static params for all category + level combinations
export async function generateStaticParams() {
  const params: { category: string; level: string }[] = [];

  for (const cat of categories) {
    for (const lvl of levels) {
      params.push({
        category: cat.slug,
        level: lvl.value.toLowerCase(),
      });
    }
  }

  return params;
}

export async function generateMetadata({ params }: CategoryLevelPageProps): Promise<Metadata> {
  const { category: categorySlug, level: levelSlug } = await params;

  const category = categories.find((c) => c.slug === categorySlug);
  const level = levels.find((l) => l.value.toLowerCase() === levelSlug.toLowerCase());

  if (!category || !level) {
    return { title: 'Not Found' };
  }

  // Use SEO utility for consistent title truncation (max 60 chars)
  const seoTitle = truncateTitle(`${level.label} Remote ${category.name} Jobs - ${level.label} ${category.name} Positions`);
  const description = `Find ${level.label.toLowerCase()} ${category.name.toLowerCase()} remote jobs. Browse work from home ${level.label.toLowerCase()} ${category.name.toLowerCase()} positions at top companies.`;

  return {
    title: seoTitle,
    description,
    keywords: [
      `${level.label.toLowerCase()} ${category.name.toLowerCase()} jobs`,
      `remote ${level.label.toLowerCase()} ${category.name.toLowerCase()}`,
      `${level.label.toLowerCase()} ${category.name.toLowerCase()} remote`,
      `work from home ${level.label.toLowerCase()} ${category.name.toLowerCase()}`,
    ],
    openGraph: {
      title: seoTitle,
      description,
      url: `${siteConfig.url}/jobs/${category.slug}/${levelSlug}`,
      type: 'website',
    },
    alternates: {
      canonical: `${siteConfig.url}/jobs/${category.slug}/${levelSlug}`,
    },
  };
}

export default async function CategoryLevelPage({ params, searchParams }: CategoryLevelPageProps) {
  const { category: categorySlug, level: levelSlug } = await params;
  const { page = '1' } = await searchParams;

  const category = categories.find((c) => c.slug === categorySlug);
  const level = levels.find((l) => l.value.toLowerCase() === levelSlug.toLowerCase());

  if (!category || !level) {
    notFound();
  }

  const currentPage = parseInt(page, 10) || 1;
  const perPage = 20;

  let jobs: any[] = [];
  let totalJobs = 0;

  try {
    const maxAgeDate = getMaxJobAgeDate();
    const where = {
      isActive: true,
      postedAt: { gte: maxAgeDate },
      category: { slug: categorySlug },
      level: level.value,
    };

    [jobs, totalJobs] = await Promise.all([
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
    ]);
  } catch (error) {
    console.error('Failed to fetch jobs:', error);
  }

  const totalPages = Math.ceil(totalJobs / perPage);

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: siteConfig.url },
          { '@type': 'ListItem', position: 2, name: 'Jobs', item: `${siteConfig.url}/jobs` },
          { '@type': 'ListItem', position: 3, name: `${category.name} Jobs`, item: `${siteConfig.url}/jobs/${category.slug}` },
          { '@type': 'ListItem', position: 4, name: `${level.label} ${category.name} Jobs`, item: `${siteConfig.url}/jobs/${category.slug}/${levelSlug}` },
        ],
      },
      {
        '@type': 'ItemList',
        name: `${level.label} Remote ${category.name} Jobs`,
        numberOfItems: totalJobs,
        itemListElement: jobs.map((job, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `${siteConfig.url}/company/${job.company.slug}/jobs/${job.slug}`,
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
          {/* Breadcrumbs */}
          <nav className="mb-6 text-sm text-muted-foreground" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-2">
              <li><Link href="/" className="hover:text-foreground">Home</Link></li>
              <li>/</li>
              <li><Link href="/jobs" className="hover:text-foreground">Jobs</Link></li>
              <li>/</li>
              <li><Link href={`/jobs/${category.slug}`} className="hover:text-foreground">{category.name}</Link></li>
              <li>/</li>
              <li className="text-foreground font-medium">{level.label}</li>
            </ol>
          </nav>

          {/* Page Header */}
          <header className="mb-8">
            <h1 className="text-3xl font-bold mb-2">
              {level.label} Remote {category.name} Jobs
            </h1>
            <p className="text-muted-foreground text-lg">
              {totalJobs > 0
                ? `${totalJobs} ${level.label.toLowerCase()} ${category.name.toLowerCase()} positions available`
                : `Browse ${level.label.toLowerCase()} ${category.name.toLowerCase()} remote opportunities`}
            </p>
          </header>

          <div className="flex gap-8">
            {/* Sidebar */}
            <aside className="hidden lg:block w-64 flex-shrink-0">
              <div className="sticky top-20 space-y-6">
                <div>
                  <h2 className="text-sm font-medium mb-2">Other Levels</h2>
                  <div className="space-y-1">
                    {levels.map((lvl) => (
                      <Link
                        key={lvl.value}
                        href={`/jobs/${category.slug}/${lvl.value.toLowerCase()}`}
                        className={`block px-3 py-1.5 text-sm rounded ${
                          lvl.value === level.value
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`}
                      >
                        {lvl.label}
                      </Link>
                    ))}
                  </div>
                </div>

                <div>
                  <h2 className="text-sm font-medium mb-2">Other Categories</h2>
                  <div className="space-y-1">
                    {categories.filter((c) => c.slug !== category.slug).map((cat) => (
                      <Link
                        key={cat.slug}
                        href={`/jobs/${cat.slug}/${levelSlug}`}
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
              <div className="flex items-center gap-2 mb-4">
                <Badge>{category.name}</Badge>
                <Badge variant="secondary">{level.label}</Badge>
              </div>

              {jobs.length > 0 ? (
                <div className="space-y-4">
                  {jobs.map((job) => (
                    <JobCard key={job.id} job={job} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">
                    No {level.label.toLowerCase()} {category.name.toLowerCase()} jobs found.
                  </p>
                  <Link href={`/jobs/${category.slug}`} className="text-primary hover:underline mt-2 inline-block">
                    View all {category.name} jobs
                  </Link>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <nav className="mt-8 flex justify-center gap-2">
                  {currentPage > 1 && (
                    <Link href={`/jobs/${category.slug}/${levelSlug}?page=${currentPage - 1}`}>
                      <Button variant="outline">Previous</Button>
                    </Link>
                  )}
                  <span className="flex items-center px-4 text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  {currentPage < totalPages && (
                    <Link href={`/jobs/${category.slug}/${levelSlug}?page=${currentPage + 1}`}>
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
              About {level.label} {category.name} Jobs
            </h2>
            <div className="prose prose-sm max-w-none text-muted-foreground">
              <p>
                Looking for {level.label.toLowerCase()} {category.name.toLowerCase()} remote positions?
                Freelanly aggregates the best {level.label.toLowerCase()} {category.name.toLowerCase()} jobs
                from LinkedIn and top company career pages.
              </p>
              <p>
                Our AI extracts key details from job posts, making it easy to find the perfect
                {level.label.toLowerCase()} role in {category.name.toLowerCase()}.
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
