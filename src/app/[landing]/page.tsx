import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { JobCard } from '@/components/jobs/JobCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { siteConfig, categories, levels } from '@/config/site';
import { prisma } from '@/lib/db';
import { getMaxJobAgeDate } from '@/lib/utils';

interface LandingPageProps {
  params: Promise<{ landing: string }>;
  searchParams: Promise<{ page?: string }>;
}

// SEO landing page configuration
const skillKeywords: Record<string, { title: string; skills: string[]; relatedCategories: string[] }> = {
  'react': { title: 'React', skills: ['React', 'React.js', 'ReactJS'], relatedCategories: ['engineering', 'frontend'] },
  'typescript': { title: 'TypeScript', skills: ['TypeScript', 'TS'], relatedCategories: ['engineering', 'frontend', 'backend'] },
  'python': { title: 'Python', skills: ['Python', 'Python3'], relatedCategories: ['engineering', 'data', 'backend'] },
  'javascript': { title: 'JavaScript', skills: ['JavaScript', 'JS', 'ES6'], relatedCategories: ['engineering', 'frontend'] },
  'nodejs': { title: 'Node.js', skills: ['Node.js', 'NodeJS', 'Node'], relatedCategories: ['engineering', 'backend'] },
  'java': { title: 'Java', skills: ['Java'], relatedCategories: ['engineering', 'backend'] },
  'golang': { title: 'Golang', skills: ['Go', 'Golang'], relatedCategories: ['engineering', 'backend'] },
  'rust': { title: 'Rust', skills: ['Rust'], relatedCategories: ['engineering'] },
  'aws': { title: 'AWS', skills: ['AWS', 'Amazon Web Services'], relatedCategories: ['devops', 'engineering'] },
  'kubernetes': { title: 'Kubernetes', skills: ['Kubernetes', 'K8s'], relatedCategories: ['devops'] },
  'docker': { title: 'Docker', skills: ['Docker'], relatedCategories: ['devops'] },
  'terraform': { title: 'Terraform', skills: ['Terraform'], relatedCategories: ['devops'] },
  'graphql': { title: 'GraphQL', skills: ['GraphQL'], relatedCategories: ['engineering', 'backend'] },
  'nextjs': { title: 'Next.js', skills: ['Next.js', 'NextJS', 'Next'], relatedCategories: ['engineering', 'frontend'] },
  'vue': { title: 'Vue.js', skills: ['Vue', 'Vue.js', 'VueJS'], relatedCategories: ['engineering', 'frontend'] },
  'angular': { title: 'Angular', skills: ['Angular', 'AngularJS'], relatedCategories: ['engineering', 'frontend'] },
  'flutter': { title: 'Flutter', skills: ['Flutter'], relatedCategories: ['engineering', 'mobile'] },
  'swift': { title: 'Swift', skills: ['Swift'], relatedCategories: ['engineering', 'mobile'] },
  'kotlin': { title: 'Kotlin', skills: ['Kotlin'], relatedCategories: ['engineering', 'mobile'] },
  'ruby': { title: 'Ruby', skills: ['Ruby'], relatedCategories: ['engineering', 'backend'] },
  'rails': { title: 'Ruby on Rails', skills: ['Rails', 'Ruby on Rails'], relatedCategories: ['engineering', 'backend'] },
  'django': { title: 'Django', skills: ['Django'], relatedCategories: ['engineering', 'backend'] },
  'laravel': { title: 'Laravel', skills: ['Laravel'], relatedCategories: ['engineering', 'backend'] },
  'postgresql': { title: 'PostgreSQL', skills: ['PostgreSQL', 'Postgres'], relatedCategories: ['engineering', 'data'] },
  'mongodb': { title: 'MongoDB', skills: ['MongoDB', 'Mongo'], relatedCategories: ['engineering', 'data'] },
  'redis': { title: 'Redis', skills: ['Redis'], relatedCategories: ['engineering', 'backend'] },
  'elasticsearch': { title: 'Elasticsearch', skills: ['Elasticsearch', 'Elastic'], relatedCategories: ['engineering', 'data'] },
  'kafka': { title: 'Kafka', skills: ['Kafka', 'Apache Kafka'], relatedCategories: ['engineering', 'data'] },
  'spark': { title: 'Spark', skills: ['Spark', 'Apache Spark', 'PySpark'], relatedCategories: ['data', 'engineering'] },
  'machine-learning': { title: 'Machine Learning', skills: ['Machine Learning', 'ML'], relatedCategories: ['data', 'engineering'] },
  'data-science': { title: 'Data Science', skills: ['Data Science', 'Data Scientist'], relatedCategories: ['data'] },
  'devops': { title: 'DevOps', skills: ['DevOps'], relatedCategories: ['devops'] },
  'sre': { title: 'SRE', skills: ['SRE', 'Site Reliability'], relatedCategories: ['devops'] },
  'cloud': { title: 'Cloud', skills: ['Cloud', 'AWS', 'GCP', 'Azure'], relatedCategories: ['devops'] },
  'security': { title: 'Security', skills: ['Security', 'Cybersecurity', 'InfoSec'], relatedCategories: ['engineering'] },
  'frontend': { title: 'Frontend', skills: ['Frontend', 'Front-end', 'Front End'], relatedCategories: ['engineering', 'frontend'] },
  'backend': { title: 'Backend', skills: ['Backend', 'Back-end', 'Back End'], relatedCategories: ['engineering', 'backend'] },
  'fullstack': { title: 'Full Stack', skills: ['Full Stack', 'Fullstack', 'Full-Stack'], relatedCategories: ['engineering'] },
  'mobile': { title: 'Mobile', skills: ['Mobile', 'iOS', 'Android'], relatedCategories: ['engineering', 'mobile'] },
  'product-manager': { title: 'Product Manager', skills: ['Product Manager', 'PM'], relatedCategories: ['product'] },
  'product-designer': { title: 'Product Designer', skills: ['Product Designer'], relatedCategories: ['design'] },
  'ui-ux': { title: 'UI/UX', skills: ['UI', 'UX', 'UI/UX'], relatedCategories: ['design'] },
  'figma': { title: 'Figma', skills: ['Figma'], relatedCategories: ['design'] },
};

