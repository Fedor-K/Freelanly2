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
          '/dashboard/',
          // Block filter query params from crawling (save crawl budget)
          // but allow pagination (/jobs?page=*)
          '/jobs?q=*',      // Block search queries
          '/jobs?level=*',  // Block level filters
          '/jobs?type=*',   // Block type filters
          '/jobs?country=*', // Block country filters
          '/jobs?salary=*', // Block salary filters
          '/jobs?skills=*', // Block skills filters
          // Block only media files, allow JS/CSS for proper rendering
          '/_next/static/media/',
        ],
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
