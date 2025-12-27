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
          '/auth/',
          // Block only media files, allow JS/CSS for proper rendering
          '/_next/static/media/',
          // Block onsite/hybrid filter pages (we're a remote job board)
          '*?*location=onsite*',
          '*?*location=hybrid*',
          // Block companies industry filter pages (URLs have spaces, noindex isn't enough)
          '/companies?industry=*',
        ],
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
