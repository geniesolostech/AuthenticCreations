import Link from "next/link";

import HeaderBand from "@/components/header-band";
import HeaderNav from "@/components/header-nav";
import YarnUnderline from "@/components/yarn-underline";

type SiteHeaderProps = {
  /** Cart trigger slot — Task 8 injects the mini-cart trigger here. */
  children?: React.ReactNode;
};

/**
 * The masthead: the brand mark (joined by the wordmark from sm: up), the
 * quilt chip row, and the cart trigger, on the sticky sand band.
 *
 * Stays a Server Component. Only the two pieces that need the browser are
 * Client Components — the band's scrolled shadow and the chip row's
 * current-page test — and this composes them.
 *
 * DOM order stays brand, nav, cart, as it was: that is the order the row
 * reads in on a wide screen, and the order the cart slot has always been
 * last in. Below xl the chip row is ordered onto a line of its own
 * (`order-last`, in components/header-nav.tsx) and the cart trigger rides up
 * beside the brand, so the band stays two rows at most.
 */
export default function SiteHeader({ children }: SiteHeaderProps) {
  return (
    <HeaderBand>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 sm:px-6 sm:py-4">
        <Link
          href="/"
          // Named here rather than in the mark's `alt`: from sm: up the
          // wordmark beside it says the same words, and announcing them twice
          // is exactly the complaint docs/known-issues.md records against the
          // hero logo. "home" keeps the destination in the name without
          // repeating what is on screen.
          aria-label="Authentic Creations home"
          className="flex shrink-0 items-center gap-3"
        >
          {/* Local /public asset — a plain <img>, same as components/hero.tsx
              (see components/product-card.tsx for why nothing here reaches
              for next/image). `width`/`height` are the file's own 320x320:
              the rendered box comes from the classes, but the intrinsic ratio
              has to be in the markup or the band reflows when the PNG lands. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-mark.png"
            alt=""
            width={320}
            height={320}
            className="h-11 w-11 sm:h-12 sm:w-12"
          />
          {/* Below sm: the mark carries the brand alone — the wordmark at
              this size would leave the chip row nowhere to go. */}
          <span className="hidden font-heading text-2xl font-semibold text-charcoal sm:inline sm:text-3xl">
            Authentic Creations
          </span>
        </Link>
        <HeaderNav />
        {children}
      </div>
      {/* The band's bottom edge as a crochet signature rather than a rule
          (Woven spec §4). Decorative and aria-hidden inside the component,
          and a fixed 10px tall — so it costs the sticky header the same space
          whether the page is scrolled or not.
          The strand is drawn from x=2 to x=142 of a 150-wide viewBox, an
          inset that reads as deliberate under a heading and as a line
          stopping short across a full-width band. Widening the svg to
          150/140 and pulling it left by 2/140 puts the drawn span edge to
          edge; the wrapper clips what that pushes past the right edge, which
          would otherwise scroll the page sideways. */}
      <div className="overflow-hidden">
        <YarnUnderline color="rose" className="w-[107.15%] -ml-[1.43%]" />
      </div>
    </HeaderBand>
  );
}
