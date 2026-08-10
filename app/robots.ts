import type { MetadataRoute } from 'next';

/**
 * `/robots.txt`. Everything is crawlable except the Sanity Studio (an admin
 * tool, not content), the cart and thanks pages (transient, per-shopper
 * state — see the `noindex` meta tags on those two pages), and the API
 * routes (never meant to be requested by a browser at all).
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/studio', '/cart', '/thanks', '/api/'],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
