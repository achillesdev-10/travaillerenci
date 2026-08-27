import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/cz7tk', '/api/', '/dashboard'],
    },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
