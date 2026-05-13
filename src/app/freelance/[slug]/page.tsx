import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OpportunityCard } from '@/components/opportunities/OpportunityCard';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { siteConfig, categories, countries } from '@/config/site';
import { truncateTitle } from '@/lib/seo';
import { formatDistanceToNow, getMaxJobAgeDate } from '@/lib/utils';
import { maskLinksForFreeUsers } from '@/lib/content-mask';
import { Button } from '@/components/ui/button';
import { CrossSellExitPopup } from '@/components/CrossSellExitPopup';
import { OpportunityClientInfo } from '@/components/opportunities/OpportunityClientInfo';
import { OpportunityApplyCard } from '@/components/opportunities/OpportunityApplyCard';
import { OpportunityViewTracker } from '@/components/opportunities/OpportunityViewTracker';
import { OpportunityOriginalPostFooter } from '@/components/opportunities/OpportunityOriginalPostFooter';
import { ProjectDetailNew } from '@/components/opportunities/ProjectDetailNew';

type UserPlan = 'FREE' | 'PRO' | 'ENTERPRISE';

// Check if slug is a known category
const categorySlugs = new Set(categories.map(c => c.slug));

// force-dynamic required: auth() checks user session for PRO/FREE content
export const dynamic = 'force-dynamic';

interface FreelancePageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ page?: string; country?: string }>;
}

async function getOpportunity(slug: string) {
  const opportunity = await prisma.opportunity.findUnique({
    where: { slug, isActive: true },
    include: {
      category: {
        select: {
          name: true,
          slug: true,
        },
      },
      company: {
        select: {
          name: true,
          slug: true,
          logo: true,
          website: true,
        },
      },
    },
  });

  return opportunity;
}

