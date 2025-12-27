import { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ExpiredJobPage } from '@/components/jobs/ExpiredJobPage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { CompanyLogo } from '@/components/ui/CompanyLogo';
import { UserPlan } from '@/components/jobs/SalaryInsights';
import { SalaryInsightsAsync } from '@/components/jobs/SalaryInsightsAsync';
import { SalaryInsightsSkeleton } from '@/components/jobs/SalaryInsightsSkeleton';
import { ApplyButton } from '@/components/jobs/ApplyButton';
import { SocialShare } from '@/components/jobs/SocialShare';
import { JobViewTracker } from '@/components/jobs/JobViewTracker';
import { StructuredDescription } from '@/components/jobs/StructuredDescription';
import { formatDistanceToNow } from '@/lib/utils';
import { maskLinksForFreeUsers } from '@/lib/content-mask';
import { siteConfig, categories } from '@/config/site';
import { truncateTitle } from '@/lib/seo';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

// force-dynamic required: auth() checks user session for PRO/FREE content
export const dynamic = 'force-dynamic';

interface JobPageProps {
  params: Promise<{ companySlug: string; jobSlug: string }>;
}

// Helper to build job URL in RRS format
function buildJobUrl(companySlug: string, jobSlug: string): string {
  return `${siteConfig.url}/company/${companySlug}/jobs/${jobSlug}`;
}

// Helper to format salary period label
function formatSalaryPeriod(period: string): string {
  const labels: Record<string, string> = {
    'HOUR': '/hour',
    'DAY': '/day',
    'WEEK': '/week',
    'MONTH': '/month',
    'YEAR': '/year',
    'ONE_TIME': 'one-time',
  };
  return labels[period] || '/year';
}

// Helper to format salary compactly for similar jobs cards
function formatSalaryCompact(
  min: number,
  max: number | null,
  currency: string | null,
  period: string | null
): string {
  const curr = currency || 'USD';
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: curr,
    maximumFractionDigits: 0,
    notation: 'compact',
  });

  const periodLabels: Record<string, string> = {
    'HOUR': '/hr',
    'DAY': '/day',
    'WEEK': '/wk',
    'MONTH': '/mo',
    'YEAR': '/yr',
    'ONE_TIME': '',
  };
  const periodSuffix = period ? (periodLabels[period] ?? '') : '';

  if (max) {
    return `${formatter.format(min)}-${formatter.format(max)}${periodSuffix}`;
  }
  return `${formatter.format(min)}+${periodSuffix}`;
}

// Helper to map salary period to Schema.org unitText
function getSchemaUnitText(period: string): string | null {
  const schemaUnits: Record<string, string> = {
    'HOUR': 'HOUR',
    'DAY': 'DAY',
    'WEEK': 'WEEK',
    'MONTH': 'MONTH',
    'YEAR': 'YEAR',
  };
  return schemaUnits[period] || null; // ONE_TIME returns null (not supported by Schema.org)
}

// Fetch job from database
async function getJob(jobSlug: string) {
  try {
    const job = await prisma.job.findUnique({
      where: { slug: jobSlug },
      include: {
        company: true,
        category: true,
      },
    });
    return job;
  } catch (error) {
    console.error('Failed to fetch job:', error);
    return null;
  }
}

// Fetch similar jobs (same category, exclude current job)
async function getSimilarJobs(jobId: string, categoryId: string, limit: number = 6) {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const jobs = await prisma.job.findMany({
      where: {
        id: { not: jobId },
        categoryId: categoryId,
        isActive: true,
        postedAt: { gte: thirtyDaysAgo },
      },
      include: {
        company: true,
        category: true,
      },
      orderBy: { postedAt: 'desc' },
      take: limit,
    });
    return jobs;
  } catch (error) {
    console.error('Failed to fetch similar jobs:', error);
    return [];
  }
}

// Fetch recent jobs for expired job page
async function getRecentJobs(limit: number = 6) {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const jobs = await prisma.job.findMany({
      where: {
        isActive: true,
        postedAt: { gte: thirtyDaysAgo },
      },
      select: {
        id: true,
        slug: true,
        title: true,
        location: true,
        company: {
          select: {
            name: true,
            slug: true,
            logo: true,
            website: true,
          },
        },
      },
      orderBy: { postedAt: 'desc' },
      take: limit,
    });
    return jobs;
  } catch (error) {
    console.error('Failed to fetch recent jobs:', error);
    return [];
  }
}

