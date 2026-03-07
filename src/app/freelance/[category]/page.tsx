import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { OpportunityCard } from '@/components/opportunities/OpportunityCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { siteConfig, categories, levels } from '@/config/site';
import { countries, highVolumeCountries } from '@/config/countries';
import { truncateTitle } from '@/lib/seo';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { getMaxJobAgeDate } from '@/lib/utils';
import { LanguagePairFilter } from '@/components/jobs/LanguagePairFilter';

export const revalidate = 60;

type UserPlan = 'FREE' | 'PRO' | 'ENTERPRISE';

const relatedCategoriesMap: Record<string, string[]> = {
  engineering: ['devops', 'data', 'qa', 'security', 'design'],
  design: ['product', 'engineering', 'creative', 'marketing'],
  data: ['engineering', 'research', 'product', 'devops'],
  devops: ['engineering', 'security', 'data', 'qa'],
  qa: ['engineering', 'devops', 'security', 'product'],
  security: ['devops', 'engineering', 'qa', 'data'],
  product: ['design', 'engineering', 'marketing', 'data', 'project-management'],
  marketing: ['sales', 'creative', 'writing', 'product', 'design'],
  sales: ['marketing', 'finance', 'operations', 'support'],
  finance: ['operations', 'legal', 'hr', 'consulting'],
  hr: ['operations', 'legal', 'finance', 'consulting'],
  operations: ['hr', 'finance', 'project-management', 'support'],
  legal: ['finance', 'hr', 'operations', 'consulting'],
  'project-management': ['product', 'operations', 'engineering', 'consulting'],
  writing: ['marketing', 'creative', 'translation', 'education'],
  translation: ['writing', 'creative', 'education', 'support'],
  creative: ['design', 'marketing', 'writing', 'product'],
  support: ['operations', 'sales', 'hr', 'education'],
  education: ['writing', 'research', 'consulting', 'support'],
  research: ['data', 'education', 'consulting', 'engineering'],
  consulting: ['project-management', 'finance', 'research', 'operations'],
};

interface FreelanceCategoryPageProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ page?: string; level?: string; sourceLang?: string; targetLang?: string }>;
}

export async function generateStaticParams() {
  return categories.map((cat) => ({
    category: cat.slug,
  }));
}

export async function generateMetadata({ params, searchParams }: FreelanceCategoryPageProps): Promise<Metadata> {
  const { category: categorySlug } = await params;
  const category = categories.find((c) => c.slug === categorySlug);

  if (!category) {
    notFound();
  }

  const resolvedSearchParams = await searchParams;
  const pageNum = parseInt(resolvedSearchParams.page || '1', 10);

  const seoTitle = truncateTitle(`Freelance ${category.name} Projects - Direct Client Opportunities`);
  const description = `Browse freelance ${category.name.toLowerCase()} projects from LinkedIn. Find direct client ${category.name.toLowerCase()} opportunities. Updated daily.`;

  return {
    title: seoTitle,
    description,
    keywords: [
      `freelance ${category.name.toLowerCase()} projects`,
      `${category.name.toLowerCase()} freelance`,
      `remote ${category.name.toLowerCase()} freelance`,
      `direct client ${category.name.toLowerCase()}`,
    ],
    openGraph: {
      title: seoTitle,
      description,
      url: `${siteConfig.url}/freelance/${category.slug}`,
      type: 'website',
      siteName: siteConfig.name,
    },
    alternates: {
      canonical: `${siteConfig.url}/freelance/${category.slug}`,
    },
    ...(pageNum > 1 && {
      robots: {
        index: false,
        follow: true,
      },
    }),
  };
}

