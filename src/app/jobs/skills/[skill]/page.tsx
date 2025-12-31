import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { JobCard } from '@/components/jobs/JobCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { siteConfig, categories } from '@/config/site';
import { skills, getSkillBySlug, getSkillsByCategory, featuredSkills } from '@/config/skills';
import { getSkillContent, getSkillFAQs } from '@/config/skill-content';
import { salaryRanges } from '@/config/salary-ranges';
import { truncateTitle } from '@/lib/seo';
import { prisma } from '@/lib/db';
import { getMaxJobAgeDate } from '@/lib/utils';
import { Prisma } from '@prisma/client';

// ISR: Revalidate every hour
export const revalidate = 3600;

interface SkillPageProps {
  params: Promise<{ skill: string }>;
  searchParams: Promise<{ page?: string }>;
}

// Generate static params for all skills
export async function generateStaticParams() {
  return skills.map((skill) => ({
    skill: skill.slug,
  }));
}

// Generate metadata
export async function generateMetadata({ params, searchParams }: SkillPageProps): Promise<Metadata> {
  const { skill: skillSlug } = await params;
  const { page } = await searchParams;

  const skill = getSkillBySlug(skillSlug);

  if (!skill) {
    return {
      title: 'Skill Not Found',
      robots: { index: false, follow: true },
    };
  }

  const pageNum = parseInt(page || '1', 10);

  // Title max 60 chars
  const seoTitle = truncateTitle(`Remote ${skill.name} Jobs - Work From Home`);

  // Description 150-160 chars
  const description = `Find remote ${skill.name} jobs and work from home positions. Browse ${skill.name} opportunities at top companies hiring remotely. Updated daily.`;

  // Noindex pagination
  const shouldNoindex = pageNum > 1;

  return {
    title: seoTitle,
    description,
    keywords: [
      `remote ${skill.name.toLowerCase()} jobs`,
      `${skill.name.toLowerCase()} remote work`,
      `work from home ${skill.name.toLowerCase()}`,
      `${skill.name.toLowerCase()} developer jobs`,
      ...skill.aliases.map((a) => `${a} jobs`),
    ],
    openGraph: {
      title: seoTitle,
      description,
      url: `${siteConfig.url}/jobs/skills/${skill.slug}`,
      type: 'website',
      siteName: siteConfig.name,
    },
    twitter: {
      card: 'summary_large_image',
      title: seoTitle,
      description,
    },
    alternates: {
      canonical: `${siteConfig.url}/jobs/skills/${skill.slug}`,
    },
    ...(shouldNoindex && {
      robots: {
        index: false,
        follow: true,
      },
    }),
  };
}

