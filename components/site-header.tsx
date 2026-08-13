import Link from "next/link";

const NAV_LINKS = [
  { name: "Home", href: "/" },
  { name: "Hats", href: "/shop/hats" },
  { name: "Accessories", href: "/shop/accessories" },
  { name: "About", href: "/about" },
  { name: "Blog", href: "/blog" },
  { name: "Community", href: "/community" },
] as const;

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
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5 px-4 py-5 sm:px-6 sm:py-6">
        <Link
          href="/"
          className="font-heading text-2xl font-semibold text-charcoal sm:text-3xl"
        >
          Authentic Creations
        </Link>
        {/* `order-last w-full` drops the nav onto its own row on phones,
            leaving the wordmark and the cart trigger to share row one — the
            trigger keeps its DOM position, which its injector depends on.
            Six bold links pile up when they wrap, so on phones they stay on
            one line and slide instead. The scrollbar is hidden, not disabled:
            swipe still pans, and focusing an off-screen link still scrolls it
            into view. */}
        <nav
          aria-label="Main"
          className="order-last flex w-full flex-nowrap items-center gap-x-7 gap-y-3 overflow-x-auto whitespace-nowrap font-body text-base font-semibold text-charcoal [scrollbar-width:none] sm:order-none sm:w-auto sm:flex-wrap sm:overflow-visible sm:text-lg [&::-webkit-scrollbar]:hidden"
        >
          {NAV_LINKS.map(({ name, href }) => (
            <Link key={href} href={href} className="hover:text-rust">
              {name}
            </Link>
          ))}
        </nav>
        {children}
      </div>
    </header>
  );
}
