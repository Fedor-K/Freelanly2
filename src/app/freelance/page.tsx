import { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { OpportunityCard } from '@/components/opportunities/OpportunityCard';
import { Button } from '@/components/ui/button';
import { siteConfig, categories, countries } from '@/config/site';
import { FreelanceFilters } from '@/components/opportunities/FreelanceFilters';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { getMaxJobAgeDate } from '@/lib/utils';

type UserPlan = 'FREE' | 'PRO' | 'ENTERPRISE';

export const dynamic = 'force-dynamic';

interface FreelancePageProps {
  searchParams: Promise<{
    page?: string;
    category?: string;
    country?: string;
    q?: string;
  }>;
}

export async function generateMetadata({ searchParams }: FreelancePageProps): Promise<Metadata> {
  const params = await searchParams;
  const cat = params.category ? categories.find(c => c.slug === params.category) : null;
  const title = cat ? `Freelance ${cat.name} Projects` : 'Freelance Projects';
  return {
    title: `${title} - Direct Client Projects from LinkedIn`,
    description: 'Find freelance projects sourced directly from LinkedIn and top company posts. Browse contract opportunities in engineering, design, marketing, translation and more. Updated daily.',
    alternates: { canonical: `${siteConfig.url}/freelance` },
  };
}

export default async function FreelancePage({ searchParams }: FreelancePageProps) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page || '1', 10) || 1);
  const categoryFilter = params.category || null;
  const countryFilter = params.country || null;
  const searchQuery = params.q || null;
  const perPage = 20;

  const session = await auth();
  let userPlan: UserPlan = 'FREE';
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true },
    });
    if (user?.plan) userPlan = user.plan as UserPlan;
  }
  const isPro = userPlan === 'PRO' || userPlan === 'ENTERPRISE';

  const maxAgeDate = getMaxJobAgeDate();
  const where: Record<string, unknown> = {
    isActive: true,
    postedAt: { gte: maxAgeDate },
  };

  if (categoryFilter) {
    where.category = { slug: categoryFilter };
  }
  if (countryFilter) {
    where.country = countryFilter.toUpperCase();
  }
  if (searchQuery) {
    where.OR = [
      { title: { contains: searchQuery, mode: 'insensitive' } },
      { description: { contains: searchQuery, mode: 'insensitive' } },
    ];
  }

  let opportunities: unknown[] = [];
  let totalCount = 0;

  try {
    [opportunities, totalCount] = await Promise.all([
      prisma.opportunity.findMany({
        where,
        include: {
          company: {
            select: { name: true, slug: true, logo: true, website: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (currentPage - 1) * perPage,
        take: perPage,
      }),
      prisma.opportunity.count({ where }),
    ]);
  } catch (error) {
    console.error('Failed to fetch opportunities:', error);
  }

  const totalPages = Math.ceil(totalCount / perPage);
  const activeCat = categoryFilter ? categories.find(c => c.slug === categoryFilter) : null;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="container py-6 sm:py-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold mb-1">
              Freelance Projects
              {activeCat && ` — ${activeCat.name}`}
              {countryFilter && ` in ${countries.find(c => c.code === countryFilter.toUpperCase())?.name || countryFilter}`}
            </h1>
            <p className="text-muted-foreground text-sm">
              {totalCount.toLocaleString()} direct client projects from LinkedIn
            </p>
          </div>

          {/* Filters */}
          <FreelanceFilters
            categoryFilter={categoryFilter}
            countryFilter={countryFilter}
            searchQuery={searchQuery}
          />

          {/* Listings */}
          {(opportunities as unknown[]).length > 0 ? (
            <div className="space-y-4">
              {(opportunities as Array<Record<string, unknown>>).map((opp) => (
                <OpportunityCard key={opp.id as string} opportunity={opp as never} isPro={isPro} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-lg text-muted-foreground">No projects found</p>
              <p className="text-sm text-muted-foreground mt-1">Try changing filters</p>
              <Link href="/freelance">
                <Button variant="outline" className="mt-4">Clear filters</Button>
              </Link>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-8">
              {currentPage > 1 && (
                <Link href={`/freelance?${categoryFilter ? `category=${categoryFilter}&` : ''}${countryFilter ? `country=${countryFilter}&` : ''}page=${currentPage - 1}`}>
                  <Button variant="outline">Previous</Button>
                </Link>
              )}
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              {currentPage < totalPages && (
                <Link href={`/freelance?${categoryFilter ? `category=${categoryFilter}&` : ''}${countryFilter ? `country=${countryFilter}&` : ''}page=${currentPage + 1}`}>
                  <Button variant="outline">Next</Button>
                </Link>
              )}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
