import { MetadataRoute } from 'next';
import { siteConfig, categories, levels, locationTypes, countries, jobRoles, languagePairs } from '@/config/site';
import { prisma } from '@/lib/db';

// Popular tech skills for programmatic pages
const popularSkills = [
  'react', 'typescript', 'python', 'javascript', 'nodejs',
  'java', 'golang', 'rust', 'aws', 'kubernetes',
  'docker', 'terraform', 'graphql', 'nextjs', 'vue',
  'angular', 'flutter', 'swift', 'kotlin', 'ruby',
  'rails', 'django', 'laravel', 'postgresql', 'mongodb',
  'redis', 'elasticsearch', 'kafka', 'spark', 'machine-learning',
  'data-science', 'devops', 'sre', 'cloud', 'security',
];

// Locations for programmatic pages
const locations = [
  { slug: 'usa', name: 'USA' },
  { slug: 'europe', name: 'Europe' },
  { slug: 'uk', name: 'UK' },
  { slug: 'germany', name: 'Germany' },
  { slug: 'canada', name: 'Canada' },
  { slug: 'australia', name: 'Australia' },
  { slug: 'worldwide', name: 'Worldwide' },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = siteConfig.url;
  const now = new Date();

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/jobs`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/companies`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/employers`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/country`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.85,
    },
    {
      url: `${baseUrl}/companies-hiring-worldwide`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.85,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.8,
    },
  ];

  // Pagination pages: /jobs?page=2 through /jobs?page=50
  const jobsPaginationPages: MetadataRoute.Sitemap = Array.from({ length: 49 }, (_, i) => ({
    url: `${baseUrl}/jobs?page=${i + 2}`,
    lastModified: now,
    changeFrequency: 'hourly' as const,
    priority: 0.7,
  }));

  // Category pages: /jobs/[category]
  const categoryPages: MetadataRoute.Sitemap = categories.map((cat) => ({
    url: `${baseUrl}/jobs/${cat.slug}`,
    lastModified: now,
    changeFrequency: 'hourly' as const,
    priority: 0.9,
  }));

  // Category + Level pages: /jobs/[category]/[level]
  const categoryLevelPages: MetadataRoute.Sitemap = categories.flatMap((cat) =>
    levels.map((level) => ({
      url: `${baseUrl}/jobs/${cat.slug}/${level.value.toLowerCase()}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }))
  );

  // SEO Landing pages: /remote-[skill]-jobs
  const skillLandingPages: MetadataRoute.Sitemap = popularSkills.map((skill) => ({
    url: `${baseUrl}/remote-${skill}-jobs`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: 0.85,
  }));

  // Location landing pages: /remote-[skill]-jobs-[location]
  const skillLocationPages: MetadataRoute.Sitemap = popularSkills.flatMap((skill) =>
    locations.map((loc) => ({
      url: `${baseUrl}/remote-${skill}-jobs-${loc.slug}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }))
  );

  // Category landing pages: /remote-[category]-jobs
  const categoryLandingPages: MetadataRoute.Sitemap = categories.map((cat) => ({
    url: `${baseUrl}/remote-${cat.slug}-jobs`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: 0.85,
  }));

  // Country pages: /country/[country]
  const countryPages: MetadataRoute.Sitemap = countries.map((country) => ({
    url: `${baseUrl}/country/${country.slug}`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: 0.85,
  }));

  // Country + Role pages: /country/[country]/jobs/[role]
  const countryRolePages: MetadataRoute.Sitemap = countries.flatMap((country) =>
    jobRoles.map((role) => ({
      url: `${baseUrl}/country/${country.slug}/jobs/${role.slug}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }))
  );

  // Jobs by country pages: /jobs/country/[country]
  const jobsByCountryPages: MetadataRoute.Sitemap = countries.map((country) => ({
    url: `${baseUrl}/jobs/country/${country.slug}`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: 0.85,
  }));

  // Translation language pair pages: /jobs/translation/[pair]
  // Filter out invalid pairs (same source and target language)
  const translationPairPages: MetadataRoute.Sitemap = languagePairs
    .filter((pair) => pair.source !== pair.target)
    .map((pair) => ({
      url: `${baseUrl}/jobs/translation/${pair.slug}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.85,
    }));

  // Dynamic job pages from database - RRS format: /company/[company]/jobs/[job]
  let jobPages: MetadataRoute.Sitemap = [];
  let companyPages: MetadataRoute.Sitemap = [];
  let companyJobsPages: MetadataRoute.Sitemap = [];
  let blogPages: MetadataRoute.Sitemap = [];
  let blogCategoryPages: MetadataRoute.Sitemap = [];

  try {
    // Fetch jobs with company info for new URL structure
    const jobs = await prisma.job.findMany({
      where: { isActive: true },
      select: {
        slug: true,
        updatedAt: true,
        company: {
          select: { slug: true },
        },
      },
      orderBy: { postedAt: 'desc' },
      take: 10000,
    });

    // Job pages: /company/[companySlug]/jobs/[jobSlug]
    jobPages = jobs.map((job) => ({
      url: `${baseUrl}/company/${job.company.slug}/jobs/${job.slug}`,
      lastModified: job.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));

    const companies = await prisma.company.findMany({
      select: { slug: true, updatedAt: true },
      take: 5000,
    });

    // Company pages: /company/[slug]
    companyPages = companies.map((company) => ({
      url: `${baseUrl}/company/${company.slug}`,
      lastModified: company.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));

    // Company jobs listing pages: /company/[slug]/jobs
    companyJobsPages = companies.map((company) => ({
      url: `${baseUrl}/company/${company.slug}/jobs`,
      lastModified: company.updatedAt,
      changeFrequency: 'daily' as const,
      priority: 0.65,
    }));

    // Blog posts: /blog/[slug]
    const blogPosts = await prisma.blogPost.findMany({
      where: { status: 'PUBLISHED' },
      select: { slug: true, updatedAt: true },
      orderBy: { publishedAt: 'desc' },
      take: 1000,
    });

    blogPages = blogPosts.map((post) => ({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: post.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));

    // Blog categories: /blog/category/[category]
    const blogCategories = await prisma.blogCategory.findMany({
      select: { slug: true, updatedAt: true },
    });

    blogCategoryPages = blogCategories.map((cat) => ({
      url: `${baseUrl}/blog/category/${cat.slug}`,
      lastModified: cat.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));
  } catch (error) {
    // Database might not be available during build
    console.log('Sitemap: Could not fetch dynamic pages from database');
  }

  return [
    ...staticPages,
    ...jobsPaginationPages,
    ...categoryPages,
    ...categoryLevelPages,
    ...skillLandingPages,
    ...skillLocationPages,
    ...categoryLandingPages,
    ...countryPages,
    ...countryRolePages,
    ...jobsByCountryPages,
    ...translationPairPages,
    ...companyPages,
    ...companyJobsPages,
    ...jobPages,
    ...blogPages,
    ...blogCategoryPages,
  ];
}
