import { MetadataRoute } from 'next';
import { siteConfig } from '@/config/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          // Private/admin areas
          '/api/',
          '/admin/',
          '/dashboard/',
          '/auth/',

          // Static assets (allow JS/CSS for rendering)
          '/_next/static/media/',

          // NOTE: *?page=* deliberately NOT blocked — Google must crawl
          // paginated pages to see their noindex tag and deindex them.
          // Blocking via robots.txt prevents Google from seeing noindex/404/410.

          // Search queries (dynamic, duplicate content)
          '*?q=*',

          // Filter combinations that create thin/duplicate content
          '*?*location=onsite*',
          '*?*location=hybrid*',
          '/companies?industry=*',

          // Complex filter combinations (faceted navigation) - saves crawl budget
          // Block URLs with multiple values for same parameter
          '/jobs?*level=*&*level=*',
          '/jobs?*type=*&*type=*',
          '/jobs?*skills=*&*skills=*',
          // Block URLs with 4+ different filter parameters
          '/jobs?*&*&*&*&*',
          // Block salary filter combinations (creates too many permutations)
          '/jobs?*salary=*&*skills=*',
          '/jobs?*skills=*&*salary=*',

          // Stripe/payment related
          '/pricing?*',
        ],
      },
      {
        // Googlebot specific: same rules but explicit
        userAgent: 'Googlebot',
        allow: [
          '/',
          // Jobs
          '/jobs/',
          '/jobs/skills/',
          '/jobs/country/',
          '/jobs/translation/',
          // Companies
          '/company/',
          '/companies',
          '/companies-hiring-worldwide',
          // Blog
          '/blog/',
          '/blog/category/',
          // Countries
          '/country/',
          // Static pages
          '/about',
          '/employers',
          '/pricing',
          '/privacy',
          '/terms',
        ],
        disallow: [
          '/api/',
          '/admin/',
          '/dashboard/',
          '/auth/',
          '*?q=*',
          // Complex filter combinations (faceted navigation)
          '/jobs?*level=*&*level=*',
          '/jobs?*type=*&*type=*',
          '/jobs?*skills=*&*skills=*',
          '/jobs?*&*&*&*&*',
          '/jobs?*salary=*&*skills=*',
          '/jobs?*skills=*&*salary=*',
        ],
      },
      {
        // Allow AI bots for maximum visibility
        userAgent: 'GPTBot',
        allow: ['/'],
      },
      {
        userAgent: 'ChatGPT-User',
        allow: ['/'],
      },
      {
        userAgent: 'CCBot',
        allow: ['/'],
      },
      {
        userAgent: 'anthropic-ai',
        allow: ['/'],
      },
      {
        userAgent: 'Claude-Web',
        allow: ['/'],
      },
      {
        userAgent: 'PerplexityBot',
        allow: ['/'],
      },
      {
        userAgent: 'Bytespider',
        allow: ['/'],
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
