import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { siteConfig } from '@/config/site';
import { truncateTitle } from '@/lib/seo';
import { formatDistanceToNow } from '@/lib/utils';
import { maskLinksForFreeUsers } from '@/lib/content-mask';
import { CrossSellExitPopup } from '@/components/CrossSellExitPopup';

type UserPlan = 'FREE' | 'PRO' | 'ENTERPRISE';

// force-dynamic required: auth() checks user session for PRO/FREE content
export const dynamic = 'force-dynamic';

interface FreelancePageProps {
  params: Promise<{ slug: string }>;
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

export async function generateMetadata({ params }: FreelancePageProps): Promise<Metadata> {
  const { slug } = await params;
  const opportunity = await getOpportunity(slug);

  if (!opportunity) {
    return {
      title: 'Opportunity Not Found',
    };
  }

  const seoTitle = truncateTitle(`${opportunity.title} - Freelance Project`);
  const description = opportunity.description?.slice(0, 155) ||
    `Freelance ${opportunity.title} opportunity from ${opportunity.clientName}. Apply directly to the client.`;

  // Noindex for THIN content
  const shouldNoindex = opportunity.contentQuality === 'THIN';

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
      type: 'article',
    },
    alternates: {
      canonical: `${siteConfig.url}/freelance/${slug}`,
    },
  };
}

export default async function FreelancePage({ params }: FreelancePageProps) {
  const { slug } = await params;
  const opportunity = await getOpportunity(slug);

  if (!opportunity) {
    notFound();
  }

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
  }

  const isPro = userPlan === 'PRO' || userPlan === 'ENTERPRISE';

  // Mask links/emails in original content for FREE users
  const displayOriginalContent = maskLinksForFreeUsers(opportunity.originalContent, userPlan);

  const salaryDisplay = formatSalary(
    opportunity.salaryMin,
    opportunity.salaryMax,
    opportunity.salaryCurrency,
    opportunity.salaryPeriod
  );

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
                  Opportunities
                </Link>
              </li>
              <li>/</li>
              <li className="text-foreground line-clamp-1">{opportunity.title}</li>
            </ol>
          </nav>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Header Card */}
              <Card className="border-orange-200 bg-orange-50/30">
                <CardContent className="p-6">
                  {/* Direct Project Banner */}
                  <div className="mb-4 flex items-center justify-between">
                    <Badge className="bg-orange-600 text-white">
                      🔥 Direct Freelance Project
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      Posted {formatDistanceToNow(opportunity.createdAt)}
                    </span>
                  </div>

                  {/* Client Info */}
                  <div className="flex items-start gap-4 mb-6">
                    <div>
                      {opportunity.clientAvatar ? (
                        <Image
                          src={opportunity.clientAvatar}
                          alt={opportunity.clientName}
                          width={64}
                          height={64}
                          className={`rounded-full object-cover ${!isPro ? 'blur-[3px]' : ''}`}
                        />
                      ) : (
                        <div className={`w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-2xl ${!isPro ? 'blur-[3px]' : ''}`}>
                          {opportunity.clientName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <h2 className={`text-lg font-semibold ${!isPro ? 'blur-[3px] select-none' : ''}`}>
                        {opportunity.clientName}
                      </h2>
                      {opportunity.clientHeadline && (
                        <p className={`text-sm text-muted-foreground ${!isPro ? 'blur-[3px] select-none' : ''}`}>
                          {opportunity.clientHeadline}
                        </p>
                      )}
                      {isPro ? (
                        <a
                          href={opportunity.clientLinkedIn}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline mt-1 inline-block"
                        >
                          View LinkedIn Profile →
                        </a>
                      ) : (
                        <Link
                          href="/pricing"
                          className="text-sm text-orange-600 hover:underline mt-1 inline-flex items-center gap-1"
                        >
                          <span className="blur-[3px] select-none">linkedin.com/in/•••••</span>
                          <span className="no-blur">Upgrade to see →</span>
                        </Link>
                      )}
                    </div>
                  </div>

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
                    {salaryDisplay && (
                      <span className="flex items-center gap-1 text-green-600 font-medium">
                        💰 {salaryDisplay}
                        {opportunity.salaryIsEstimate && ' (est.)'}
                      </span>
                    )}
                    <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300 font-medium">
                      💼 Freelance Project
                    </Badge>
                  </div>

                  {/* Tags */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">
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

                  <div className="mt-4 pt-4 border-t flex items-center justify-between">
                    {isPro ? (
                      <a
                        href={opportunity.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
                      >
                        View on LinkedIn →
                      </a>
                    ) : (
                      <Link
                        href="/pricing"
                        className="text-sm text-orange-600 hover:underline"
                      >
                        Upgrade to view on LinkedIn →
                      </Link>
                    )}
                    {!isPro && (
                      <span className="text-xs text-muted-foreground">
                        Contact details hidden
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Apply Card */}
              <Card className="sticky top-4">
                <CardHeader>
                  <CardTitle>Contact Client</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    This is a direct freelance opportunity. Contact the client directly via LinkedIn or the provided contact info.
                  </p>

                  {isPro ? (
                    <a
                      href={opportunity.clientLinkedIn}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <Button className="w-full bg-blue-600 hover:bg-blue-700">
                        Message on LinkedIn
                      </Button>
                    </a>
                  ) : (
                    <div className="relative">
                      <div className="blur-[3px] select-none pointer-events-none">
                        <Button className="w-full bg-blue-600">
                          Message on LinkedIn
                        </Button>
                      </div>
                    </div>
                  )}

                  {opportunity.applyEmail && (
                    isPro ? (
                      <a
                        href={`mailto:${opportunity.applyEmail}?subject=Re: ${encodeURIComponent(opportunity.title)}`}
                        className="block"
                      >
                        <Button variant="outline" className="w-full">
                          Email: {opportunity.applyEmail}
                        </Button>
                      </a>
                    ) : (
                      <div className="blur-[3px] select-none pointer-events-none">
                        <Button variant="outline" className="w-full">
                          Email: •••••@••••.com
                        </Button>
                      </div>
                    )
                  )}

                  {opportunity.applyUrl && (
                    isPro ? (
                      <a
                        href={opportunity.applyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <Button variant="outline" className="w-full">
                          Apply via Link
                        </Button>
                      </a>
                    ) : (
                      <div className="blur-[3px] select-none pointer-events-none">
                        <Button variant="outline" className="w-full">
                          Apply via Link
                        </Button>
                      </div>
                    )
                  )}

                  {!isPro && (
                    <Link href="/pricing" className="block">
                      <Button className="w-full bg-orange-600 hover:bg-orange-700">
                        Upgrade to PRO to Contact
                      </Button>
                    </Link>
                  )}

                  <div className="pt-4 border-t">
                    <p className="text-xs text-muted-foreground">
                      {isPro
                        ? '⚡ This project was posted recently. Apply quickly for the best chance of success.'
                        : 'PRO members get unlimited access to client contact info and direct application links.'}
                    </p>
                  </div>
                </CardContent>
              </Card>

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
        </div>
      </main>

      <Footer />

      {/* Cross-sell exit popup - show full-time jobs */}
      <CrossSellExitPopup
        currentType="opportunity"
        categorySlug={opportunity.category.slug}
        categoryName={opportunity.category.name}
      />

      {/* Breadcrumb Schema (NO JobPosting schema for opportunities) */}
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
                name: 'Opportunities',
                item: `${siteConfig.url}/jobs`,
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
