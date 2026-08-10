import type { MetadataRoute } from 'next';

import { SECTIONS } from '@/lib/constants';
import { getPastEvents, getPosts, getProducts, getUpcomingEvents } from '@/lib/sanity/queries';

/** Every route that exists regardless of what is in Sanity. */
const STATIC_PATHS = [
  '',
  ...SECTIONS.map((section) => `/shop/${section}`),
  ...SECTIONS.map((section) => `/shop/${section}/custom`),
  '/about',
  '/blog',
  '/community',
  '/policies',
];

/**
 * `/sitemap.xml`: the static routes above, plus every product, post, and
 * event slug from Sanity. Guarded the same way as every other Sanity read in
 * the app (Tasks 6/7/9/10) — a hiccup falls all the way back to the static
 * routes rather than a partial or crashed sitemap. `/cart`, `/thanks`, and
 * `/studio` are deliberately absent, matching their `noindex`/`robots.ts`
 * treatment.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: `${siteUrl}${path}`,
  }));

  try {
    const now = new Date();
    const [products, posts, upcoming, past] = await Promise.all([
      Promise.all(SECTIONS.map((section) => getProducts(section))),
      getPosts(),
      getUpcomingEvents(now),
      getPastEvents(now),
    ]);

    const productEntries = products.flat().map((product) => ({
      url: `${siteUrl}/shop/${product.section}/${product.slug}`,
    }));
    const postEntries = posts.map((post) => ({ url: `${siteUrl}/blog/${post.slug}` }));
    const eventEntries = [...upcoming, ...past].map((event) => ({
      url: `${siteUrl}/community/${event.slug}`,
    }));

    return [...staticEntries, ...productEntries, ...postEntries, ...eventEntries];
  } catch (error) {
    console.error('[sitemap] failed to fetch dynamic routes from Sanity', error);
    return staticEntries;
  }
}