const locationKeywords: Record<string, { title: string; country?: string }> = {
  'usa': { title: 'USA', country: 'US' },
  'europe': { title: 'Europe' },
  'uk': { title: 'UK', country: 'GB' },
  'germany': { title: 'Germany', country: 'DE' },
  'canada': { title: 'Canada', country: 'CA' },
  'australia': { title: 'Australia', country: 'AU' },
  'worldwide': { title: 'Worldwide' },
};

function parseLandingSlug(slug: string): { skill?: string; location?: string } | null {
  // Pattern: remote-{skill}-jobs or remote-{skill}-jobs-{location}
  const match = slug.match(/^remote-(.+)-jobs(?:-(.+))?$/);
  if (!match) return null;

  const skillPart = match[1];
  const locationPart = match[2];

  // Check if skill exists
  if (!skillKeywords[skillPart] && !categories.find(c => c.slug === skillPart)) {
    return null;
  }

  // Check if location exists (if provided)
  if (locationPart && !locationKeywords[locationPart]) {
    return null;
  }

  return {
    skill: skillPart,
    location: locationPart,
  };
}

// Skills list matching sitemap.ts for consistency
const popularSkills = [
  'react', 'typescript', 'python', 'javascript', 'nodejs',
  'java', 'golang', 'rust', 'aws', 'kubernetes',
  'docker', 'terraform', 'graphql', 'nextjs', 'vue',
  'angular', 'flutter', 'swift', 'kotlin', 'ruby',
  'rails', 'django', 'laravel', 'postgresql', 'mongodb',
  'redis', 'elasticsearch', 'kafka', 'spark', 'machine-learning',
  'data-science', 'devops', 'sre', 'cloud', 'security',
];

// Generate static params for popular combinations
export async function generateStaticParams() {
  const params: { landing: string }[] = [];

  // Skill-only pages (all skills in skillKeywords)
  for (const skill of Object.keys(skillKeywords)) {
    params.push({ landing: `remote-${skill}-jobs` });
  }

  // Category pages
  for (const cat of categories) {
    params.push({ landing: `remote-${cat.slug}-jobs` });
  }

  // Skill + Location combinations (all popularSkills to match sitemap)
  for (const skill of popularSkills) {
    for (const location of Object.keys(locationKeywords)) {
      params.push({ landing: `remote-${skill}-jobs-${location}` });
    }
  }

  return params;
}

