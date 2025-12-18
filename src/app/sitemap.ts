import { MetadataRoute } from 'next';
import { siteConfig, categories, levels, locationTypes } from '@/config/site';
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
  ];

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

  // Dynamic job pages from database
  let jobPages: MetadataRoute.Sitemap = [];
  let companyPages: MetadataRoute.Sitemap = [];

  try {
    const jobs = await prisma.job.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
      orderBy: { postedAt: 'desc' },
      take: 10000, // Limit for performance
    });

    jobPages = jobs.map((job) => ({
      url: `${baseUrl}/job/${job.slug}`,
      lastModified: job.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));

    const companies = await prisma.company.findMany({
      select: { slug: true, updatedAt: true },
      take: 5000,
    });

    companyPages = companies.map((company) => ({
      url: `${baseUrl}/companies/${company.slug}`,
      lastModified: company.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));
  } catch (error) {
    // Database might not be available during build
    console.log('Sitemap: Could not fetch dynamic pages from database');
  }

  return [
    ...staticPages,
    ...categoryPages,
    ...categoryLevelPages,
    ...skillLandingPages,
    ...skillLocationPages,
    ...categoryLandingPages,
    ...jobPages,
    ...companyPages,
  ];
}
