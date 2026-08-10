import Link from 'next/link';

/**
 * The front door: the brand mark, a real (crawlable/screen-reader-readable)
 * headline + tagline — the source JPEG in `public/logo.jpg` already bakes the
 * wordmark and tagline into its pixels, so this restates them as actual text
 * on top of it rather than leaving them locked inside an image — and the two
 * shop CTAs, on the brand's `linen` token.
 */
export default function Hero() {
  return (
    <section className="bg-linen">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-16 text-center sm:px-6 sm:py-24">
        {/* Local /public asset — the app renders every image as a plain <img>
            rather than reaching for next/image (see components/product-card.tsx
            for why), so the hero logo follows the same convention. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.jpg"
          alt="Authentic Creations — Find you in whatever you do"
          className="w-full max-w-xs sm:max-w-sm"
        />
        <h1 className="font-heading text-3xl text-charcoal sm:text-4xl">Authentic Creations</h1>
        <p className="font-script text-3xl text-rust sm:text-4xl">Find you in whatever you do.</p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/shop/hats"
            className="rounded-full bg-rust px-6 py-3 font-body text-sm font-semibold text-cream transition hover:bg-rust-soft"
          >
            Shop Hats
          </Link>
          <Link
            href="/shop/accessories"
            className="rounded-full border border-khaki px-6 py-3 font-body text-sm font-semibold text-charcoal transition hover:border-rust hover:text-rust"
          >
            Shop Accessories
          </Link>
        </div>
      </div>
    </section>
  );
}