export async function generateMetadata({ params }: JobPageProps): Promise<Metadata> {
  const { companySlug, jobSlug } = await params;
  const job = await getJob(jobSlug);

  if (!job) {
    return {
      title: 'Job No Longer Available',
      description: 'This job posting has expired or is no longer accepting applications. Browse thousands of other remote opportunities on Freelanly.',
      robots: {
        index: false, // Don't index expired job pages
        follow: true,
      },
    };
  }

  const jobUrl = buildJobUrl(job.company.slug, job.slug);
  const salaryText = job.salaryMin && job.salaryMax
    ? ` $${(job.salaryMin/1000).toFixed(0)}K-$${(job.salaryMax/1000).toFixed(0)}K.`
    : '';
  const description = `${job.title} at ${job.company.name}. ${job.location}.${salaryText} Apply now and join a top remote team!`;

  // Use SEO utility for consistent title truncation (max 60 chars)
  const seoTitle = truncateTitle(`${job.title} at ${job.company.name} - Remote ${job.category.name} Job`);

  // Build OG image URL with job details
  const ogImageParams = new URLSearchParams({
    title: job.title,
    company: job.company.name,
    location: job.location || 'Remote',
    category: job.category.name,
    ...(job.salaryMin && job.salaryMax && {
      salary: `$${(job.salaryMin/1000).toFixed(0)}K-$${(job.salaryMax/1000).toFixed(0)}K`,
    }),
  });
  const ogImageUrl = `${siteConfig.url}/api/og?${ogImageParams.toString()}`;

  return {
    title: seoTitle,
    description,
    keywords: [
      job.title.toLowerCase(),
      `remote ${job.category.name.toLowerCase()} jobs`,
      `${job.company.name} careers`,
      `${job.company.name} jobs`,
      ...job.skills.map(s => `${s.toLowerCase()} jobs`),
    ],
    openGraph: {
      title: `${job.title} at ${job.company.name}`,
      description,
      type: 'website',
      url: jobUrl,
      siteName: siteConfig.name,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: `${job.title} at ${job.company.name}` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${job.title} at ${job.company.name}`,
      description,
      images: [ogImageUrl],
    },
    alternates: {
      canonical: jobUrl,
    },
  };
}

export default async function JobPage({ params }: JobPageProps) {
  const { companySlug, jobSlug } = await params;
  const job = await getJob(jobSlug);

  // Job not found - show expired page
  // The metadata sets robots: noindex to tell Google to remove from index
  if (!job) {
    const recentJobs = await getRecentJobs(6);
    return <ExpiredJobPage jobSlug={jobSlug} similarJobs={recentJobs} />;
  }

  const isLinkedInPost = job.sourceType === 'UNSTRUCTURED';
  const jobUrl = buildJobUrl(job.company.slug, job.slug);

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

  // Prepare description - mask contacts for FREE users
  const displayDescription = maskLinksForFreeUsers(job.description, userPlan);
  const displayOriginalContent = maskLinksForFreeUsers(job.originalContent, userPlan);

  // Fetch similar jobs
  const similarJobs = await getSimilarJobs(job.id, job.categoryId);

  return (
    <div className="flex min-h-screen flex-col">
      <JobViewTracker
        jobId={job.id}
        jobTitle={job.title}
        companyName={job.company.name}
        category={job.category.name}
      />
      <Header />

      <main className="flex-1">
        <div className="container py-8">
          {/* Breadcrumbs - simplified path */}
          <nav className="mb-6 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground">Home</Link>
            {' / '}
            <Link href={`/company/${job.company.slug}`} className="hover:text-foreground">
              {job.company.name}
            </Link>
            {' / '}
            <span className="text-foreground">{job.title}</span>
          </nav>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Job Header */}
              <div className="flex gap-4">
                <CompanyLogo
                  name={job.company.name}
                  logo={job.company.logo}
                  website={job.company.website}
                  size="lg"
                />
                <div>
                  <h1 className="text-2xl font-bold">{job.title} at {job.company.name}</h1>
                  <Link
                    href={`/company/${job.company.slug}`}
                    className="text-lg text-muted-foreground hover:underline"
                  >
                    {job.company.name}
                  </Link>
                  <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                    <span>{job.location}</span>
                    <span>·</span>
                    <span>{formatDistanceToNow(job.postedAt)}</span>
                  </div>
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2">
                <Badge>{formatLevel(job.level)}</Badge>
                <Badge variant="outline">{formatJobType(job.type)}</Badge>
                {isLinkedInPost && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    From LinkedIn Post
                  </Badge>
                )}
                {job.skills.map((skill) => (
                  <Badge key={skill} variant="secondary">{skill}</Badge>
                ))}
              </div>

              {/* Salary */}
              {(job.salaryMin || job.salaryMax) && (
                <Card>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Salary Range</p>
                        <p className="text-xl font-semibold">
                          {formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency)}
                          <span className="text-sm font-normal text-muted-foreground"> {formatSalaryPeriod(job.salaryPeriod)}</span>
                        </p>
                      </div>
                      {job.salaryIsEstimate && (
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                          Estimated
                        </Badge>
                      )}
                    </div>
                    {job.salaryIsEstimate && (
                      <p className="text-xs text-muted-foreground mt-2">
                        This salary is estimated based on similar roles. The actual salary may vary.
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* DUAL DISPLAY - Key Feature! */}
              {isLinkedInPost ? (
                <>
                  {/* Extracted Facts */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        📋 Extracted Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Role</p>
                          <p className="font-medium">{job.title}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Company</p>
                          <p className="font-medium">{job.company.name}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Level</p>
                          <p className="font-medium">{formatLevel(job.level)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Type</p>
                          <p className="font-medium">{formatJobType(job.type)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Location</p>
                          <p className="font-medium">{job.location}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Contact</p>
                          <p className="font-medium">
                            {job.applyEmail ? (
                              userPlan === 'PRO' ? (
                                job.applyEmail
                              ) : (
                                <Link href="/pricing" className="text-primary hover:underline">
                                  Upgrade to PRO to see
                                </Link>
                              )
                            ) : (
                              'DM on LinkedIn'
                            )}
                          </p>
                        </div>
                      </div>
                      {job.skills.length > 0 && (
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">Skills Mentioned</p>
                          <div className="flex flex-wrap gap-1">
                            {job.skills.map((skill) => (
                              <Badge key={skill} variant="secondary" className="text-xs">{skill}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {job.benefits.length > 0 && (
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">Benefits Mentioned</p>
                          <div className="flex flex-wrap gap-1">
                            {job.benefits.map((benefit) => (
                              <Badge key={benefit} variant="outline" className="text-xs">{benefit}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {(job.sourceLanguages.length > 0 || job.targetLanguages.length > 0) && (
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">Languages</p>
                          <div className="flex flex-wrap gap-2">
                            {job.sourceLanguages.length > 0 && (
                              <div>
                                <span className="text-xs text-muted-foreground">Source: </span>
                                {job.sourceLanguages.map((lang) => (
                                  <Badge key={lang} variant="secondary" className="text-xs mr-1">{lang}</Badge>
                                ))}
                              </div>
                            )}
                            {job.targetLanguages.length > 0 && (
                              <div>
                                <span className="text-xs text-muted-foreground">Target: </span>
                                {job.targetLanguages.map((lang) => (
                                  <Badge key={lang} variant="secondary" className="text-xs mr-1">{lang}</Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Structured Description (AI-generated clean text) or Original Post */}
                  <StructuredDescription
                    cleanDescription={job.cleanDescription}
                    summaryBullets={job.summaryBullets}
                    requirementBullets={job.requirementBullets}
                    benefitBullets={job.benefitBullets}
                    originalContent={maskLinksForFreeUsers(job.originalContent, userPlan)}
                  />
                </>
              ) : (
                /* Standard Job Description for ATS jobs - with structured clean description if available */
                <StructuredDescription
                  cleanDescription={job.cleanDescription}
                  summaryBullets={job.summaryBullets}
                  requirementBullets={job.requirementBullets}
                  benefitBullets={job.benefitBullets}
                  originalContent={maskLinksForFreeUsers(job.description, userPlan)}
                />
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Salary Insights - wrapped in Suspense for progressive loading */}
              <Suspense fallback={<SalaryInsightsSkeleton />}>
                <SalaryInsightsAsync
                  jobTitle={job.title}
                  location={job.location}
                  country={job.country}
                  categoryId={job.categoryId}
                  level={job.level}
                  categorySlug={job.category.slug}
                  salaryMin={job.salaryMin}
                  salaryMax={job.salaryMax}
                  salaryCurrency={job.salaryCurrency}
                  salaryIsEstimate={job.salaryIsEstimate}
                  userPlan={userPlan}
                />
              </Suspense>

              {/* Apply Card */}
              <Card className="sticky top-20">
                <CardContent className="pt-6 space-y-4">
                  <ApplyButton
                    jobId={job.id}
                    applyUrl={job.applyUrl}
                    applyEmail={job.applyEmail}
                    sourceUrl={job.sourceUrl}
                    jobTitle={job.title}
                    companyName={job.company.name}
                    jobDescription={job.description}
                    userPlan={userPlan}
                  />

                  {/* LinkedIn Links - PRO only */}
                  {userPlan !== 'FREE' && isLinkedInPost && (job.sourceUrl || job.authorLinkedIn) && (
                    <div className="flex flex-col gap-2">
                      {job.sourceUrl && (
                        <Button variant="outline" size="sm" className="w-full" asChild>
                          <a href={job.sourceUrl} target="_blank" rel="noopener noreferrer">
                            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                            </svg>
                            View Original Post
                          </a>
                        </Button>
                      )}
                      {job.authorLinkedIn && (
                        <Button variant="ghost" size="sm" className="w-full" asChild>
                          <a href={job.authorLinkedIn} target="_blank" rel="noopener noreferrer">
                            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                            </svg>
                            View Author Profile
                          </a>
                        </Button>
                      )}
                    </div>
                  )}

                  <Separator />

                  {/* Share */}
                  <div>
                    <h3 className="font-semibold mb-3">Share this job</h3>
                    <SocialShare
                      jobId={job.id}
                      url={jobUrl}
                      title={`${job.title} at ${job.company.name}`}
                      description={job.description?.slice(0, 200)}
                    />
                  </div>

                  <Separator />

                  {/* Company Info */}
                  <div>
                    <h3 className="font-semibold mb-3">About {job.company.name}</h3>
                    {job.company.description && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-4">
                        {job.company.description}
                      </p>
                    )}
                    {job.company.industry && (
                      <p className="text-sm text-muted-foreground">
                        Industry: {job.company.industry}
                      </p>
                    )}
                    {job.company.size && (
                      <p className="text-sm text-muted-foreground">
                        Size: {formatCompanySize(job.company.size)}
                      </p>
                    )}
                    {job.company.headquarters && (
                      <p className="text-sm text-muted-foreground">
                        HQ: {job.company.headquarters}
                      </p>
                    )}
                    <Link
                      href={`/company/${job.company.slug}`}
                      className="text-sm text-primary hover:underline block mt-2"
                    >
                      View all jobs at {job.company.name} →
                    </Link>
                    {job.company.website && (
                      <a
                        href={job.company.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline block"
                      >
                        Visit website →
                      </a>
                    )}
                  </div>

                  <Separator />

                  {/* Source info */}
                  <div className="text-xs text-muted-foreground">
                    <p>Source: {formatSource(job.source)}</p>
                    <p>Posted: {job.postedAt.toLocaleDateString()}</p>
                    {isLinkedInPost && (
                      <p className="mt-2 italic">
                        Details extracted from LinkedIn post. Review original post before applying.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Similar Jobs Section */}
          {similarJobs.length > 0 && (
            <div className="mt-12">
              <h2 className="text-2xl font-bold mb-6">Similar {job.category.name} Jobs</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {similarJobs.map((similarJob) => (
                  <Link
                    key={similarJob.id}
                    href={`/company/${similarJob.company.slug}/jobs/${similarJob.slug}`}
                    className="block"
                  >
                    <Card className="h-full hover:shadow-md transition-shadow">
                      <CardContent className="pt-4">
                        <div className="flex gap-3">
                          <CompanyLogo
                            name={similarJob.company.name}
                            logo={similarJob.company.logo}
                            website={similarJob.company.website}
                            size="sm"
                            className="flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <h3 className="font-semibold text-sm line-clamp-2">{similarJob.title}</h3>
                            <p className="text-sm text-muted-foreground truncate">{similarJob.company.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-muted-foreground">{similarJob.location}</span>
                              {similarJob.salaryMin && (
                                <>
                                  <span className="text-xs text-muted-foreground">·</span>
                                  <span className="text-xs font-medium text-green-600">
                                    {formatSalaryCompact(similarJob.salaryMin, similarJob.salaryMax, similarJob.salaryCurrency, similarJob.salaryPeriod)}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
              <div className="mt-6 text-center">
                <Link href={`/jobs/${job.category.slug}`}>
                  <Button variant="outline">
                    View all {job.category.name} jobs →
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />

      {/* JSON-LD JobPosting Structured Data - Google Compliant */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'JobPosting',
            title: job.title,
            description: job.cleanDescription || job.originalContent || job.description,
            datePosted: job.postedAt.toISOString(),
            hiringOrganization: {
              '@type': 'Organization',
              name: job.company.name,
              sameAs: job.company.website || undefined,
              logo: job.company.logo || undefined,
              // Only include contact for PRO users to protect paywall
              ...(job.applyEmail && userPlan === 'PRO' && {
                contactPoint: {
                  '@type': 'ContactPoint',
                  email: job.applyEmail,
                  contactType: 'HR',
                },
              }),
            },
            jobLocation: ['REMOTE', 'REMOTE_US', 'REMOTE_EU'].includes(job.locationType)
              ? undefined
              : {
                  '@type': 'Place',
                  address: {
                    '@type': 'PostalAddress',
                    addressCountry: job.country || 'US',
                    addressLocality: job.location || undefined,
                  },
                },
            validThrough: new Date(job.postedAt.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            employmentType: job.type,
            experienceRequirements: getExperienceRequirements(job.level),
            ...(getOccupationalCategory(job.category.slug) && {
              occupationalCategory: getOccupationalCategory(job.category.slug),
            }),
            identifier: {
              '@type': 'PropertyValue',
              name: job.company.name,
              value: job.id,
            },
            directApply: !!(job.applyUrl || job.applyEmail),
            ...(['REMOTE', 'REMOTE_US', 'REMOTE_EU', 'REMOTE_COUNTRY'].includes(job.locationType) && {
              jobLocationType: 'TELECOMMUTE',
              applicantLocationRequirements: getApplicantLocationRequirements(job.locationType, job.country),
            }),
            ...(job.salaryMin && !job.salaryIsEstimate && getSchemaUnitText(job.salaryPeriod) && {
              baseSalary: {
                '@type': 'MonetaryAmount',
                currency: job.salaryCurrency || 'USD',
                value: {
                  '@type': 'QuantitativeValue',
                  minValue: job.salaryMin,
                  maxValue: job.salaryMax || job.salaryMin,
                  unitText: getSchemaUnitText(job.salaryPeriod),
                },
              },
            }),
            ...(job.skills.length > 0 && {
              skills: job.skills.join(', '),
            }),
            ...(job.benefits.length > 0 && {
              jobBenefits: job.benefits.join(', '),
            }),
          }),
        }}
      />

      {/* BreadcrumbList Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: siteConfig.url },
              { '@type': 'ListItem', position: 2, name: job.company.name, item: `${siteConfig.url}/company/${job.company.slug}` },
              { '@type': 'ListItem', position: 3, name: job.title, item: jobUrl },
            ],
          }),
        }}
      />
    </div>
  );
}

function formatSalary(min: number | null, max: number | null, currency: string | null): string {
  const curr = currency || 'USD';
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: curr,
    maximumFractionDigits: 0,
  });

  if (min && max) return `${formatter.format(min)} - ${formatter.format(max)}`;
  if (min) return `${formatter.format(min)}+`;
  if (max) return `Up to ${formatter.format(max)}`;
  return 'Not specified';
}

function formatLevel(level: string): string {
  const map: Record<string, string> = {
    INTERN: 'Intern',
    ENTRY: 'Entry Level',
    JUNIOR: 'Junior',
    MID: 'Mid Level',
    SENIOR: 'Senior',
    LEAD: 'Lead',
    MANAGER: 'Manager',
    DIRECTOR: 'Director',
    EXECUTIVE: 'Executive',
  };
  return map[level] || level;
}

function formatJobType(type: string): string {
  const map: Record<string, string> = {
    FULL_TIME: 'Full-time',
    PART_TIME: 'Part-time',
    CONTRACT: 'Contract',
    FREELANCE: 'Freelance',
    INTERNSHIP: 'Internship',
  };
  return map[type] || type;
}

function formatCompanySize(size: string): string {
  const map: Record<string, string> = {
    STARTUP: '1-10 employees',
    SMALL: '11-50 employees',
    MEDIUM: '51-200 employees',
    LARGE: '201-1000 employees',
    ENTERPRISE: '1000+ employees',
  };
  return map[size] || size;
}

function formatSource(source: string): string {
  const map: Record<string, string> = {
    LINKEDIN: 'LinkedIn',
    GREENHOUSE: 'Greenhouse',
    LEVER: 'Lever',
    ASHBY: 'Ashby',
    WORKABLE: 'Workable',
    MANUAL: 'Direct',
  };
  return map[source] || source;
}

// Schema.org experienceRequirements based on job level
// Using valid OccupationalExperienceRequirements format
// Note: monthsOfExperience must be positive, so we skip INTERN/ENTRY (0 months)
function getExperienceRequirements(level: string): { '@type': string; monthsOfExperience: number } | undefined {
  const map: Record<string, number> = {
    // INTERN and ENTRY have no experience requirement - don't include in schema
    JUNIOR: 12,
    MID: 24,
    SENIOR: 60,
    LEAD: 84,
    MANAGER: 60,
    DIRECTOR: 120,
    EXECUTIVE: 180,
  };
  const months = map[level];
  // Return undefined if level not found or has 0 months (Google requires positive value)
  if (!months || months <= 0) return undefined;
  return {
    '@type': 'OccupationalExperienceRequirements',
    monthsOfExperience: months,
  };
}

// Get applicantLocationRequirements for remote jobs (required by Google)
type LocationRequirement = { '@type': string; name: string };
function getApplicantLocationRequirements(
  locationType: string,
  country: string | null
): LocationRequirement | LocationRequirement[] {
  switch (locationType) {
    case 'REMOTE_US':
      return { '@type': 'Country', name: 'United States' };
    case 'REMOTE_EU':
      return [
        { '@type': 'Country', name: 'Germany' },
        { '@type': 'Country', name: 'France' },
        { '@type': 'Country', name: 'Netherlands' },
        { '@type': 'Country', name: 'United Kingdom' },
        { '@type': 'Country', name: 'Spain' },
        { '@type': 'Country', name: 'Italy' },
        { '@type': 'Country', name: 'Poland' },
        { '@type': 'Country', name: 'Portugal' },
        { '@type': 'Country', name: 'Ireland' },
        { '@type': 'Country', name: 'Austria' },
        { '@type': 'Country', name: 'Belgium' },
      ];
    case 'REMOTE_COUNTRY':
      if (country) {
        return { '@type': 'Country', name: getCountryName(country) };
      }
      // Fall through to worldwide if no country specified
      return { '@type': 'Country', name: 'Worldwide' };
    case 'REMOTE':
    default:
      // For worldwide remote jobs, use broad list of countries
      // Google accepts "Worldwide" as a valid value
      return { '@type': 'Country', name: 'Worldwide' };
  }
}

// Get SOC occupation code for Schema.org occupationalCategory
function getOccupationalCategory(categorySlug: string): string | undefined {
  const category = categories.find((c) => c.slug === categorySlug);
  if (category && 'socCode' in category && 'socTitle' in category) {
    // Format: "SOC_CODE: Title" - Google recommended format
    return `${category.socCode}: ${category.socTitle}`;
  }
  return undefined;
}

// Country code to full name for Schema.org
function getCountryName(code: string): string {
  const map: Record<string, string> = {
    US: 'United States',
    GB: 'United Kingdom',
    CA: 'Canada',
    DE: 'Germany',
    FR: 'France',
    NL: 'Netherlands',
    ES: 'Spain',
    IT: 'Italy',
    AU: 'Australia',
    IN: 'India',
    BR: 'Brazil',
    MX: 'Mexico',
    PL: 'Poland',
    PT: 'Portugal',
    IE: 'Ireland',
    SE: 'Sweden',
    CH: 'Switzerland',
    AT: 'Austria',
    BE: 'Belgium',
    DK: 'Denmark',
    NO: 'Norway',
    FI: 'Finland',
    SG: 'Singapore',
    JP: 'Japan',
    KR: 'South Korea',
    NZ: 'New Zealand',
    ZA: 'South Africa',
    IL: 'Israel',
    AE: 'United Arab Emirates',
    PH: 'Philippines',
    PK: 'Pakistan',
    RU: 'Russia',
    UA: 'Ukraine',
  };
  return map[code] || code;
}
