'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

import YarnUnderline, { type YarnColor } from '@/components/yarn-underline';

type NavLink = {
  name: string;
  href: string;
  /** The accent the destination page underlines its own title with. */
  color: YarnColor;
};

/**
 * The nav carries each page's own thread: the current link wears a yarn
 * strand in the exact color that page's title underline already uses, so the
 * header echoes the page instead of introducing a highlight color of its own.
 * Each entry below is the color read off that page, not a fresh choice.
 */
const NAV_LINKS: readonly NavLink[] = [
  // The home page has no single page title to borrow from — this is the first
  // color of its section rotation (`Featured pieces`, app/page.tsx).
  { name: 'Home', href: '/', color: 'rose' },
  // Both sections render from app/shop/[section]/page.tsx, whose one
  // page-title underline is rose, so both links carry rose.
  { name: 'Hats', href: '/shop/hats', color: 'rose' },
  { name: 'Accessories', href: '/shop/accessories', color: 'rose' },
  // app/about/page.tsx
  { name: 'About', href: '/about', color: 'golden' },
  // app/blog/page.tsx
  { name: 'Blog', href: '/blog', color: 'sage' },
  // app/community/page.tsx
  { name: 'Community', href: '/community', color: 'plum' },
];

/**
 * Whether `pathname` belongs to the nav link `href`.
 *
 * Home owns the root and nothing else — every path starts with `/`, so a
 * prefix test there would light it up on every page. Every other link owns its
 * subtree, so /shop/hats/crochet-beanie still marks Hats. The trailing slash
 * is what makes that a subtree test rather than a string-prefix one: without
 * it, /shop/hats would also claim a future /shop/hats-and-scarves.
 *
 * Paths under no link (/cart, /thanks, /policies, /studio) match nothing and
 * the row simply carries no strand. `pathname` is null when the hook runs
 * outside a router (tests, and any non-App-Router render).
 */
export function isNavLinkActive(href: string, pathname: string | null): boolean {
  if (!pathname) return false;
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The header's nav, split out of the (server-rendered) header purely because
 * marking the current page needs `usePathname`. It renders in the header's
 * DOM position with the header's classes — the mobile two-row/sliding-row
 * layout below is unchanged.
 */
export default function HeaderNav() {
  const pathname = usePathname();
  const activeLink = useRef<HTMLAnchorElement | null>(null);

  // The mobile row slides sideways, so the active link can start off-screen —
  // on /community it is the last of six. Scrolled by hand, horizontally ONLY:
  // `overflow-x-auto` forces the nav's overflow-y to compute to auto as well,
  // so the nav is also a (barely) vertical scroller, and scrollIntoView with
  // `block: 'nearest'` once nudged it 2px down — hiding the strand's bottom
  // under the row's edge on phones, permanently, until a swipe dragged it
  // back. Writing scrollLeft alone cannot move the other axis. No-op when the
  // link is already fully visible.
  useEffect(() => {
    const link = activeLink.current;
    const nav = link?.parentElement;
    if (!link || !(nav instanceof HTMLElement)) return;
    const navRect = nav.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    if (linkRect.left < navRect.left) {
      nav.scrollLeft += linkRect.left - navRect.left;
    } else if (linkRect.right > navRect.right) {
      nav.scrollLeft += linkRect.right - navRect.right;
    }
  }, [pathname]);

  return (
    // `order-last w-full` drops the nav onto its own row on phones, leaving
    // the wordmark and the cart trigger to share row one — the trigger keeps
    // its DOM position, which its injector depends on. Six bold links pile up
    // when they wrap, so on phones they stay on one line and slide instead.
    // The scrollbar is hidden, not disabled: swipe still pans, and focusing an
    // off-screen link still scrolls it into view.
    <nav
      aria-label="Main"
      className="order-last flex w-full flex-nowrap items-center gap-x-7 gap-y-3 overflow-x-auto whitespace-nowrap font-body text-base font-semibold text-charcoal [scrollbar-width:none] sm:order-none sm:w-auto sm:flex-wrap sm:overflow-visible sm:text-lg [&::-webkit-scrollbar]:hidden"
    >
      {NAV_LINKS.map(({ name, href, color }) => {
        const active = isNavLinkActive(href, pathname);
        return (
          <Link
            key={href}
            href={href}
            ref={active ? activeLink : undefined}
            aria-current={active ? 'page' : undefined}
            className="relative pb-2 hover:text-rust"
          >
            {name}
            {/* The strand's footprint is reserved on EVERY link, filled only
                on the active one: the row has to be exactly as tall on a page
                that matches nothing (/cart, /thanks) as on one that matches,
                and the other links must not move when the active one changes.
                pb-2 on the link is that footprint — 8px for the 6px strand
                plus a 2px breath above it.

                The strand is absolutely positioned, and that is load-bearing
                for its WIDTH: each link is a flex item, and flex items size to
                the max-content of everything in flow — which for the strand's
                SVG (width="100%", so its viewBox-derived intrinsic width) is
                wider than a short word. In flow, "Hats" got a link as wide as
                the SVG's intrinsic size and a strand overshooting the text.
                Out of flow, the link is sized by its text alone and
                inset-x-0 makes the strand exactly that wide. h-1.5 overrides
                the component's heading-row height (10px of wave under a 16px
                word is a banner, not an underline) — the stroke and its
                geometry are untouched.

                The slot is h-2, not h-1.5, and that is load-bearing on
                phones: YarnUnderline sets marginTop: 2px on itself, so inside
                a 6px slot the 6px strand pokes 2px past the bottom — which in
                the mobile nav (a scroll container on BOTH axes; overflow-x
                forces overflow-y) becomes 2px of vertical scrollable overflow
                that hid the strand's lower half once anything scrolled it.
                At 8px, margin plus strand fit exactly and nothing overflows. */}
            <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-2">
              {active ? <YarnUnderline color={color} className="h-1.5 w-full" /> : null}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