async function getSimilarProjects(opportunityId: string, categoryId: string, limit: number = 6) {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const opportunities = await prisma.opportunity.findMany({
      where: {
        id: { not: opportunityId },
        categoryId: categoryId,
        isActive: true,
        createdAt: { gte: thirtyDaysAgo },
      },
      select: {
        id: true,
        slug: true,
        title: true,
        clientName: true,
        location: true,
        salaryMin: true,
        salaryMax: true,
        salaryCurrency: true,
        salaryPeriod: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return opportunities;
  } catch (error) {
    console.error('Failed to fetch similar projects:', error);
    return [];
  }
}

export async function generateMetadata({ params }: FreelancePageProps): Promise<Metadata> {
  const { slug } = await params;

  // Category page metadata
  if (categorySlugs.has(slug)) {
    const category = categories.find(c => c.slug === slug)!;
    return {
      title: `Freelance ${category.name} Projects`,
      description: `Browse freelance ${category.name.toLowerCase()} projects from LinkedIn. Direct client opportunities updated daily.`,
      openGraph: {
        title: `Freelance ${category.name} Projects`,
        url: `${siteConfig.url}/freelance/${slug}`,
        siteName: siteConfig.name,
      },
      alternates: {
        canonical: `${siteConfig.url}/freelance/${slug}`,
      },
    };
  }

  // Single opportunity metadata
  const opportunity = await getOpportunity(slug);

  if (!opportunity) {
    return {
      title: 'Opportunity Not Found',
    };
  }

  const seoTitle = truncateTitle(`${opportunity.title} - Freelance Project`);
  const description = opportunity.description?.slice(0, 155) ||
    `Freelance ${opportunity.title} opportunity from ${opportunity.clientName}. Apply directly to the client.`;

  // Noindex for non-RICH content (THIN + LIGHT)
  const shouldNoindex = opportunity.contentQuality !== 'RICH';

  return {
    title: seoTitle,
    description,
    ...(shouldNoindex && {
      robots: {
        index: false,
        follow: true,
      },
    }),
    openGraph: {
      title: seoTitle,
      description,
      url: `${siteConfig.url}/freelance/${slug}`,
      siteName: siteConfig.name,
      type: 'website',
    },
    alternates: {
      canonical: `${siteConfig.url}/freelance/${slug}`,
    },
  };
}

export default async function FreelancePage({ params, searchParams }: FreelancePageProps) {
  const { slug } = await params;

  // === Category listing page ===
  if (categorySlugs.has(slug)) {
    const category = categories.find(c => c.slug === slug)!;
    const resolvedSearchParams = await (searchParams || Promise.resolve({} as { page?: string; country?: string }));
    const currentPage = Math.max(1, parseInt(resolvedSearchParams.page || '1', 10) || 1);
    const countryFilter = resolvedSearchParams.country || null;
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
      category: { slug },
    };

    if (countryFilter) {
      where.country = countryFilter.toUpperCase();
    }

    let categoryOpps: any[] = [];
    let totalCount = 0;
    try {
      [categoryOpps, totalCount] = await Promise.all([
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

    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">
          <div className="container py-6 sm:py-8">
            <nav className="mb-6 text-sm text-muted-foreground" aria-label="Breadcrumb">
              <ol className="flex items-center space-x-2">
                <li><Link href="/" className="hover:text-foreground">Home</Link></li>
                <li>/</li>
                <li><Link href="/freelance" className="hover:text-foreground">Freelance</Link></li>
                <li>/</li>
                <li className="text-foreground font-medium">{category.name}</li>
              </ol>
            </nav>

            <div className="mb-6">
              <h1 className="text-2xl sm:text-3xl font-bold mb-1">
                Freelance {category.name} Projects
                {countryFilter && ` in ${countries.find(c => c.code === countryFilter.toUpperCase())?.name || countryFilter}`}
              </h1>
              <p className="text-muted-foreground text-sm">
                {totalCount > 0
                  ? `${totalCount} ${category.name.toLowerCase()} projects available`
                  : `Browse ${category.name.toLowerCase()} freelance opportunities`}
              </p>
            </div>

            {/* Country filter */}
            <div className="flex flex-wrap gap-2 mb-4">
              <Link
                href={`/freelance/${slug}`}
                className={`text-xs px-3 py-1.5 rounded-full border ${!countryFilter ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:bg-muted'}`}
              >
                All Countries
              </Link>
              {countries.filter(c => c.code).slice(0, 15).map((c) => (
                <Link
                  key={c.slug}
                  href={`/freelance/${slug}?country=${c.code}`}
                  className={`text-xs px-3 py-1.5 rounded-full border ${countryFilter?.toUpperCase() === c.code ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:bg-muted'}`}
                >
                  {c.name}
                </Link>
              ))}
            </div>

            {categoryOpps.length > 0 ? (
              <div className="space-y-4">
                {categoryOpps.map((opp) => (
                  <OpportunityCard key={opp.id} opportunity={opp} isPro={isPro} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 border rounded-lg bg-muted/30">
                <p className="text-muted-foreground mb-4">
                  No {category.name.toLowerCase()} freelance projects found at the moment.
                </p>
                <Link href="/freelance">
                  <Button variant="outline">Browse all categories</Button>
                </Link>
              </div>
            )}

            {totalPages > 1 && (
              <nav className="mt-8 flex justify-center gap-2">
                {currentPage > 1 ? (
                  <Link href={`/freelance/${slug}?page=${currentPage - 1}`}>
                    <Button variant="outline">Previous</Button>
                  </Link>
                ) : (
                  <Button variant="outline" disabled>Previous</Button>
                )}
                <span className="flex items-center px-4 text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                {currentPage < totalPages ? (
                  <Link href={`/freelance/${slug}?page=${currentPage + 1}`}>
                    <Button variant="outline">Next</Button>
                  </Link>
                ) : (
                  <Button variant="outline" disabled>Next</Button>
                )}
              </nav>
            )}

            {/* Other categories */}
            <div className="mt-12 border-t pt-8">
              <h2 className="text-lg font-semibold mb-3">Other Categories</h2>
              <div className="flex flex-wrap gap-2">
                {categories
                  .filter((c) => c.slug !== slug)
                  .slice(0, 8)
                  .map((cat) => (
                    <Link
                      key={cat.slug}
                      href={`/freelance/${cat.slug}`}
                      className="px-3 py-1.5 text-sm border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      {cat.icon} {cat.name}
                    </Link>
                  ))}
              </div>
            </div>

            {/* Full-time jobs cross-link */}
            <div className="mt-8 bg-muted/50 rounded p-4">
              <p className="text-sm text-muted-foreground">
                Looking for full-time remote {category.name.toLowerCase()} jobs?{' '}
                <Link href={`/jobs/${category.slug}`} className="text-primary hover:underline font-medium">
                  Browse {category.name} positions →
                </Link>
              </p>
            </div>

            {/* FAQ Section */}
            <section className="mt-12">
              <h2 className="text-2xl font-bold mb-4">Frequently Asked Questions</h2>
              <div className="space-y-4">
                <details className="border rounded-lg p-4">
                  <summary className="font-medium cursor-pointer">
                    What freelance {category.name.toLowerCase()} projects are available?
                  </summary>
                  <p className="mt-2 text-muted-foreground">
                    Browse our listings for current freelance {category.name.toLowerCase()} opportunities posted directly by clients on LinkedIn and top company career pages. New projects are added daily.
                  </p>
                </details>
                <details className="border rounded-lg p-4">
                  <summary className="font-medium cursor-pointer">
                    How do I apply for freelance {category.name.toLowerCase()} projects?
                  </summary>
                  <p className="mt-2 text-muted-foreground">
                    Each project listing includes direct client contact info — email or LinkedIn profile. No middlemen or agencies. PRO members get full access to contact details and apply directly.
                  </p>
                </details>
                <details className="border rounded-lg p-4">
                  <summary className="font-medium cursor-pointer">
                    Are these legitimate freelance projects?
                  </summary>
                  <p className="mt-2 text-muted-foreground">
                    All projects are sourced directly from LinkedIn and verified client posts. We filter out spam and irrelevant content to show only genuine {category.name.toLowerCase()} freelance opportunities.
                  </p>
                </details>
              </div>
            </section>
          </div>
        </main>
        <Footer />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: siteConfig.url },
                { '@type': 'ListItem', position: 2, name: 'Freelance', item: `${siteConfig.url}/freelance` },
                { '@type': 'ListItem', position: 3, name: category.name, item: `${siteConfig.url}/freelance/${slug}` },
              ],
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: [
                {
                  '@type': 'Question',
                  name: `What freelance ${category.name} projects are available?`,
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: `Browse our listings for current freelance ${category.name} opportunities posted directly by clients on LinkedIn and top company career pages. New projects are added daily.`,
                  },
                },
                {
                  '@type': 'Question',
                  name: `How do I apply for freelance ${category.name} projects?`,
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: `Each project listing includes direct client contact info — email or LinkedIn profile. No middlemen or agencies. PRO members get full access to contact details and apply directly.`,
                  },
                },
                {
                  '@type': 'Question',
                  name: 'Are these legitimate freelance projects?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: `All projects are sourced directly from LinkedIn and verified client posts. We filter out spam and irrelevant content to show only genuine ${category.name} freelance opportunities.`,
                  },
                },
              ],
            }),
          }}
        />
      </div>
    );
  }

  // === Single opportunity page ===
  const opportunity = await getOpportunity(slug);

  if (!opportunity) {
    notFound();
  }

  // THIN content → redirect to category (saves crawl budget)
  if (opportunity.contentQuality === 'THIN') {
    const categorySlug = opportunity.category?.slug;
    redirect(categorySlug ? `/freelance/${categorySlug}` : '/freelance');
  }

  // Total project count for CTA banner
  const totalProjectCount = await prisma.opportunity.count({
    where: { createdAt: { gte: new Date(Date.now() - 14 * 86400000) }, isActive: true },
  });

  // Get user session and plan
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
    // Check if contact is unlocked via pay-per-contact
    if (userPlan === 'FREE') {
      const unlocked = await prisma.unlockedContact.findFirst({
        where: { userId: session.user.id, opportunityId: opportunity.id },
      });
      if (unlocked) userPlan = 'PRO';
    }
  }

  const isPro = userPlan === 'PRO' || userPlan === 'ENTERPRISE';

  // Fetch similar projects
  const similarProjects = await getSimilarProjects(opportunity.id, opportunity.categoryId);

  // Mask links/emails in original content for FREE users
  const displayOriginalContent = maskLinksForFreeUsers(opportunity.originalContent, userPlan);

  const salaryDisplay = formatSalary(
    opportunity.salaryMin,
    opportunity.salaryMax,
    opportunity.salaryCurrency,
    opportunity.salaryPeriod
  );

  // JobPosting schema for Google Jobs
  const validThrough = new Date(opportunity.createdAt.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const schemaUnitText: Record<string, string> = {
    HOUR: 'HOUR', DAY: 'DAY', WEEK: 'WEEK', MONTH: 'MONTH', YEAR: 'YEAR',
  };
  const jobPostingSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: opportunity.title,
    description: opportunity.description || opportunity.originalContent || opportunity.title,
    datePosted: opportunity.createdAt.toISOString(),
    validThrough,
    employmentType: 'CONTRACTOR',
    jobLocationType: 'TELECOMMUTE',
    applicantLocationRequirements: {
      '@type': 'Country',
      name: 'Worldwide',
    },
    hiringOrganization: {
      '@type': 'Organization',
      name: opportunity.company?.name || opportunity.clientName || 'Freelance Client',
      ...(opportunity.company?.website && { sameAs: opportunity.company.website }),
    },
  };
  if (opportunity.salaryMin) {
    jobPostingSchema.baseSalary = {
      '@type': 'MonetaryAmount',
      currency: opportunity.salaryCurrency || 'USD',
      value: {
        '@type': 'QuantitativeValue',
        minValue: opportunity.salaryMin,
        ...(opportunity.salaryMax && { maxValue: opportunity.salaryMax }),
        unitText: (opportunity.salaryPeriod && schemaUnitText[opportunity.salaryPeriod]) || 'YEAR',
      },
    };
  }

  const postedAgo = formatDistanceToNow(opportunity.createdAt);

  return (
    <>
      <OpportunityViewTracker
        opportunityId={opportunity.id}
        title={opportunity.title}
        clientName={opportunity.clientName || undefined}
        category={opportunity.category?.slug || undefined}
      />
      <ProjectDetailNew
        opportunity={{
          id: opportunity.id,
          title: opportunity.title,
          description: opportunity.description || opportunity.originalContent || '',
          companyName: opportunity.companyName,
          clientName: opportunity.clientName,
          clientHeadline: opportunity.clientHeadline,
          clientAvatar: opportunity.clientAvatar,
          clientLinkedIn: opportunity.clientLinkedIn,
          source: opportunity.source,
          sourceUrl: opportunity.sourceUrl,
          skills: opportunity.skills || [],
          locationType: opportunity.locationType,
          location: opportunity.location,
          level: opportunity.level,
          salary: null,
          createdAt: opportunity.createdAt,
          category: opportunity.category,
        }}
        totalProjectCount={totalProjectCount}
        isLoggedIn={!!session}
        postedAgo={postedAgo}
      />

      {/* JobPosting Schema for Google Jobs */}
      {jobPostingSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingSchema) }}
        />
      )}
    </>
  );
}

