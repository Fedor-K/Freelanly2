import { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CompanyLogo } from '@/components/ui/CompanyLogo';
import { siteConfig, companySizes } from '@/config/site';
import { prisma } from '@/lib/db';

export const metadata: Metadata = {
  title: 'Companies Hiring Worldwide - Remote Companies with Global Teams',
  description: 'Discover companies hiring remote workers worldwide. Find remote-friendly employers offering work from anywhere opportunities. Browse 500+ companies with open positions.',
  keywords: [
    'companies hiring worldwide',
    'remote companies',
    'work from anywhere jobs',
    'global remote companies',
    'remote-first companies',
    'distributed companies',
  ],
  openGraph: {
    title: 'Companies Hiring Worldwide',
    description: 'Discover companies hiring remote workers worldwide. Find remote-friendly employers offering work from anywhere.',
    url: `${siteConfig.url}/companies-hiring-worldwide`,
    siteName: siteConfig.name,
  },
  alternates: {
    canonical: `${siteConfig.url}/companies-hiring-worldwide`,
  },
};

interface CompanyPageProps {
  searchParams: Promise<{ page?: string; size?: string }>;
}

export default async function CompaniesHiringWorldwidePage({ searchParams }: CompanyPageProps) {
  const filters = await searchParams;
  const currentPage = parseInt(filters.page || '1', 10) || 1;
  const perPage = 24;

  // Build filter conditions
  const whereConditions: any = {
    jobs: {
      some: {
        isActive: true,
        locationType: 'REMOTE',
      },
    },
  };

  if (filters.size) {
    whereConditions.size = filters.size;
  }

  let companies: any[] = [];
  let totalCompanies = 0;

  try {
    [companies, totalCompanies] = await Promise.all([
      prisma.company.findMany({
        where: whereConditions,
        include: {
          _count: {
            select: {
              jobs: {
                where: { isActive: true },
              },
            },
          },
        },
        orderBy: [
          { verified: 'desc' },
          { jobs: { _count: 'desc' } },
        ],
        skip: (currentPage - 1) * perPage,
        take: perPage,
      }),
      prisma.company.count({ where: whereConditions }),
    ]);
  } catch (error) {
    console.error('Failed to fetch companies:', error);
  }

  const totalPages = Math.ceil(totalCompanies / perPage);

  function formatSize(size: string | null): string {
    const sizeInfo = companySizes.find(s => s.value === size);
    return sizeInfo?.label || 'Unknown size';
  }

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: siteConfig.url },
          { '@type': 'ListItem', position: 2, name: 'Companies Hiring Worldwide', item: `${siteConfig.url}/companies-hiring-worldwide` },
        ],
      },
      {
        '@type': 'ItemList',
        name: 'Companies Hiring Worldwide',
        numberOfItems: totalCompanies,
        itemListElement: companies.map((company, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `${siteConfig.url}/company/${company.slug}`,
          name: company.name,
        })),
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'How many companies are hiring remote workers worldwide?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: `Currently, ${totalCompanies} companies on Freelanly are actively hiring remote workers worldwide.`,
            },
          },
          {
            '@type': 'Question',
            name: 'What types of companies hire remote workers?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Companies of all sizes hire remote workers, from startups to enterprises. Many tech companies, SaaS businesses, and digital agencies offer fully remote positions.',
            },
          },
          {
            '@type': 'Question',
            name: 'How do I apply to remote companies?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Browse company profiles on Freelanly to see their open positions. You can apply directly through the job listing or visit their careers page.',
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
              <li className="text-foreground font-medium">Companies Hiring Worldwide</li>
            </ol>
          </nav>

          {/* Page Header */}
          <header className="mb-8">
            <h1 className="text-3xl font-bold mb-2">
              🌍 Companies Hiring Worldwide
            </h1>
            <p className="text-muted-foreground">
              {totalCompanies} companies with remote positions available globally
            </p>
          </header>

          {/* Filters */}
          <div className="mb-8 flex flex-wrap gap-2">
            <Link href="/companies-hiring-worldwide">
              <Button variant={!filters.size ? 'default' : 'outline'} size="sm">
                All Sizes
              </Button>
            </Link>
            {companySizes.map((size) => (
              <Link key={size.value} href={`/companies-hiring-worldwide?size=${size.value}`}>
                <Button variant={filters.size === size.value ? 'default' : 'outline'} size="sm">
                  {size.label}
                </Button>
              </Link>
            ))}
          </div>

          {/* Companies Grid */}
          <section className="mb-12">
            {companies.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {companies.map((company) => (
                  <Link key={company.id} href={`/company/${company.slug}`}>
                    <Card className="h-full hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <CompanyLogo
                            name={company.name}
                            logo={company.logo}
                            website={company.website}
                            size="md"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h2 className="font-semibold truncate">{company.name}</h2>
                              {company.verified && (
                                <Badge variant="secondary" className="text-xs">Verified</Badge>
                              )}
                            </div>
                            {company.industry && (
                              <p className="text-sm text-muted-foreground truncate">
                                {company.industry}
                              </p>
                            )}
                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                              {company.size && (
                                <span>{formatSize(company.size)}</span>
                              )}
                              {company.headquarters && (
                                <span>📍 {company.headquarters}</span>
                              )}
                            </div>
                            <p className="mt-2 text-sm text-primary">
                              {company._count.jobs} open {company._count.jobs === 1 ? 'position' : 'positions'}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No companies found matching your filters.</p>
                  <Link href="/companies-hiring-worldwide" className="text-primary hover:underline mt-2 inline-block">
                    Clear filters
                  </Link>
                </CardContent>
              </Card>
            )}
          </section>

          {/* Pagination */}
          {totalPages > 1 && (
            <nav className="mb-12 flex justify-center gap-2">
              {currentPage > 1 && (
                <Link href={`/companies-hiring-worldwide?page=${currentPage - 1}${filters.size ? `&size=${filters.size}` : ''}`}>
                  <Button variant="outline">Previous</Button>
                </Link>
              )}
              <span className="flex items-center px-4 text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              {currentPage < totalPages && (
                <Link href={`/companies-hiring-worldwide?page=${currentPage + 1}${filters.size ? `&size=${filters.size}` : ''}`}>
                  <Button variant="outline">Next</Button>
                </Link>
              )}
            </nav>
          )}

          {/* SEO Content */}
          <section className="border-t pt-8">
            <h2 className="text-2xl font-bold mb-4">Work for Global Companies</h2>
            <div className="prose prose-sm max-w-none text-muted-foreground">
              <p>
                More companies than ever are embracing remote work and hiring talent from around the world.
                These global companies offer the flexibility to work from anywhere while being part of
                distributed teams spanning multiple time zones.
              </p>
              <p>
                Working for a company that hires worldwide means you&apos;re not limited by geography.
                You can collaborate with colleagues from different cultures, work on projects with
                global impact, and enjoy competitive compensation packages.
              </p>
              <p>
                Freelanly helps you discover remote-friendly companies that are actively hiring.
                Browse our directory to find your next employer and start your remote work journey.
              </p>
            </div>

            {/* Related Links */}
            <div className="mt-8">
              <h3 className="font-semibold mb-3">Explore More</h3>
              <div className="flex flex-wrap gap-4">
                <Link href="/jobs" className="text-sm text-muted-foreground hover:text-foreground">
                  Browse All Jobs →
                </Link>
                <Link href="/country" className="text-sm text-muted-foreground hover:text-foreground">
                  Jobs by Country →
                </Link>
                <Link href="/jobs/engineering" className="text-sm text-muted-foreground hover:text-foreground">
                  Engineering Jobs →
                </Link>
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