export async function generateMetadata({ params }: LandingPageProps): Promise<Metadata> {
  const { landing } = await params;
  const parsed = parseLandingSlug(landing);

  if (!parsed) {
    return { title: 'Not Found' };
  }

  const skillConfig = skillKeywords[parsed.skill!] || { title: parsed.skill };
  const locationConfig = parsed.location ? locationKeywords[parsed.location] : null;

  const skillTitle = typeof skillConfig === 'object' ? skillConfig.title : parsed.skill;
  const locationTitle = locationConfig?.title;

  const title = locationTitle
    ? `Remote ${skillTitle} Jobs in ${locationTitle} - Work From Home ${skillTitle} Positions`
    : `Remote ${skillTitle} Jobs - Work From Home ${skillTitle} Developer Positions`;

  const description = locationTitle
    ? `Find remote ${skillTitle?.toLowerCase()} jobs in ${locationTitle}. Browse ${skillTitle?.toLowerCase()} work from home positions for ${locationTitle} residents. Apply to top companies hiring remotely.`
    : `Find remote ${skillTitle?.toLowerCase()} jobs worldwide. Browse work from home ${skillTitle?.toLowerCase()} developer positions at top companies. Updated daily.`;

  return {
    title,
    description,
    keywords: [
      `remote ${skillTitle?.toLowerCase()} jobs`,
      `${skillTitle?.toLowerCase()} work from home`,
      `${skillTitle?.toLowerCase()} remote developer`,
      locationTitle ? `${skillTitle?.toLowerCase()} jobs ${locationTitle}` : `${skillTitle?.toLowerCase()} jobs worldwide`,
    ],
    openGraph: {
      title,
      description,
      url: `${siteConfig.url}/${landing}`,
      type: 'website',
    },
    alternates: {
      canonical: `${siteConfig.url}/${landing}`,
    },
  };
}

