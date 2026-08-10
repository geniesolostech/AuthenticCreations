import { afterEach, describe, expect, test, vi } from 'vitest';

import robots from '@/app/robots';

describe('/robots.txt', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('allows everything except the studio, cart, thanks, and API routes', () => {
    const result = robots();

    expect(result.rules).toEqual({
      userAgent: '*',
      allow: '/',
      disallow: ['/studio', '/cart', '/thanks', '/api/'],
    });
  });

  test('points the sitemap at NEXT_PUBLIC_SITE_URL', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://authenticcreationsco.com');

    const result = robots();

    expect(result.sitemap).toBe('https://authenticcreationsco.com/sitemap.xml');
  });

  test('falls back to localhost when the site URL is not configured', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');

    const result = robots();

    expect(result.sitemap).toBe('http://localhost:3000/sitemap.xml');
  });
});