export default async function SkillPage({ params, searchParams }: SkillPageProps) {
  const { skill: skillSlug } = await params;
  const { page = '1' } = await searchParams;

  const skill = getSkillBySlug(skillSlug);

  if (!skill) {
    notFound();
  }

  const currentPage = parseInt(page, 10) || 1;
  const perPage = 20;

  // Build search terms from skill name and aliases
  const searchTerms = [skill.name.toLowerCase(), ...skill.aliases.map((a) => a.toLowerCase())];

  // Build WHERE clause to search in title and description
  const maxAgeDate = getMaxJobAgeDate();

  // Fetch jobs matching the skill
  let jobs: any[] = [];
  let totalJobs = 0;
  let avgSalary = 0;
  let topCompanies: { name: string; slug: string }[] = [];
  let categoryBreakdown: { category: string; count: number }[] = [];

  try {
    // Search jobs by skill in title or description
    const searchPattern = searchTerms.join('|');

    // Build OR conditions for skill name and aliases
    const searchConditions: Prisma.JobWhereInput[] = [
      { title: { contains: skill.name, mode: 'insensitive' as Prisma.QueryMode } },
      { description: { contains: skill.name, mode: 'insensitive' as Prisma.QueryMode } },
    ];

    // Add alias conditions
    for (const alias of skill.aliases) {
      searchConditions.push({ title: { contains: alias, mode: 'insensitive' as Prisma.QueryMode } });
      searchConditions.push({ description: { contains: alias, mode: 'insensitive' as Prisma.QueryMode } });
    }

    const whereClause: Prisma.JobWhereInput = {
      isActive: true,
      postedAt: { gte: maxAgeDate },
      OR: searchConditions,
    };

    const [jobsResult, countResult] = await Promise.all([
      prisma.job.findMany({
        where: whereClause,
        include: {
          company: {
            select: { name: true, slug: true, logo: true, website: true },
          },
          category: {
            select: { name: true, slug: true },
          },
        },
        orderBy: { postedAt: 'desc' },
        skip: (currentPage - 1) * perPage,
        take: perPage,
      }),
      prisma.job.count({ where: whereClause }),
    ]);

    jobs = jobsResult;
    totalJobs = countResult;

    // Simple search for salary and companies (just skill name, no aliases)
    const simpleSearch: Prisma.JobWhereInput[] = [
      { title: { contains: skill.name, mode: 'insensitive' as Prisma.QueryMode } },
      { description: { contains: skill.name, mode: 'insensitive' as Prisma.QueryMode } },
    ];

    // Get salary stats
    const salaryResult = await prisma.job.aggregate({
      where: {
        isActive: true,
        salaryMin: { gt: 10000 },
        salaryIsEstimate: false,
        OR: simpleSearch,
      },
      _avg: { salaryMin: true, salaryMax: true },
    });

    if (salaryResult._avg.salaryMin && salaryResult._avg.salaryMax) {
      avgSalary = Math.round((salaryResult._avg.salaryMin + salaryResult._avg.salaryMax) / 2);
    }

    // Get top companies
    const companiesResult = await prisma.job.groupBy({
      by: ['companyId'],
      where: {
        isActive: true,
        OR: simpleSearch,
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    if (companiesResult.length > 0) {
      const companyIds = companiesResult.map((c) => c.companyId);
      const companiesData = await prisma.company.findMany({
        where: { id: { in: companyIds } },
        select: { name: true, slug: true },
      });
      topCompanies = companiesData;
    }
  } catch (error) {
    console.error('Failed to fetch jobs:', error);
  }

  const totalPages = Math.ceil(totalJobs / perPage);

  // Get content
  const skillContent = getSkillContent(skill);
  const faqs = getSkillFAQs(skill, totalJobs);

  // Thin content check
  const shouldNoindex = totalJobs < 3;

  // Related skills
  const relatedSkills = getSkillsByCategory(skill.category)
    .filter((s) => s.slug !== skill.slug)
    .slice(0, 6);

  // Structured Data
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: siteConfig.url },
          { '@type': 'ListItem', position: 2, name: 'Jobs', item: `${siteConfig.url}/jobs` },
          { '@type': 'ListItem', position: 3, name: 'Skills', item: `${siteConfig.url}/jobs/skills` },
          { '@type': 'ListItem', position: 4, name: skill.name, item: `${siteConfig.url}/jobs/skills/${skill.slug}` },
        ],
      },
      {
        '@type': 'ItemList',
        name: `Remote ${skill.name} Jobs`,
        numberOfItems: totalJobs,
        itemListElement: jobs.map((job, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          url: `${siteConfig.url}/company/${job.company.slug}/jobs/${job.slug}`,
          name: job.title,
        })),
      },
      {
        '@type': 'FAQPage',
        mainEntity: faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
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
              <li><Link href="/" className="hover:text-foreground">Home</Link></li>
              <li>/</li>
              <li><Link href="/jobs" className="hover:text-foreground">Jobs</Link></li>
              <li>/</li>
              <li><Link href="/jobs" className="hover:text-foreground">Skills</Link></li>
              <li>/</li>
              <li className="text-foreground font-medium">{skill.icon} {skill.name}</li>
            </ol>
          </nav>

          {/* Page Header */}
          <header className="mb-8">
            <h1 className="text-3xl font-bold mb-2">
              {skill.icon} Remote {skill.name} Jobs
            </h1>
            <p className="text-muted-foreground text-lg">
              {totalJobs > 0
                ? `${totalJobs} remote ${skill.name} positions available`
                : `Browse remote ${skill.name} opportunities`}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {skill.description}
            </p>
          </header>

          <div className="flex gap-8">
            {/* Sidebar */}
            <aside className="hidden lg:block w-64 flex-shrink-0">
              <div className="sticky top-20 space-y-6">
                {/* Related Skills */}
                <div>
                  <h2 className="text-sm font-medium mb-2">Related Skills</h2>
                  <div className="space-y-1">
                    {relatedSkills.map((s) => (
                      <Link
                        key={s.slug}
                        href={`/jobs/skills/${s.slug}`}
                        className="block px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                      >
                        {s.icon} {s.name}
                      </Link>
                    ))}
                  </div>
                </div>

                {/* By Salary */}
                <div>
                  <h2 className="text-sm font-medium mb-2">By Salary Range</h2>
                  <div className="space-y-1">
                    {salaryRanges.map((range) => (
                      <Link
                        key={range.slug}
                        href={`/jobs/engineering/salary/${range.slug}`}
                        className="block px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                      >
                        {range.label}
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Popular Skills */}
                <div>
                  <h2 className="text-sm font-medium mb-2">Popular Skills</h2>
                  <div className="space-y-1">
                    {skills
                      .filter((s) => featuredSkills.includes(s.slug) && s.slug !== skill.slug)
                      .slice(0, 6)
                      .map((s) => (
                        <Link
                          key={s.slug}
                          href={`/jobs/skills/${s.slug}`}
                          className="block px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                        >
                          {s.icon} {s.name}
                        </Link>
                      ))}
                  </div>
                </div>

                {/* Top Companies */}
                {topCompanies.length > 0 && (
                  <div>
                    <h2 className="text-sm font-medium mb-2">Top Companies Hiring</h2>
                    <div className="space-y-1">
                      {topCompanies.map((company) => (
                        <Link
                          key={company.slug}
                          href={`/company/${company.slug}`}
                          className="block px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                        >
                          {company.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </aside>

            {/* Job List */}
            <div className="flex-1">
              {/* Active Filters */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <Badge>{skill.icon} {skill.name}</Badge>
                <Badge variant="outline">{skill.category}</Badge>
                <Link href="/jobs">
                  <Button variant="ghost" size="sm" className="text-xs">
                    Clear filter
                  </Button>
                </Link>
              </div>

              {/* Jobs */}
              {jobs.length > 0 ? (
                <div className="space-y-4">
                  {jobs.map((job) => (
                    <JobCard key={job.id} job={job} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 border rounded-lg bg-muted/30">
                  <p className="text-muted-foreground mb-4">
                    No {skill.name} jobs at the moment.
                  </p>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Try related skills:</p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      <Link href="/jobs">
                        <Button variant="outline" size="sm">All Jobs</Button>
                      </Link>
                      {relatedSkills.slice(0, 3).map((s) => (
                        <Link key={s.slug} href={`/jobs/skills/${s.slug}`}>
                          <Button variant="outline" size="sm">{s.icon} {s.name}</Button>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <nav className="mt-8 flex justify-center gap-2" aria-label="Pagination">
                  {currentPage > 1 && (
                    <Link href={`/jobs/skills/${skill.slug}?page=${currentPage - 1}`}>
                      <Button variant="outline">Previous</Button>
                    </Link>
                  )}
                  <span className="flex items-center px-4 text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  {currentPage < totalPages && (
                    <Link href={`/jobs/skills/${skill.slug}?page=${currentPage + 1}`}>
                      <Button variant="outline">Next</Button>
                    </Link>
                  )}
                </nav>
              )}
            </div>
          </div>

          {/* SEO Content Section */}
          <section className="mt-12 border-t pt-8">
            <div className="max-w-4xl">
              <h2 className="text-2xl font-bold mb-4">
                About Remote {skill.name} Jobs
              </h2>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                {skillContent.intro}
              </p>

              <div className="grid md:grid-cols-2 gap-8 mb-8">
                {/* Why Remote */}
                <div>
                  <h3 className="font-semibold mb-3">Why {skill.name} for Remote Work?</h3>
                  <p className="text-sm text-muted-foreground">
                    {skillContent.whyRemote}
                  </p>
                </div>

                {/* Salary Expectations */}
                <div>
                  <h3 className="font-semibold mb-3">Salary Expectations</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li><span className="font-medium">Entry Level:</span> {skillContent.avgSalary.entry}</li>
                    <li><span className="font-medium">Mid Level:</span> {skillContent.avgSalary.mid}</li>
                    <li><span className="font-medium">Senior Level:</span> {skillContent.avgSalary.senior}</li>
                  </ul>
                </div>
              </div>

              {/* Career Path */}
              <div className="bg-muted/30 rounded-lg p-6 mb-8">
                <h3 className="font-semibold mb-3">Career Path</h3>
                <div className="flex flex-wrap gap-2">
                  {skillContent.careerPath.map((role, i) => (
                    <span key={i} className="inline-flex items-center">
                      <Badge variant="outline">{role}</Badge>
                      {i < skillContent.careerPath.length - 1 && (
                        <span className="mx-2 text-muted-foreground">→</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>

              {/* FAQs */}
              <div>
                <h3 className="font-semibold mb-4">Frequently Asked Questions</h3>
                <div className="space-y-4">
                  {faqs.map((faq, i) => (
                    <details key={i} className="group border rounded-lg">
                      <summary className="flex cursor-pointer items-center justify-between p-4 font-medium">
                        {faq.question}
                        <span className="transition group-open:rotate-180">
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </span>
                      </summary>
                      <p className="px-4 pb-4 text-muted-foreground">{faq.answer}</p>
                    </details>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Internal Links */}
          <section className="mt-8 border-t pt-8">
            <h2 className="text-lg font-semibold mb-4">Browse More Skills</h2>
            <div className="grid md:grid-cols-4 gap-6">
              <div>
                <h3 className="text-sm font-medium mb-2">Languages</h3>
                <div className="space-y-1">
                  {getSkillsByCategory('language').slice(0, 5).map((s) => (
                    <Link
                      key={s.slug}
                      href={`/jobs/skills/${s.slug}`}
                      className="block text-sm text-muted-foreground hover:text-foreground"
                    >
                      {s.icon} {s.name}
                    </Link>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-2">Frameworks</h3>
                <div className="space-y-1">
                  {getSkillsByCategory('framework').slice(0, 5).map((s) => (
                    <Link
                      key={s.slug}
                      href={`/jobs/skills/${s.slug}`}
                      className="block text-sm text-muted-foreground hover:text-foreground"
                    >
                      {s.icon} {s.name}
                    </Link>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-2">DevOps & Cloud</h3>
                <div className="space-y-1">
                  {[...getSkillsByCategory('devops'), ...getSkillsByCategory('cloud')].slice(0, 5).map((s) => (
                    <Link
                      key={s.slug}
                      href={`/jobs/skills/${s.slug}`}
                      className="block text-sm text-muted-foreground hover:text-foreground"
                    >
                      {s.icon} {s.name}
                    </Link>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-2">Data & ML</h3>
                <div className="space-y-1">
                  {getSkillsByCategory('data').slice(0, 5).map((s) => (
                    <Link
                      key={s.slug}
                      href={`/jobs/skills/${s.slug}`}
                      className="block text-sm text-muted-foreground hover:text-foreground"
                    >
                      {s.icon} {s.name}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      <Footer />

      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* Noindex if thin content */}
      {shouldNoindex && (
        <meta name="robots" content="noindex, follow" />
      )}
    </div>
  );
}
