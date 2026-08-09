import Link from "next/link";

const NAV_LINKS = [
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

export default function SiteHeader({ children }: SiteHeaderProps) {
  return (
    <header className="bg-cream">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="font-heading text-xl font-semibold text-charcoal"
        >
          Authentic Creations
        </Link>
        <nav
          aria-label="Main"
          className="flex flex-wrap items-center gap-x-6 gap-y-2 font-body text-sm text-charcoal"
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