export default async function LandingPage({ params, searchParams }: LandingPageProps) {
  const { landing } = await params;
  const { page = '1' } = await searchParams;

  const parsed = parseLandingSlug(landing);

  if (!parsed) {
    notFound();
  }

  const skillConfig = skillKeywords[parsed.skill!];
  const categoryConfig = categories.find(c => c.slug === parsed.skill);
  const locationConfig = parsed.location ? locationKeywords[parsed.location] : null;

  const skillTitle = skillConfig?.title || categoryConfig?.name || parsed.skill;
  const skills = skillConfig?.skills || [skillTitle!];

  const currentPage = parseInt(page, 10) || 1;
  const perPage = 20;
  const maxAgeDate = getMaxJobAgeDate();

  let jobs: any[] = [];
  let totalJobs = 0;

  try {
    const where: any = {
      isActive: true,
      postedAt: { gte: maxAgeDate },
      OR: [
        { skills: { hasSome: skills } },
        { title: { contains: skillTitle, mode: 'insensitive' } },
      ],
    };

    // Add category filter if it's a category landing page
    if (categoryConfig) {
      where.category = { slug: categoryConfig.slug };
    }

    // Add location filter
    if (locationConfig?.country) {
      where.country = locationConfig.country;
    } else if (parsed.location === 'worldwide') {
      where.locationType = 'REMOTE';
    }

    [jobs, totalJobs] = await Promise.all([
      prisma.job.findMany({
        where,
        include: {
          company: { select: { name: true, slug: true, logo: true } },
        },
        orderBy: { postedAt: 'desc' },
        skip: (currentPage - 1) * perPage,
        take: perPage,
      }),
      prisma.job.count({ where }),
    ]);
  } catch (error) {
    console.error('Failed to fetch jobs:', error);
  }

  const totalPages = Math.ceil(totalJobs / perPage);

  // Related landing pages for internal linking
  const relatedPages = Object.keys(skillKeywords)
    .filter(s => s !== parsed.skill)
    .slice(0, 8)
    .map(s => ({
      slug: `remote-${s}-jobs`,
      title: skillKeywords[s].title,
    }));

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: siteConfig.url },
          { '@type': 'ListItem', position: 2, name: 'Jobs', item: `${siteConfig.url}/jobs` },
          { '@type': 'ListItem', position: 3, name: `Remote ${skillTitle} Jobs`, item: `${siteConfig.url}/${landing}` },
        ],
      },
      {
        '@type': 'ItemList',
        name: `Remote ${skillTitle} Jobs`,
        numberOfItems: totalJobs,
        itemListElement: jobs.map((job, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `${siteConfig.url}/company/${job.company.slug}/jobs/${job.slug}`,
        })),
      },
      {
        '@type': 'WebPage',
        '@id': `${siteConfig.url}/${landing}`,
        name: `Remote ${skillTitle} Jobs${locationConfig ? ` in ${locationConfig.title}` : ''}`,
        description: `Find ${totalJobs}+ remote ${skillTitle?.toLowerCase()} positions`,
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
              <li className="text-foreground font-medium">Remote {skillTitle} Jobs</li>
            </ol>
          </nav>

          {/* Hero Section */}
          <header className="mb-8 pb-8 border-b">
            <h1 className="text-4xl font-bold mb-4">
              Remote {skillTitle} Jobs
              {locationConfig && <span className="text-primary"> in {locationConfig.title}</span>}
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl">
              Find the best remote {skillTitle?.toLowerCase()} positions from top companies.
              {totalJobs > 0 && ` ${totalJobs} jobs available.`}
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              <Badge variant="secondary">{skillTitle}</Badge>
              <Badge variant="outline">Remote</Badge>
              {locationConfig && <Badge variant="outline">{locationConfig.title}</Badge>}
            </div>
          </header>

          <div className="flex gap-8">
            {/* Sidebar */}
            <aside className="hidden lg:block w-64 flex-shrink-0">
              <div className="sticky top-20 space-y-6">
                {/* Location Variants */}
                <div>
                  <h2 className="text-sm font-medium mb-2">Filter by Location</h2>
                  <div className="space-y-1">
                    <Link
                      href={`/remote-${parsed.skill}-jobs`}
                      className={`block px-3 py-1.5 text-sm rounded ${!parsed.location ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                    >
                      Worldwide
                    </Link>
                    {Object.entries(locationKeywords).map(([slug, loc]) => (
                      <Link
                        key={slug}
                        href={`/remote-${parsed.skill}-jobs-${slug}`}
                        className={`block px-3 py-1.5 text-sm rounded ${parsed.location === slug ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                      >
                        {loc.title}
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Related Skills */}
                <div>
                  <h2 className="text-sm font-medium mb-2">Related Skills</h2>
                  <div className="space-y-1">
                    {relatedPages.map((p) => (
                      <Link
                        key={p.slug}
                        href={`/${p.slug}`}
                        className="block px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                      >
                        {p.title} Jobs
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </aside>

            {/* Job List */}
            <div className="flex-1">
              {jobs.length > 0 ? (
                <div className="space-y-4">
                  {jobs.map((job) => (
                    <JobCard key={job.id} job={job} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">
                    No {skillTitle?.toLowerCase()} jobs found at the moment.
                  </p>
                  <Link href="/jobs" className="text-primary hover:underline mt-2 inline-block">
                    Browse all jobs
                  </Link>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <nav className="mt-8 flex justify-center gap-2">
                  {currentPage > 1 && (
                    <Link href={`/${landing}?page=${currentPage - 1}`}>
                      <Button variant="outline">Previous</Button>
                    </Link>
                  )}
                  <span className="flex items-center px-4 text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  {currentPage < totalPages && (
                    <Link href={`/${landing}?page=${currentPage + 1}`}>
                      <Button variant="outline">Next</Button>
                    </Link>
                  )}
                </nav>
              )}
            </div>
          </div>

          {/* SEO Content */}
          <section className="mt-16 border-t pt-8">
            <h2 className="text-2xl font-bold mb-4">
              About Remote {skillTitle} Jobs
            </h2>
            <div className="prose prose-sm max-w-none text-muted-foreground space-y-4">
              <p>
                {skillTitle} developers are in high demand for remote positions. Companies worldwide
                are hiring {skillTitle?.toLowerCase()} professionals to build modern applications,
                scale infrastructure, and deliver exceptional products.
              </p>
              <p>
                Remote {skillTitle?.toLowerCase()} jobs offer flexibility, competitive salaries,
                and the opportunity to work with top companies regardless of your location.
                Whether you're a junior developer or a senior engineer, there are {skillTitle?.toLowerCase()} positions
                available at every experience level.
              </p>

              <h3 className="text-lg font-semibold text-foreground mt-6">
                Skills Required for {skillTitle} Jobs
              </h3>
              <ul className="list-disc pl-5">
                {skills.map((s) => (
                  <li key={s}>{s}</li>
                ))}
                <li>Problem-solving abilities</li>
                <li>Strong communication skills</li>
                <li>Experience with version control (Git)</li>
              </ul>

              <h3 className="text-lg font-semibold text-foreground mt-6">
                Average Salary for Remote {skillTitle} Jobs
              </h3>
              <p>
                Remote {skillTitle?.toLowerCase()} developers typically earn between $80,000 and $180,000 annually,
                depending on experience level, location, and company size. Senior positions often exceed $200,000.
              </p>
            </div>

            {/* Internal Links */}
            <div className="mt-8">
              <h3 className="font-semibold mb-3">Explore More Remote Jobs</h3>
              <div className="flex flex-wrap gap-2">
                {relatedPages.map((p) => (
                  <Link
                    key={p.slug}
                    href={`/${p.slug}`}
                    className="text-sm px-3 py-1 bg-muted rounded-full hover:bg-muted/80"
                  >
                    Remote {p.title} Jobs
                  </Link>
                ))}
              </div>
            </div>
          </section>

          {/* FAQ Section for Rich Snippets */}
          <section className="mt-12">
            <h2 className="text-2xl font-bold mb-4">
              Frequently Asked Questions
            </h2>
            <div className="space-y-4">
              <details className="border rounded-lg p-4">
                <summary className="font-medium cursor-pointer">
                  How do I find remote {skillTitle?.toLowerCase()} jobs?
                </summary>
                <p className="mt-2 text-muted-foreground">
                  Browse our curated list of remote {skillTitle?.toLowerCase()} positions. We aggregate jobs from
                  LinkedIn, company career pages, and top job boards, making it easy to find opportunities.
                </p>
              </details>
              <details className="border rounded-lg p-4">
                <summary className="font-medium cursor-pointer">
                  What salary can I expect for a remote {skillTitle?.toLowerCase()} position?
                </summary>
                <p className="mt-2 text-muted-foreground">
                  Salaries vary based on experience and company. Entry-level positions start around $60,000-$80,000,
                  while senior roles can exceed $150,000-$200,000 annually.
                </p>
              </details>
              <details className="border rounded-lg p-4">
                <summary className="font-medium cursor-pointer">
                  Are remote {skillTitle?.toLowerCase()} jobs fully remote?
                </summary>
                <p className="mt-2 text-muted-foreground">
                  Most positions on Freelanly are fully remote. Some may be hybrid or have location requirements.
                  Check each job listing for specific details.
                </p>
              </details>
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

      {/* FAQ Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
              {
                '@type': 'Question',
                name: `How do I find remote ${skillTitle?.toLowerCase()} jobs?`,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: `Browse our curated list of remote ${skillTitle?.toLowerCase()} positions. We aggregate jobs from LinkedIn, company career pages, and top job boards.`,
                },
              },
              {
                '@type': 'Question',
                name: `What salary can I expect for a remote ${skillTitle?.toLowerCase()} position?`,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Salaries vary based on experience and company. Entry-level positions start around $60,000-$80,000, while senior roles can exceed $150,000-$200,000 annually.',
                },
              },
              {
                '@type': 'Question',
                name: `Are remote ${skillTitle?.toLowerCase()} jobs fully remote?`,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Most positions on Freelanly are fully remote. Some may be hybrid or have location requirements.',
                },
              },
            ],
          }),
        }}
      />
    </div>
  );
}
