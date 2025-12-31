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

          // Pagination pages (saves crawl budget, already noindexed)
          '*?page=*',

          // Search queries (dynamic, duplicate content)
          '*?q=*',

          // Filter combinations that create thin/duplicate content
          '*?*location=onsite*',
          '*?*location=hybrid*',
          '/companies?industry=*',

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
          '*?page=*',
          '*?q=*',
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
