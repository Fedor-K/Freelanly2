import { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CompanyLogo } from '@/components/ui/CompanyLogo';
import { siteConfig } from '@/config/site';
import { prisma } from '@/lib/db';

interface CompaniesPageProps {
  searchParams: Promise<{ page?: string; industry?: string }>;
}

export async function generateMetadata({ searchParams }: CompaniesPageProps): Promise<Metadata> {
  const { page, industry } = await searchParams;
  const currentPage = parseInt(page || '1', 10);

  // Noindex pages to avoid duplicate content:
  // - Pagination pages (page > 1)
  // - Industry filtered pages
  const shouldNoindex = currentPage > 1 || !!industry;

  return {
    title: 'Companies Hiring Remotely - Top Remote Employers',
    description: 'Discover companies hiring for remote positions. Browse top employers offering work from home jobs in engineering, design, marketing & more. Updated daily.',
    keywords: ['remote companies', 'companies hiring remotely', 'remote employers', 'work from home companies'],
    ...(shouldNoindex && {
      robots: {
        index: false,
        follow: true,
      },
    }),
    openGraph: {
      title: 'Companies Hiring Remotely - Top Remote Employers',
      description: 'Discover companies hiring for remote positions.',
      url: `${siteConfig.url}/companies`,
      type: 'website',
    },
    alternates: {
      canonical: `${siteConfig.url}/companies`,
    },
  };
}

interface CompanyWithCount {
  id: string;
  slug: string;
  name: string;
  logo: string | null;
  website: string | null;
  industry: string | null;
  size: string | null;
  headquarters: string | null;
  verified: boolean;
  _count: {
    jobs: number;
  };
}

export default async function CompaniesPage({ searchParams }: CompaniesPageProps) {
  const { page = '1', industry } = await searchParams;
  const currentPage = parseInt(page, 10) || 1;
  const perPage = 24;

  let companies: CompanyWithCount[] = [];
  let totalCompanies = 0;

  try {
    // Only show companies with active jobs (last 30 days)
    const maxAgeDate = new Date();
    maxAgeDate.setDate(maxAgeDate.getDate() - 30);

    const where: any = {
      jobs: {
        some: {
          isActive: true,
          postedAt: { gte: maxAgeDate },
        },
      },
    };
    if (industry) {
      where.industry = { contains: industry, mode: 'insensitive' };
    }

    [companies, totalCompanies] = await Promise.all([
      prisma.company.findMany({
        where,
        select: {
          id: true,
          slug: true,
          name: true,
          logo: true,
          website: true,
          industry: true,
          size: true,
          headquarters: true,
          verified: true,
          _count: {
            select: { jobs: { where: { isActive: true, postedAt: { gte: maxAgeDate } } } },
          },
        },
        orderBy: [
          { verified: 'desc' },
          { jobs: { _count: 'desc' } },
        ],
        skip: (currentPage - 1) * perPage,
        take: perPage,
      }),
      prisma.company.count({ where }),
    ]);
  } catch (error) {
    console.error('Failed to fetch companies:', error);
  }

  const totalPages = Math.ceil(totalCompanies / perPage);

  // Get unique industries for filtering
  let industries: string[] = [];
  try {
    const result = await prisma.company.groupBy({
      by: ['industry'],
      where: { industry: { not: null } },
      _count: true,
      orderBy: { _count: { industry: 'desc' } },
      take: 20,
    });
    industries = result.map((r) => r.industry!).filter(Boolean);
  } catch (error) {
    // Ignore
  }

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: siteConfig.url },
          { '@type': 'ListItem', position: 2, name: 'Companies', item: `${siteConfig.url}/companies` },
        ],
      },
      {
        '@type': 'ItemList',
        name: 'Companies Hiring Remotely',
        numberOfItems: totalCompanies,
        itemListElement: companies.map((company, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `${siteConfig.url}/company/${company.slug}`,
          name: company.name,
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
              <li className="text-foreground font-medium">Companies</li>
            </ol>
          </nav>

          <header className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Companies Hiring Remotely</h1>
            <p className="text-muted-foreground text-lg">
              {totalCompanies > 0 ? `${totalCompanies} companies` : 'Discover'} hiring for remote positions
            </p>
          </header>

          <div className="flex gap-8">
            {/* Sidebar */}
            <aside className="hidden lg:block w-64 flex-shrink-0">
              <div className="sticky top-20 space-y-6">
                <div>
                  <h2 className="text-sm font-medium mb-2">Filter by Industry</h2>
                  <div className="space-y-1">
                    <Link
                      href="/companies"
                      className={`block px-3 py-1.5 text-sm rounded ${!industry ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                    >
                      All Industries
                    </Link>
                    {industries.map((ind) => (
                      <Link
                        key={ind}
                        href={`/companies?industry=${encodeURIComponent(ind)}`}
                        className={`block px-3 py-1.5 text-sm rounded ${industry === ind ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                      >
                        {ind}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </aside>

            {/* Companies Grid */}
            <div className="flex-1">
              {companies.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {companies.map((company) => (
                    <Link key={company.id} href={`/company/${company.slug}`}>
                      <Card className="h-full hover:shadow-md transition-shadow">
                        <CardContent className="pt-6">
                          <div className="flex items-start gap-3">
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
                                <p className="text-sm text-muted-foreground truncate">{company.industry}</p>
                              )}
                              <p className="text-sm text-primary mt-1">
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
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No companies found.</p>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <nav className="mt-8 flex justify-center gap-2">
                  {currentPage > 1 && (
                    <Link href={`/companies?page=${currentPage - 1}${industry ? `&industry=${industry}` : ''}`}>
                      <Button variant="outline">Previous</Button>
                    </Link>
                  )}
                  <span className="flex items-center px-4 text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  {currentPage < totalPages && (
                    <Link href={`/companies?page=${currentPage + 1}${industry ? `&industry=${industry}` : ''}`}>
                      <Button variant="outline">Next</Button>
                    </Link>
                  )}
                </nav>
              )}
            </div>
          </div>

          {/* SEO Content */}
          <section className="mt-16 border-t pt-8">
            <h2 className="text-2xl font-bold mb-4">About Remote Companies</h2>
            <div className="prose prose-sm max-w-none text-muted-foreground">
              <p>
                Discover top companies offering remote work opportunities. From startups to enterprises,
                these employers are hiring talented professionals for work-from-home positions worldwide.
              </p>
              <p>
                Browse company profiles to learn about their culture, benefits, and current job openings.
                Find the perfect remote employer that matches your career goals.
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
