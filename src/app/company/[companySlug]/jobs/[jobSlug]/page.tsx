import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { SalaryInsights, SalaryMarketData } from '@/components/jobs/SalaryInsights';
import { ApplyButton } from '@/components/jobs/ApplyButton';
import { formatDistanceToNow } from '@/lib/utils';
import { siteConfig } from '@/config/site';
import { prisma } from '@/lib/db';
import { getSalaryInsights } from '@/services/salary-insights';

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
  const job = await prisma.job.findUnique({
    where: { slug: jobSlug },
    include: {
      company: true,
      category: true,
    },
  });
  return job;
}

export async function generateMetadata({ params }: JobPageProps): Promise<Metadata> {
  const { companySlug, jobSlug } = await params;
  const job = await getJob(jobSlug);

  if (!job) {
    return { title: 'Job Not Found' };
  }

  const jobUrl = buildJobUrl(job.company.slug, job.slug);
  const salaryText = job.salaryMin && job.salaryMax
    ? ` $${(job.salaryMin/1000).toFixed(0)}K-$${(job.salaryMax/1000).toFixed(0)}K.`
    : '';
  const description = `${job.title} at ${job.company.name}. ${job.location}.${salaryText} Apply now and join a top remote team!`;

  return {
    title: `${job.title} at ${job.company.name} - Remote ${job.category.name} Job`,
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
    },
    twitter: {
      card: 'summary_large_image',
      title: `${job.title} at ${job.company.name}`,
      description,
    },
    alternates: {
      canonical: jobUrl,
    },
  };
}

export default async function JobPage({ params }: JobPageProps) {
  const { companySlug, jobSlug } = await params;
  const job = await getJob(jobSlug);

  if (!job) {
    notFound();
  }

  const isLinkedInPost = job.sourceType === 'UNSTRUCTURED';
  const jobUrl = buildJobUrl(job.company.slug, job.slug);

  // Fetch salary market data
  let salaryMarketData: SalaryMarketData | null = null;
  try {
    const salaryData = await getSalaryInsights(
      job.title,
      job.location,
      job.country,
      job.categoryId
    );
    if (salaryData) {
      salaryMarketData = {
        avgSalary: salaryData.avgSalary,
        minSalary: salaryData.minSalary,
        maxSalary: salaryData.maxSalary,
        medianSalary: salaryData.medianSalary,
        percentile25: salaryData.percentile25,
        percentile75: salaryData.percentile75,
        sampleSize: salaryData.sampleSize,
        source: salaryData.source,
        sourceLabel: salaryData.sourceLabel,
        isEstimate: salaryData.isEstimate,
      };
    }
  } catch (error) {
    console.error('[JobPage] Error fetching salary insights:', error);
  }

  return (
    <div className="flex min-h-screen flex-col">
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
                {job.company.logo ? (
                  <img
                    src={job.company.logo}
                    alt={job.company.name}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center text-2xl font-bold">
                    {job.company.name.charAt(0)}
                  </div>
                )}
                <div>
                  <h1 className="text-2xl font-bold">{job.title}</h1>
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
                          <p className="font-medium">{job.applyEmail || 'DM on LinkedIn'}</p>
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
                    </CardContent>
                  </Card>

                  {/* Original Post */}
                  <Card className="border-blue-200 bg-blue-50/50">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        💬 Original LinkedIn Post
                      </CardTitle>
                      {job.authorName && (
                        <p className="text-sm text-muted-foreground">
                          Posted by {job.authorName}
                        </p>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="bg-white rounded-lg p-4 border whitespace-pre-wrap break-words text-sm overflow-hidden">
                        {job.originalContent}
                      </div>
                      <div className="mt-4 flex gap-2">
                        {job.sourceUrl && (
                          <Button variant="outline" size="sm" asChild>
                            <a href={job.sourceUrl} target="_blank" rel="noopener noreferrer">
                              View on LinkedIn
                            </a>
                          </Button>
                        )}
                        {job.authorLinkedIn && (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={job.authorLinkedIn} target="_blank" rel="noopener noreferrer">
                              View Author Profile
                            </a>
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                /* Standard Job Description for ATS jobs */
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Job Description</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                      {job.description}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Salary Insights */}
              <SalaryInsights
                jobTitle={job.title}
                location={job.location || 'Remote'}
                salaryMin={job.salaryMin}
                salaryMax={job.salaryMax}
                currency={job.salaryCurrency || 'USD'}
                isEstimate={job.salaryIsEstimate}
                marketData={salaryMarketData}
              />

              {/* Apply Card */}
              <Card className="sticky top-20">
                <CardContent className="pt-6 space-y-4">
                  <ApplyButton
                    applyUrl={job.applyUrl}
                    applyEmail={job.applyEmail}
                    sourceUrl={job.sourceUrl}
                    jobTitle={job.title}
                    companyName={job.company.name}
                    jobDescription={job.description}
                  />
                  <Button variant="outline" className="w-full">
                    Save Job
                  </Button>

                  <Separator />

                  {/* Company Info */}
                  <div>
                    <h3 className="font-semibold mb-3">About {job.company.name}</h3>
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
            description: job.originalContent || job.description,
            datePosted: job.postedAt.toISOString(),
            hiringOrganization: {
              '@type': 'Organization',
              name: job.company.name,
              sameAs: job.company.website || undefined,
              logo: job.company.logo || undefined,
            },
            jobLocation: ['REMOTE', 'REMOTE_US', 'REMOTE_EU'].includes(job.locationType)
              ? undefined
              : {
                  '@type': 'Place',
                  address: {
                    '@type': 'PostalAddress',
                    addressCountry: 'US',
                    addressLocality: job.location || undefined,
                  },
                },
            validThrough: new Date(job.postedAt.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            employmentType: job.type,
            identifier: {
              '@type': 'PropertyValue',
              name: job.company.name,
              value: job.id,
            },
            directApply: !!(job.applyUrl || job.applyEmail),
            ...(['REMOTE', 'REMOTE_US', 'REMOTE_EU'].includes(job.locationType) && {
              jobLocationType: 'TELECOMMUTE',
              applicantLocationRequirements: job.locationType === 'REMOTE_US'
                ? { '@type': 'Country', name: 'USA' }
                : job.locationType === 'REMOTE_EU'
                ? [
                    { '@type': 'Country', name: 'Germany' },
                    { '@type': 'Country', name: 'France' },
                    { '@type': 'Country', name: 'Netherlands' },
                    { '@type': 'Country', name: 'United Kingdom' },
                  ]
                : undefined,
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
