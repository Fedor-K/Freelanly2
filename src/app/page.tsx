import { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { CompanyLogo } from '@/components/ui/CompanyLogo';
import { SenjaWidget } from '@/components/ui/SenjaWidget';
import { categories, siteConfig } from '@/config/site';
import { prisma } from '@/lib/db';
import { getMaxJobAgeDate } from '@/lib/utils';

// ISR: Revalidate every 5 minutes for fresh stats
export const revalidate = 300;

export const metadata: Metadata = {
  alternates: {
    canonical: siteConfig.url,
  },
};

// Fetch dynamic stats and featured jobs
async function getHomePageData() {
  const maxAgeDate = getMaxJobAgeDate();

  try {
    const [jobCount, companyCount, featuredJobs, categoryStats] = await Promise.all([
      // Total active jobs
      prisma.job.count({
        where: {
          isActive: true,
          postedAt: { gte: maxAgeDate },
        },
      }),
      // Total companies with jobs
      prisma.company.count({
        where: {
          jobs: {
            some: {
              isActive: true,
              postedAt: { gte: maxAgeDate },
            },
          },
        },
      }),
      // Featured jobs (latest with salary)
      prisma.job.findMany({
        where: {
          isActive: true,
          postedAt: { gte: maxAgeDate },
          salaryMin: { gt: 10000 },
          salaryIsEstimate: false,
        },
        include: {
          company: {
            select: {
              name: true,
              slug: true,
              logo: true,
              website: true,
            },
          },
          category: {
            select: { name: true, slug: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
      // Jobs per category (top 5)
      prisma.job.groupBy({
        by: ['categoryId'],
        where: {
          isActive: true,
          postedAt: { gte: maxAgeDate },
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
    ]);

    return {
      jobCount,
      companyCount,
      featuredJobs,
      categoryStats,
    };
  } catch (error) {
    console.error('Failed to fetch homepage data:', error);
    return {
      jobCount: 1000,
      companyCount: 500,
      featuredJobs: [],
      categoryStats: [],
    };
  }
}

// Map invalid/symbol currency codes to valid ISO 4217 codes
const CURRENCY_CODE_MAP: Record<string, string> = {
  'RM': 'MYR', 'Rs': 'INR', 'Rs.': 'INR', '₹': 'INR', '₱': 'PHP',
  'R$': 'BRL', '¥': 'JPY', '€': 'EUR', '£': 'GBP', '$': 'USD',
  'zł': 'PLN', 'kr': 'SEK',
};

function normalizeCurrencyCode(code: string | null): string {
  if (!code) return 'USD';
  const upper = code.toUpperCase();
  if (/^[A-Z]{3}$/.test(upper)) return upper;
  return CURRENCY_CODE_MAP[code] || CURRENCY_CODE_MAP[upper] || 'USD';
}

function formatSalaryCompact(min: number, max: number | null, currency: string | null): string {
  const curr = normalizeCurrencyCode(currency);
  let formatter: Intl.NumberFormat;
  try {
    formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: curr,
      maximumFractionDigits: 0,
      notation: 'compact',
    });
  } catch {
    formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
      notation: 'compact',
    });
  }

  if (max) {
    return `${formatter.format(min)}-${formatter.format(max)}/yr`;
  }
  return `${formatter.format(min)}+/yr`;
}

export default async function Home() {
  const { jobCount, companyCount, featuredJobs } = await getHomePageData();

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="container py-24 text-center">
          <Badge className="mb-4" variant="secondary">
            🔥 {jobCount.toLocaleString()}+ jobs · Updated every few hours
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Get Hired Faster with
            <br />
            <span className="text-primary">Jobs Others Miss</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-4">
            We surface hiring posts from LinkedIn and company career pages
            before they hit crowded job boards. Be first, not 500th.
          </p>
          <p className="text-sm text-muted-foreground mb-8">
            ✓ Direct contact info &nbsp; ✓ No recruiter spam &nbsp; ✓ Apply in seconds
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link href="/jobs">Browse {jobCount.toLocaleString()}+ Jobs</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/pricing">Unlock Full Access</Link>
            </Button>
          </div>

          {/* Stats */}
          <div className="flex justify-center gap-8 mt-12">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{jobCount.toLocaleString()}+</div>
              <div className="text-sm text-muted-foreground">Remote Jobs</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{companyCount.toLocaleString()}+</div>
              <div className="text-sm text-muted-foreground">Companies Hiring</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">24h</div>
              <div className="text-sm text-muted-foreground">Avg. Faster Access</div>
            </div>
          </div>
        </section>

        {/* Social proof badges - under hero */}
        <section className="container pb-16 flex justify-center">
          <SenjaWidget widgetId="24bc3a5c-2627-4524-a823-e03915f222e5" />
        </section>

        {/* Featured Jobs */}
        {featuredJobs.length > 0 && (
          <section className="container py-16 border-t">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-bold">Fresh Jobs — Added Today</h2>
                <p className="text-sm text-muted-foreground">Apply before everyone else does</p>
              </div>
              <Link href="/jobs" className="text-primary hover:underline">
                View all {jobCount.toLocaleString()}+ jobs →
              </Link>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {featuredJobs.map((job) => (
                <Link key={job.id} href={`/company/${job.company.slug}/jobs/${job.slug}`}>
                  <Card className="h-full hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex gap-3">
                        <CompanyLogo
                          name={job.company.name}
                          logo={job.company.logo}
                          website={job.company.website}
                          size="sm"
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold line-clamp-1">{job.title}</h3>
                          <p className="text-sm text-muted-foreground">{job.company.name}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="secondary" className="text-xs">
                              {job.category.name}
                            </Badge>
                            {job.salaryMin && (
                              <span className="text-xs text-green-600 font-medium">
                                {formatSalaryCompact(job.salaryMin, job.salaryMax, job.salaryCurrency)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Categories */}
        <section className="container py-16 border-t">
          <h2 className="text-2xl font-bold mb-8 text-center">
            Browse by Category
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {categories.map((category) => (
              <Link
                key={category.slug}
                href={`/jobs/${category.slug}`}
                className="flex flex-col items-center p-6 rounded-lg border hover:border-primary hover:shadow-md transition-all"
              >
                <span className="text-3xl mb-2">{category.icon}</span>
                <span className="font-medium">{category.name}</span>
                <span className="text-sm text-muted-foreground">View jobs</span>
              </Link>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="container py-16 border-t">
          <h2 className="text-2xl font-bold mb-2 text-center">
            Why Job Boards Don't Work Anymore
          </h2>
          <p className="text-center text-muted-foreground mb-8 max-w-xl mx-auto">
            By the time jobs hit Indeed or LinkedIn Jobs, 500 people have already applied.
            We help you get there first.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                1
              </div>
              <h3 className="font-semibold mb-2">We Find Hidden Jobs</h3>
              <p className="text-muted-foreground">
                Hiring managers post on LinkedIn before HR lists it officially. We catch these posts within hours.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                2
              </div>
              <h3 className="font-semibold mb-2">You Get Direct Access</h3>
              <p className="text-muted-foreground">
                No ATS black holes. Get the hiring manager's email or LinkedIn and reach out directly.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                3
              </div>
              <h3 className="font-semibold mb-2">Apply Before the Crowd</h3>
              <p className="text-muted-foreground">
                First applicants get 8x more interviews. Be early, skip the competition.
              </p>
            </div>
          </div>
        </section>

        {/* Social proof - Senja testimonials */}
        <section className="container py-16 border-t">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-4 text-center">Trusted by Remote Professionals</h2>
            <p className="text-muted-foreground mb-8 text-center">
              We've helped thousands of developers, designers, and marketers land remote jobs
              at companies like Shopify, GitLab, Automattic, and fast-growing startups.
            </p>
            <SenjaWidget />
          </div>
        </section>

        {/* CTA */}
        <section className="container py-16">
          <div className="bg-primary text-primary-foreground rounded-2xl p-12 text-center">
            <h2 className="text-3xl font-bold mb-4">
              Stop Competing. Start Getting Interviews.
            </h2>
            <p className="text-lg opacity-90 mb-8 max-w-xl mx-auto">
              New jobs are added every few hours. The best ones get filled within days.
              Don't wait — start applying now.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" variant="secondary" asChild>
                <Link href="/jobs">Browse Jobs Free</Link>
              </Button>
              <Button size="lg" variant="outline" className="bg-transparent border-white/30 hover:bg-white/10" asChild>
                <Link href="/pricing">Get Full Access →</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
