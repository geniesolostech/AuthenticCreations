import Link from "next/link";

import HeaderNav from "@/components/header-nav";

type SiteHeaderProps = {
  /** Cart trigger slot — Task 8 injects the mini-cart trigger here. */
  children?: React.ReactNode;
};

/**
 * The desktop rendering is settled: every mobile-only utility below is paired
 * with an `sm:` reset, so nothing at `sm:` and up may change.
 */
export default function SiteHeader({ children }: SiteHeaderProps) {
  return (
    // Pinned on phones, where the nav costs a second row and scrolling away
    // would bury the cart. z-30 clears page content (which sets no z-index)
    // but stays under the mini-cart overlay's z-40 so the drawer covers it.
    <header className="sticky top-0 z-30 bg-cream shadow-card sm:static sm:shadow-none">
      {/* py-3/gap-3 on phones, where this block reads too tall — and where the
          nav's active-link strand adds 8px to the second row. The two
          reclaim 24px against that 8px, so the pinned header is a net 16px
          shorter than before the strand existed. */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:gap-5 sm:px-6 sm:py-6">
        <Link
          href="/"
          className="font-heading text-xl font-semibold text-charcoal sm:text-3xl"
        >
          Authentic Creations
        </Link>
        {/* A client component, and the only one here: marking the current page
            needs `usePathname`. It owns the nav's classes and its mobile
            row-of-its-own layout. */}
        <HeaderNav />
        {children}
      </div>
    </header>
  );
}
