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

export default function SiteHeader({ children }: SiteHeaderProps) {
  return (
    <header className="bg-cream">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5 px-4 py-5 sm:px-6 sm:py-6">
        <Link
          href="/"
          className="font-heading text-2xl font-semibold text-charcoal sm:text-3xl"
        >
          Authentic Creations
        </Link>
        <nav
          aria-label="Main"
          className="flex flex-wrap items-center gap-x-7 gap-y-3 font-body text-lg font-semibold text-charcoal"
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
