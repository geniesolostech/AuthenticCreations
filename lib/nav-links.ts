/** The header's six destinations, in the order the chip row renders them.
 * Position is load-bearing: it is also the index into the quilt rotation
 * (lib/quilt.ts), so each chip's frame and tint are fixed by where the link
 * sits rather than by anything the visitor does — stable across renders and
 * visits, SSR-safe. The names are accessible names the E2E suite navigates
 * by, not labels to reword. */

export interface NavLink {
  name: string;
  href: string;
}

export const NAV_LINKS: NavLink[] = [
  { name: 'Home', href: '/' },
  { name: 'Hats', href: '/shop/hats' },
  { name: 'Accessories', href: '/shop/accessories' },
  { name: 'About', href: '/about' },
  { name: 'Blog', href: '/blog' },
  { name: 'Community', href: '/community' },
];

/** Whether `href` is the page being viewed, so exactly one chip can wear the
 * current-page voice.
 *
 * `/` matches itself and nothing else — every route starts with it, so a
 * prefix test would light Home everywhere. Every other entry also claims what
 * sits below it (`/shop/hats/crochet-beanie` lights Hats, `/blog/some-post`
 * lights Blog), with the boundary tested on the `/` so `/aboutus` can never
 * light `/about`.
 *
 * `null` — what `usePathname` yields outside an app-router provider — lights
 * nothing, rather than guessing at a page. */
export function isActiveNavHref(href: string, pathname: string | null): boolean {
  if (pathname === null) return false;
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
