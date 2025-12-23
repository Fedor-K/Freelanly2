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
          // Block filter query params from crawling (save crawl budget)
          '/jobs?*',
          // Block only media files, allow JS/CSS for proper rendering
          '/_next/static/media/',
        ],
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
