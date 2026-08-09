import Link from "next/link";

const CONTACT_EMAIL = "hello@authenticcreationsco.com";

export default function SiteFooter() {
  return (
    <footer className="bg-charcoal text-cream">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 sm:px-6">
        <p className="font-script text-3xl text-rust-soft">
          Find you in whatever you do.
        </p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-body text-sm">
          <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-rust-soft">
            {CONTACT_EMAIL}
          </a>
          <Link href="/policies" className="hover:text-rust-soft">
            Shipping & Returns
          </Link>
        </div>
        <p className="font-body text-xs text-khaki">
          &copy; {new Date().getFullYear()} Authentic Creations. Handmade with
          love.
        </p>
      </div>
    </footer>
  );
}
