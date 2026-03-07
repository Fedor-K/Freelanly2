import { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { OpportunityCard } from '@/components/opportunities/OpportunityCard';
import { Button } from '@/components/ui/button';
import { siteConfig, categories, levels, countries, techStacks, salaryRanges } from '@/config/site';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { getMaxJobAgeDate } from '@/lib/utils';
import { TopFilters } from '@/components/jobs/TopFilters';
import type { OpportunityCardData } from '@/types';

type UserPlan = 'FREE' | 'PRO' | 'ENTERPRISE';

export const dynamic = 'force-dynamic';

interface FreelancePageProps {
  searchParams: Promise<{
    page?: string;
    q?: string;
    level?: string | string[];
    country?: string;
    salary?: string;
    skills?: string | string[];
    category?: string;
    sourceLang?: string;
    targetLang?: string;
    workType?: string;
  }>;
}

const ITEMS_PER_PAGE = 20;

export async function generateMetadata({ searchParams }: FreelancePageProps): Promise<Metadata> {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page || '1', 10) || 1);

  const prevPage = currentPage > 1 ? currentPage - 1 : null;
  const nextPageExists = currentPage < 100;

  const ogImageUrl = `${siteConfig.url}/api/og?title=Freelance%20Projects&type=category&category=Freelance`;

  const filterCount = [
    params.q,
    params.level,
    params.country,
    params.salary,
    params.skills,
  ].filter(Boolean).length;

  const hasPagination = currentPage > 1 || params.page !== undefined;
  const shouldNoindex = hasPagination || filterCount >= 2;

  return {
    title: currentPage > 1
      ? `Freelance Projects - Page ${currentPage}`
      : 'Freelance Projects - Direct Client Projects from LinkedIn',
    description: 'Browse freelance projects sourced directly from LinkedIn. Find direct client opportunities in translation, engineering, design, and more. Updated daily.',
    keywords: [
      'freelance projects',
      'freelance jobs',
      'direct client projects',
      'linkedin freelance',
      'remote freelance',
      'freelance translation',
      'freelance developer',
    ],
    ...(shouldNoindex && {
      robots: {
        index: false,
        follow: true,
      },
    }),
    openGraph: {
      title: 'Freelance Projects - Direct Client Opportunities',
      description: 'Browse freelance projects sourced directly from LinkedIn. Find direct client opportunities updated daily.',
      url: `${siteConfig.url}/freelance`,
      siteName: siteConfig.name,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: 'Freelance Projects on Freelanly' }],
    },
    alternates: {
      canonical: `${siteConfig.url}/freelance`,
    },
    other: {
      ...(prevPage && { 'link-prev': `${siteConfig.url}/freelance?page=${prevPage}` }),
      ...(nextPageExists && { 'link-next': `${siteConfig.url}/freelance?page=${currentPage + 1}` }),
    },
  };
}

async function getOpportunities(
  page: number,
  filters: {
    search?: string;
    levels?: string[];
    country?: string;
    salaryMin?: number;
    skills?: string[];
    category?: string;
    sourceLang?: string;
    targetLang?: string;
    workType?: string;
  }
) {
  const maxAgeDate = getMaxJobAgeDate();
  const skip = (page - 1) * ITEMS_PER_PAGE;

  const where: any = {
    isActive: true,
    postedAt: { gte: maxAgeDate },
  };

  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { clientName: { contains: filters.search, mode: 'insensitive' } },
      { skills: { hasSome: [filters.search] } },
    ];
  }

  if (filters.levels && filters.levels.length > 0) {
    where.level = { in: filters.levels };
  }

  if (filters.country) {
    const countryData = countries.find(c => c.slug === filters.country);
    if (countryData?.code) {
      where.country = countryData.code;
    }
  }

  if (filters.salaryMin && filters.salaryMin > 0) {
    where.salaryMin = { gte: filters.salaryMin };
  }

  if (filters.skills && filters.skills.length > 0) {
    const skillKeywords: string[] = [];
    for (const skillSlug of filters.skills) {
      const techStack = techStacks.find(t => t.slug === skillSlug);
      if (techStack) {
        skillKeywords.push(...techStack.keywords);
      }
    }
    if (skillKeywords.length > 0) {
      where.skills = { hasSome: skillKeywords };
    }
  }

  if (filters.category) {
    where.category = { slug: filters.category };
  }

  if (filters.sourceLang) {
    where.sourceLanguages = { has: filters.sourceLang.toUpperCase() };
  }
  if (filters.targetLang) {
    where.targetLanguages = { has: filters.targetLang.toUpperCase() };
  }

  if (filters.workType) {
    where.translationTypes = { has: filters.workType };
  }

  try {
    const [opportunities, totalCount] = await Promise.all([
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
        skip,
        take: ITEMS_PER_PAGE,
      }),
      prisma.opportunity.count({ where }),
    ]);

    return { opportunities, totalCount };
  } catch (error) {
    console.error('Failed to fetch opportunities:', error);
    return { opportunities: [], totalCount: 0 };
  }
}

function toArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function buildFilterUrl(
  baseParams: Record<string, string | string[] | undefined>,
  changes: Record<string, string | string[] | undefined>
): string {
  const params = new URLSearchParams();
  const merged = { ...baseParams, ...changes };

  for (const [key, value] of Object.entries(merged)) {
    if (!value) continue;
    if (Array.isArray(value)) {
      value.forEach((v) => params.append(key, v));
    } else {
      params.set(key, value);
    }
  }

  const queryString = params.toString();
  return queryString ? `/freelance?${queryString}` : '/freelance';
}

export default async function FreelancePage({ searchParams }: FreelancePageProps) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page || '1', 10) || 1);

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

  const salaryRange = params.salary ? salaryRanges.find(r => r.value === params.salary) : null;

  const filters = {
    search: params.q,
    levels: toArray(params.level),
    country: params.country,
    salaryMin: salaryRange?.min,
    skills: toArray(params.skills),
    category: params.category,
    sourceLang: params.sourceLang,
    targetLang: params.targetLang,
    workType: params.workType,
  };

  const { opportunities, totalCount } = await getOpportunities(currentPage, filters);
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="container py-6 sm:py-8">
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold mb-1">Freelance Projects</h1>
            <p className="text-muted-foreground text-sm">
              Direct client projects from LinkedIn
            </p>
          </div>

          <div className="mb-6">
            <TopFilters
              currentFilters={{
                search: filters.search,
                levels: filters.levels,
                types: [],
                country: filters.country,
                salary: params.salary,
                skills: filters.skills,
                category: filters.category,
                sourceLang: filters.sourceLang,
                targetLang: filters.targetLang,
                workType: filters.workType,
              }}
              totalCount={totalCount}
            />
          </div>

          {opportunities.length > 0 ? (
            <div className="space-y-4">
              {opportunities.map((opp) => (
                <OpportunityCard key={opp.id} opportunity={opp} isPro={isPro} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 border rounded-lg bg-muted/30">
              <p className="text-muted-foreground mb-4">No freelance projects found matching your filters.</p>
              <Link href="/freelance">
                <Button variant="outline">Clear filters</Button>
              </Link>
            </div>
          )}

          {totalPages > 1 && (
            <nav className="mt-8 flex justify-center gap-2">
              {currentPage > 1 ? (
                <Link href={buildFilterUrl(params, { page: String(currentPage - 1) })}>
                  <Button variant="outline">Previous</Button>
                </Link>
              ) : (
                <Button variant="outline" disabled>Previous</Button>
              )}

              <span className="flex items-center px-4 text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>

              {currentPage < totalPages ? (
                <Link href={buildFilterUrl(params, { page: String(currentPage + 1) })}>
                  <Button variant="outline">Next</Button>
                </Link>
              ) : (
                <Button variant="outline" disabled>Next</Button>
              )}
            </nav>
          )}
        </div>
      </main>

      <Footer />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: 'Freelance Projects',
            description: 'Browse freelance projects from LinkedIn',
            numberOfItems: totalCount,
            itemListElement: opportunities.map((opp, index) => ({
              '@type': 'ListItem',
              position: (currentPage - 1) * ITEMS_PER_PAGE + index + 1,
              url: `${siteConfig.url}/freelance/${opp.slug}`,
              name: `${opp.title} - Freelance Project`,
            })),
          }),
        }}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: siteConfig.url },
              { '@type': 'ListItem', position: 2, name: 'Freelance Projects', item: `${siteConfig.url}/freelance` },
            ],
          }),
        }}
      />
    </div>
  );
}
