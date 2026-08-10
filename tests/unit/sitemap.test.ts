import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import sitemap from '@/app/sitemap';
import { getPosts, getProducts, getUpcomingEvents, getPastEvents } from '@/lib/sanity/queries';
import type { EventDoc, PostSummary, Product } from '@/lib/sanity/queries';

vi.mock('@/lib/sanity/queries', () => ({
  getProducts: vi.fn(),
  getPosts: vi.fn(),
  getUpcomingEvents: vi.fn(),
  getPastEvents: vi.fn(),
}));

const mockedGetProducts = vi.mocked(getProducts);
const mockedGetPosts = vi.mocked(getPosts);
const mockedGetUpcoming = vi.mocked(getUpcomingEvents);
const mockedGetPast = vi.mocked(getPastEvents);

function urls(entries: Awaited<ReturnType<typeof sitemap>>): string[] {
  return entries.map((entry) => entry.url);
}

beforeEach(() => {
  mockedGetProducts.mockReset().mockResolvedValue([]);
  mockedGetPosts.mockReset().mockResolvedValue([]);
  mockedGetUpcoming.mockReset().mockResolvedValue([]);
  mockedGetPast.mockReset().mockResolvedValue([]);
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://authenticcreationsco.com');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('/sitemap.xml', () => {
  test('always includes the static routes', async () => {
    const entries = urls(await sitemap());

    expect(entries).toEqual(
      expect.arrayContaining([
        'https://authenticcreationsco.com',
        'https://authenticcreationsco.com/shop/hats',
        'https://authenticcreationsco.com/shop/accessories',
        'https://authenticcreationsco.com/about',
        'https://authenticcreationsco.com/blog',
        'https://authenticcreationsco.com/community',
        'https://authenticcreationsco.com/policies',
      ]),
    );
  });

  test('never lists the noindex-ed cart, thanks, studio, or API routes', async () => {
    const entries = urls(await sitemap());

    for (const entry of entries) {
      expect(entry).not.toMatch(/\/(cart|thanks|studio|api)(\/|$)/);
    }
  });

  test('adds every product, post, and event slug from Sanity', async () => {
    const hat: Product = { _id: 'p1', title: 'Beanie', slug: 'beanie', section: 'hats' };
    const accessory: Product = { _id: 'p2', title: 'Flower Clip', slug: 'flower-clip', section: 'accessories' };
    mockedGetProducts.mockImplementation(async (section) =>
      section === 'hats' ? [hat] : [accessory],
    );
    const post: PostSummary = { _id: 'post1', title: 'A Post', slug: 'a-post' };
    mockedGetPosts.mockResolvedValue([post]);
    const upcoming: EventDoc = {
      _id: 'e1',
      title: 'August Circle',
      slug: 'august-circle',
      startsAt: '2099-08-20T23:00:00.000Z',
    };
    const past: EventDoc = {
      _id: 'e2',
      title: 'July Circle',
      slug: 'july-circle',
      startsAt: '2020-07-20T23:00:00.000Z',
    };
    mockedGetUpcoming.mockResolvedValue([upcoming]);
    mockedGetPast.mockResolvedValue([past]);

    const entries = urls(await sitemap());

    expect(entries).toContain('https://authenticcreationsco.com/shop/hats/beanie');
    expect(entries).toContain('https://authenticcreationsco.com/shop/accessories/flower-clip');
    expect(entries).toContain('https://authenticcreationsco.com/blog/a-post');
    expect(entries).toContain('https://authenticcreationsco.com/community/august-circle');
    expect(entries).toContain('https://authenticcreationsco.com/community/july-circle');
  });

  test('degrades to the static routes only when Sanity throws', async () => {
    mockedGetProducts.mockRejectedValue(new Error('network down'));

    const entries = urls(await sitemap());

    expect(entries).toEqual([
      'https://authenticcreationsco.com',
      'https://authenticcreationsco.com/shop/hats',
      'https://authenticcreationsco.com/shop/accessories',
      'https://authenticcreationsco.com/shop/hats/custom',
      'https://authenticcreationsco.com/shop/accessories/custom',
      'https://authenticcreationsco.com/about',
      'https://authenticcreationsco.com/blog',
      'https://authenticcreationsco.com/community',
      'https://authenticcreationsco.com/policies',
    ]);
  });
});