function formatSalary(
  min: number | null,
  max: number | null,
  currency: string | null,
  period: string | null
): string | null {
  if (!min && !max) return null;

  const curr = currency || 'USD';
  let formatter: Intl.NumberFormat;
  try {
    formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: curr,
      maximumFractionDigits: 0,
    });
  } catch {
    formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    });
  }

  let salary: string;
  if (min && max) {
    salary = `${formatter.format(min)} - ${formatter.format(max)}`;
  } else if (min) {
    salary = `${formatter.format(min)}+`;
  } else if (max) {
    salary = `Up to ${formatter.format(max)}`;
  } else {
    return null;
  }

  const periodLabels: Record<string, string> = {
    HOUR: '/hr',
    DAY: '/day',
    WEEK: '/wk',
    MONTH: '/mo',
    YEAR: '/yr',
    ONE_TIME: '',
  };

  return `${salary}${period ? periodLabels[period] || '' : ''}`;
}

function formatLevel(level: string): string {
  const map: Record<string, string> = {
    INTERN: 'Intern',
    ENTRY: 'Entry',
    JUNIOR: 'Junior',
    MID: 'Mid',
    SENIOR: 'Senior',
    LEAD: 'Lead',
    MANAGER: 'Manager',
    DIRECTOR: 'Director',
    EXECUTIVE: 'Executive',
  };
  return map[level] || level;
}
