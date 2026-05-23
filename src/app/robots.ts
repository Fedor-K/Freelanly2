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
          '/freelance/',
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
