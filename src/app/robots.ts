import { MetadataRoute } from 'next';
import { siteConfig } from '@/config/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/jobs?page=*', // Allow pagination
        ],
        disallow: [
          '/api/',
          '/admin/',
          '/_next/',
          '/dashboard/',
          // Block filter query params from crawling (save crawl budget)
          // but allow pagination
          '/jobs?q=*',      // Block search queries
          '/jobs?level=*',  // Block level filters
          '/jobs?type=*',   // Block type filters
          '/jobs?country=*', // Block country filters
          '/jobs?salary=*', // Block salary filters
          '/jobs?skills=*', // Block skills filters
        ],
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
