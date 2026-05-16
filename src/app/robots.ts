import { MetadataRoute } from 'next';
import { siteConfig } from '@/config/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/dashboard/',
          // Job pages now redirect to signup — no need to crawl
          '/jobs/',
          '/freelance/',
          '/company/',
          '/companies',
          '/country/',
        ],
      },
      {
        userAgent: 'Googlebot',
        allow: [
          '/',
          '/pricing',
          '/how-it-works',
          '/features',
          '/about',
          '/auth/signin',
          '/blog/',
          '/privacy',
          '/terms',
        ],
        disallow: [
          '/api/',
          '/admin/',
          '/dashboard/',
        ],
      },
      // Allow AI bots
      { userAgent: 'GPTBot', allow: ['/'] },
      { userAgent: 'ChatGPT-User', allow: ['/'] },
      { userAgent: 'anthropic-ai', allow: ['/'] },
      { userAgent: 'Claude-Web', allow: ['/'] },
      { userAgent: 'PerplexityBot', allow: ['/'] },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
