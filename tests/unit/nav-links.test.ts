import { describe, expect, test } from 'vitest';

import { isActiveNavHref, NAV_LINKS } from '@/lib/nav-links';
import { QUILT_ROTATION } from '@/lib/quilt';

describe('NAV_LINKS', () => {
  test('is the six destinations, in the order the chip row renders them', () => {
    expect(NAV_LINKS).toEqual([
      { name: 'Home', href: '/' },
      { name: 'Hats', href: '/shop/hats' },
      { name: 'Accessories', href: '/shop/accessories' },
      { name: 'About', href: '/about' },
      { name: 'Blog', href: '/blog' },
      { name: 'Community', href: '/community' },
    ]);
  });

  test('is exactly as long as the quilt rotation, so every chip is a different color', () => {
    expect(NAV_LINKS).toHaveLength(QUILT_ROTATION.length);
  });
});

describe('isActiveNavHref', () => {
  test('lights the chip for the page being viewed, and only that one', () => {
    for (const { href } of NAV_LINKS) {
      const lit = NAV_LINKS.filter((link) => isActiveNavHref(link.href, href));
      expect(lit).toEqual([NAV_LINKS.find((link) => link.href === href)]);
    }
  });

  test('/ matches itself only — a prefix test would light Home everywhere', () => {
    expect(isActiveNavHref('/', '/')).toBe(true);
    expect(isActiveNavHref('/', '/blog')).toBe(false);
    expect(isActiveNavHref('/', '/shop/hats')).toBe(false);
  });

  test('a product page lights its section chip', () => {
    expect(isActiveNavHref('/shop/hats', '/shop/hats/crochet-beanie')).toBe(true);
    expect(isActiveNavHref('/shop/hats', '/shop/hats/custom')).toBe(true);
    expect(isActiveNavHref('/shop/accessories', '/shop/hats/crochet-beanie')).toBe(false);
  });

  test('a post page lights Blog, an event page lights Community', () => {
    expect(isActiveNavHref('/blog', '/blog/some-post')).toBe(true);
    expect(isActiveNavHref('/community', '/community/cozy-crochet-circle')).toBe(true);
  });

  test('the boundary is the slash, so a neighbouring route never borrows a chip', () => {
    expect(isActiveNavHref('/about', '/aboutus')).toBe(false);
    expect(isActiveNavHref('/blog', '/blogroll')).toBe(false);
  });

  test('a trailing slash still matches', () => {
    expect(isActiveNavHref('/blog', '/blog/')).toBe(true);
  });

  test('a page outside the nav lights nothing', () => {
    for (const { href } of NAV_LINKS) {
      expect(isActiveNavHref(href, '/cart')).toBe(false);
      expect(isActiveNavHref(href, '/policies')).toBe(false);
    }
  });

  test('a null pathname lights nothing rather than guessing', () => {
    for (const { href } of NAV_LINKS) {
      expect(isActiveNavHref(href, null)).toBe(false);
    }
  });
});
