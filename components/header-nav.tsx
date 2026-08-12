'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { isActiveNavHref, NAV_LINKS } from '@/lib/nav-links';
import { quiltStyle } from '@/lib/quilt';

/**
 * The header's chip row: one pill per destination, wearing the same 2px frame
 * and matching tint the shop grids wear (Woven spec §3), taken off the shared
 * rotation by the link's position — so the row is the same six colors on
 * every page, on every render, server and client alike.
 *
 * A Client Component for one reason: which page the visitor is on can only be
 * read from the URL (`usePathname`). Everything else in the header stays
 * server-rendered — see components/site-header.tsx.
 */

// Literal class names (not template strings) so Tailwind's static scanner can
// find them — same discipline as lib/quilt.ts's rotation.
const CHIP_BASE =
  'shrink-0 rounded-full border-2 px-4 py-2 font-body text-base font-semibold transition-colors duration-200';

/** The page already being viewed speaks in the site's one action color,
 * matching the variant picker's checked pill (components/variant-picker.tsx)
 * rather than inventing a second selected look. */
const CHIP_CURRENT = 'border-rust bg-rust text-cream';

/** Hover moves the frame, not the label: rust text on the quilt tints
 * computes 3.21-3.45:1, under the 4.5:1 body-text floor, while charcoal on
 * every tint clears 9.5:1 (contrast table in app/globals.css). */
const CHIP_REST = 'text-charcoal hover:border-rust';

export default function HeaderNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      // `order-last` + `w-full` is what puts this on a line of its own below
      // xl: it wraps out of the brand's row (the wrapping row itself lives in
      // components/site-header.tsx), leaving the cart trigger up beside the
      // brand. It scrolls sideways rather than wrapping, so the six chips stay
      // one row at every width; the scrollbar is hidden in both engines
      // because the half-shown chip already says there is more to reach.
      // `py-1` keeps a focus ring clear of the scroll container's clipping
      // edge, and `pr-4` stops the last chip sitting flush against it.
      className="order-last flex w-full items-center gap-2 overflow-x-auto py-1 pr-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden xl:order-none xl:w-auto xl:pr-0"
    >
      {NAV_LINKS.map(({ name, href }, index) => {
        const current = isActiveNavHref(href, pathname);
        const quilt = quiltStyle(index);

        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? 'page' : undefined}
            className={
              current
                ? `${CHIP_BASE} ${CHIP_CURRENT}`
                : `${CHIP_BASE} ${CHIP_REST} ${quilt.frame} ${quilt.fill}`
            }
          >
            {name}
          </Link>
        );
      })}
    </nav>
  );
}