export default async function FreelanceCategoryPage({ params, searchParams }: FreelanceCategoryPageProps) {
  const { category: categorySlug } = await params;
  const { page = '1', level, sourceLang, targetLang } = await searchParams;

  const category = categories.find((c) => c.slug === categorySlug);

  if (!category) {
    notFound();
  }

  const session = await auth();
  let userPlan: UserPlan = 'FREE';
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true },
    });
    if (user?.plan) {
      userPlan = user.plan as UserPlan;
    }
  }
  const isPro = userPlan === 'PRO' || userPlan === 'ENTERPRISE';

  const currentPage = parseInt(page, 10) || 1;
  const perPage = 20;

  const maxAgeDate = getMaxJobAgeDate();
  const where: any = {
    isActive: true,
    postedAt: { gte: maxAgeDate },
    category: {
      slug: categorySlug,
    },
  };

  if (level) {
    where.level = level.toUpperCase();
  }
  if (sourceLang) {
    where.sourceLanguages = { has: sourceLang.toUpperCase() };
  }
  if (targetLang) {
    where.targetLanguages = { has: targetLang.toUpperCase() };
  }

  let opportunities: any[] = [];
  let totalCount = 0;

  try {
    const [oppsResult, countResult] = await Promise.all([
      prisma.opportunity.findMany({
        where,
        include: {
          company: {
            select: {
              name: true,
              slug: true,
              logo: true,
              website: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (currentPage - 1) * perPage,
        take: perPage,
      }),
      prisma.opportunity.count({ where }),
    ]);

    opportunities = oppsResult;
    totalCount = countResult;
  } catch (error) {
    console.error('Failed to fetch opportunities:', error);
  }

  const totalPages = Math.ceil(totalCount / perPage);

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: siteConfig.url },
          { '@type': 'ListItem', position: 2, name: 'Freelance Projects', item: `${siteConfig.url}/freelance` },
          { '@type': 'ListItem', position: 3, name: `${category.name} Projects`, item: `${siteConfig.url}/freelance/${category.slug}` },
        ],
      },
      {
        '@type': 'ItemList',
        name: `Freelance ${category.name} Projects`,
        description: `Browse freelance ${category.name.toLowerCase()} projects from LinkedIn`,
        numberOfItems: totalCount,
        itemListElement: opportunities.map((opp, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          url: `${siteConfig.url}/freelance/${opp.slug}`,
          name: opp.title,
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
              <li>
                <Link href="/" className="hover:text-foreground">Home</Link>
              </li>
              <li>/</li>
              <li>
                <Link href="/freelance" className="hover:text-foreground">Freelance</Link>
              </li>
              <li>/</li>
              <li className="text-foreground font-medium">{category.name}</li>
            </ol>
          </nav>

          {/* Page Header */}
          <header className="mb-8">
            <h1 className="text-3xl font-bold mb-2">
              Freelance {category.name} Projects
            </h1>
            <p className="text-muted-foreground text-lg">
              {totalCount > 0
                ? `${totalCount} ${category.name.toLowerCase()} projects available`
                : `Browse ${category.name.toLowerCase()} freelance opportunities`}
            </p>
          </header>

          <div className="flex gap-8">
            {/* Filters Sidebar */}
            <aside className="hidden lg:block w-64 flex-shrink-0">
              <div className="sticky top-20 space-y-6">
                {/* Level Filter */}
                <div>
                  <h2 className="text-sm font-medium mb-2">Experience Level</h2>
                  <div className="space-y-1">
                    {levels.map((lvl) => (
                      <Link
                        key={lvl.value}
                        href={`/freelance/${category.slug}?level=${lvl.value.toLowerCase()}`}
                        className="block px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                      >
                        {lvl.label}
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Language Pair Filter - only for translation category */}
                {categorySlug === 'translation' && (
                  <LanguagePairFilter
                    currentSourceLang={sourceLang}
                    currentTargetLang={targetLang}
                  />
                )}

                {/* Related Categories */}
                <div>
                  <h2 className="text-sm font-medium mb-2">Related Categories</h2>
                  <div className="space-y-1">
                    {(relatedCategoriesMap[category.slug] || [])
                      .slice(0, 5)
                      .map((slug) => {
                        const cat = categories.find((c) => c.slug === slug);
                        if (!cat) return null;
                        return (
                          <Link
                            key={cat.slug}
                            href={`/freelance/${cat.slug}`}
                            className="block px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                          >
                            {cat.icon} {cat.name}
                          </Link>
                        );
                      })}
                    <Link
                      href="/freelance"
                      className="block px-3 py-1.5 text-sm text-primary hover:underline"
                    >
                      View all categories →
                    </Link>
                  </div>
                </div>

                {/* Browse by Country */}
                <div>
                  <h2 className="text-sm font-medium mb-2">Browse by Country</h2>
                  <div className="space-y-1">
                    {countries
                      .filter((c) => highVolumeCountries.includes(c.slug))
                      .map((country) => (
                        <Link
                          key={country.slug}
                          href={`/freelance/${category.slug}?country=${country.slug}`}
                          className="block px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                        >
                          {country.flag} {country.name}
                        </Link>
                      ))}
                  </div>
                </div>
              </div>
            </aside>

            {/* Projects List */}
            <div className="flex-1">
              {/* Active Filters */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <Badge>{category.name}</Badge>
                {level && <Badge variant="secondary">{level}</Badge>}
                <Link href={`/freelance/${category.slug}`}>
                  <Button variant="ghost" size="sm" className="text-xs">
                    Clear filters
                  </Button>
                </Link>
              </div>

              {/* Projects */}
              {opportunities.length > 0 ? (
                <div className="space-y-4">
                  {opportunities.map((opp) => (
                    <OpportunityCard key={opp.id} opportunity={opp} isPro={isPro} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">
                    No {category.name.toLowerCase()} freelance projects found at the moment.
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Check back soon or browse other categories.
                  </p>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <nav className="mt-8 flex justify-center gap-2" aria-label="Pagination">
                  {currentPage > 1 && (
                    <Link href={`/freelance/${category.slug}?page=${currentPage - 1}`}>
                      <Button variant="outline">Previous</Button>
                    </Link>
                  )}
                  <span className="flex items-center px-4 text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  {currentPage < totalPages && (
                    <Link href={`/freelance/${category.slug}?page=${currentPage + 1}`}>
                      <Button variant="outline">Next</Button>
                    </Link>
                  )}
                </nav>
              )}
            </div>
          </div>
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
