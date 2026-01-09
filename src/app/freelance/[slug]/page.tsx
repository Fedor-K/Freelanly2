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

  // Mask links/emails in description for FREE users
  const displayDescription = maskLinksForFreeUsers(opportunity.description, userPlan);
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
                      Direct Freelance Project
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      Posted {formatDistanceToNow(opportunity.createdAt)}
                    </span>
                  </div>

                  {/* Client Info */}
                  <div className="flex items-start gap-4 mb-6">
                    <div className={!isPro ? 'blur-sm select-none' : ''}>
                      {opportunity.clientAvatar ? (
                        <Image
                          src={opportunity.clientAvatar}
                          alt={opportunity.clientName}
                          width={64}
                          height={64}
                          className="rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-2xl">
                          {opportunity.clientName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <h2 className={`text-lg font-semibold ${!isPro ? 'blur-sm select-none' : ''}`}>
                        {opportunity.clientName}
                      </h2>
                      {opportunity.clientHeadline && (
                        <p className={`text-sm text-muted-foreground ${!isPro ? 'blur-sm select-none' : ''}`}>
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
                          <span className="blur-sm select-none">linkedin.com/in/•••••</span>
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
                    <span className="flex items-center gap-1">
                      ⏱️ Freelance
                    </span>
                  </div>

                  {/* Tags */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">
                      Urgent
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

              {/* Description Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Project Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none">
                    <div className="whitespace-pre-wrap">{displayDescription}</div>
                  </div>
                  {!isPro && (
                    <p className="mt-4 text-sm text-muted-foreground">
                      Some contact details are hidden.{' '}
                      <Link href="/pricing" className="text-orange-600 hover:underline">
                        Upgrade to PRO
                      </Link>{' '}
                      to see everything.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Original Post */}
              {opportunity.originalContent && opportunity.originalContent !== opportunity.description && (
                <Card>
                  <CardHeader>
                    <CardTitle>Original LinkedIn Post</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="whitespace-pre-wrap text-sm text-muted-foreground">
                        {displayOriginalContent}
                      </div>
                    </div>
                    {isPro ? (
                      <a
                        href={opportunity.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline mt-4 inline-block"
                      >
                        View original post on LinkedIn →
                      </a>
                    ) : (
                      <Link
                        href="/pricing"
                        className="text-sm text-orange-600 hover:underline mt-4 inline-block"
                      >
                        Upgrade to PRO to view original post →
                      </Link>
                    )}
                  </CardContent>
                </Card>
              )}
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
                      <div className="blur-sm select-none pointer-events-none">
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
                      <div className="blur-sm select-none pointer-events-none">
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
                      <div className="blur-sm select-none pointer-events-none">
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
