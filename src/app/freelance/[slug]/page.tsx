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

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="container py-6 sm:py-8">
          {/* Breadcrumbs */}
          <nav className="text-sm text-muted-foreground mb-6">
            <ol className="flex items-center gap-2">
              <li>
                <Link href="/" className="hover:text-foreground">
                  Home
                </Link>
              </li>
              <li>/</li>
              <li>
                <Link href="/jobs" className="hover:text-foreground">
                  Freelance
                </Link>
              </li>
              <li>/</li>
              <li className="text-foreground line-clamp-1">{opportunity.title}</li>
            </ol>
          </nav>

          <OpportunityViewTracker
            opportunityId={opportunity.id}
            title={opportunity.title}
            clientName={opportunity.clientName || undefined}
            category={opportunity.category?.slug || undefined}
          />

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Header Card */}
              <Card className="border-orange-200 bg-orange-50/30">
                <CardContent className="p-6">
                  {/* Direct Project Banner */}
                  <div className="mb-4 flex items-center justify-between">
                    <Badge className="bg-orange-600 text-white">
                      🔥 Direct to Recruiter · No Middlemen
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      Posted {formatDistanceToNow(opportunity.createdAt)}
                    </span>
                  </div>

                  {/* Client Info */}
                  <OpportunityClientInfo
                    opportunityId={opportunity.id}
                    isPro={isPro}
                    clientName={opportunity.clientName}
                    clientHeadline={opportunity.clientHeadline}
                    clientAvatar={opportunity.clientAvatar}
                    clientLinkedIn={opportunity.clientLinkedIn}
                    applyEmail={opportunity.applyEmail}
                    title={opportunity.title}
                  />

                  {/* Title */}
                  <h1 className="text-2xl sm:text-3xl font-bold mb-4">
                    {opportunity.title}
                  </h1>

                  {/* Meta */}
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    {opportunity.location && (
                      <span className="flex items-center gap-1">
                        📍 {opportunity.location}
                      </span>
                    )}
                    <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300 font-medium">
                      💼 Freelance Project
                    </Badge>
                  </div>

                  {/* Tags */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge variant="outline" className="bg-red-100/80 text-red-700 border-red-300/60 backdrop-blur-sm">
                      🔥 Urgent
                    </Badge>
                    <Badge variant="secondary">
                      {formatLevel(opportunity.level)}
                    </Badge>
                    {opportunity.skills.slice(0, 5).map((skill) => (
                      <Badge key={skill} variant="outline">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Original Post Content */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                    Original Post
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none">
                    <div className="whitespace-pre-wrap">{displayOriginalContent}</div>
                  </div>

                  <OpportunityOriginalPostFooter
                    opportunityId={opportunity.id}
                    isPro={isPro}
                    sourceUrl={opportunity.sourceUrl}
                    applyEmail={opportunity.applyEmail}
                    title={opportunity.title}
                    clientName={opportunity.clientName || undefined}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Apply Card */}
              <OpportunityApplyCard
                opportunityId={opportunity.id}
                isPro={isPro}
                clientLinkedIn={opportunity.clientLinkedIn}
                applyEmail={opportunity.applyEmail}
                applyUrl={opportunity.applyUrl}
                title={opportunity.title}
                clientName={opportunity.clientName}
                postedAt={opportunity.createdAt.toISOString()}
                budget={null}
              />

              {/* Category Link */}
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground mb-2">Category</p>
                  <Link
                    href={`/jobs/${opportunity.category.slug}`}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    {opportunity.category.name} Jobs
                  </Link>
                </CardContent>
              </Card>

              {/* Removal Request */}
              <div className="text-center">
                <a
                  href={`mailto:removal@freelanly.com?subject=Removal%20Request&body=Please%20remove%20this%20listing:%20${encodeURIComponent(`${siteConfig.url}/freelance/${slug}`)}`}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  Request Removal
                </a>
              </div>
            </div>
          </div>

          {/* Similar Projects Section */}
          {similarProjects.length > 0 && (
            <div className="mt-12">
              <h2 className="text-2xl font-bold mb-6">Similar {opportunity.category.name} Projects</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {similarProjects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/freelance/${project.slug}`}
                    className="block"
                  >
                    <Card className="h-full hover:shadow-md transition-shadow">
                      <CardContent className="pt-4">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-sm line-clamp-2">{project.title}</h3>
                          <p className="text-sm text-muted-foreground truncate">{project.clientName}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {project.location && (
                              <span className="text-xs text-muted-foreground">{project.location}</span>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
              <div className="mt-6 text-center">
                <Link href={`/jobs/${opportunity.category.slug}`}>
                  <Button variant="outline">
                    View all {opportunity.category.name} projects →
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* Looking for full-time work? */}
          <div className="mt-8 bg-muted/50 rounded p-4">
            <p className="text-sm text-muted-foreground">
              Looking for full-time remote {opportunity.category.name.toLowerCase()} jobs?{' '}
              <Link href={`/jobs/${opportunity.category.slug}`} className="text-primary hover:underline font-medium">
                Browse {opportunity.category.name} positions →
              </Link>
            </p>
          </div>
        </div>
      </main>

      <Footer />

      {/* CrossSellExitPopup removed — annoying UX */}

      {/* Breadcrumb Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              {
                '@type': 'ListItem',
                position: 1,
                name: 'Home',
                item: siteConfig.url,
              },
              {
                '@type': 'ListItem',
                position: 2,
                name: 'Freelance Projects',
                item: `${siteConfig.url}/freelance`,
              },
              {
                '@type': 'ListItem',
                position: 3,
                name: opportunity.title,
                item: `${siteConfig.url}/freelance/${slug}`,
              },
            ],
          }),
        }}
      />
      {/* JobPosting Schema for Google Jobs */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingSchema) }}
      />

      {/* Sticky CTA banner for unauthenticated users */}
      {!session && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t" style={{ background: '#0A0B0F', borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="container flex items-center justify-between gap-4 py-3.5 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] tracking-wider uppercase px-2.5 py-1 rounded-full" style={{ background: 'rgba(199,249,74,0.15)', color: '#C7F94A', border: '1px solid rgba(199,249,74,0.3)' }}>
                1 of {totalProjectCount.toLocaleString()}
              </span>
              <span className="text-[14px] text-[#E8E8E3]">
                open projects. <span className="text-[#9C9EA2]">Sign up — AI applies to all of them for you.</span>
              </span>
            </div>
            <a
              href="/auth/signin"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-[14px] whitespace-nowrap hover:-translate-y-px transition-transform"
              style={{ background: '#C7F94A', color: '#000' }}
            >
              Start free →
            </a>
          </div>
        </div>
      )}
    </div>
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
