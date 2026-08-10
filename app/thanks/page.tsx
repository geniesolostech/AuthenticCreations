'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import { useCart } from '@/lib/cart-context';

const CUSTOM_REMINDER =
  'Ordered something custom? Made-to-order pieces are crocheted just for you, so please allow a little extra time — CJ will reach out if she has any questions about your colors or comments.';

/**
 * Square's return page. This — and only this — empties the cart: a shopper who
 * backs out of Square's payment page must find their cart exactly as they left
 * it, so the checkout handoff deliberately leaves it alone.
 *
 * The clear is written as "keep it empty while this page is showing" rather
 * than a one-shot mount effect on purpose: `CartProvider` hydrates from
 * localStorage in *its* mount effect, which React runs after this child's, so
 * a single clear on mount would be quietly undone by hydration a beat later.
 */
export default function ThanksPage() {
  const { lines, clear } = useCart();

  useEffect(() => {
    if (lines.length > 0) clear();
  }, [lines, clear]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-16 sm:px-6">
      {/* Same rationale as app/cart/page.tsx: a client component can't export
          `metadata`, so the noindex tag is rendered directly and hoisted into
          <head> by React 19. A one-time receipt page has nothing to offer a
          search index. */}
      <meta name="robots" content="noindex" />
      <h1 className="font-heading text-3xl text-charcoal sm:text-4xl">Thank you!</h1>
      <p className="font-script text-2xl text-rust">Find you in whatever you do.</p>
      <p className="font-body text-charcoal">
        {"Your order is in, and CJ is already reaching for the yarn. Square will email you a receipt, and we'll send a note the moment your pieces are on their way."}
      </p>
      <p className="font-body text-charcoal">{CUSTOM_REMINDER}</p>

      <div className="mt-2 flex flex-wrap gap-4">
        <Link
          href="/shop/hats"
          className="rounded-full bg-rust px-5 py-2.5 font-body text-sm font-semibold text-cream transition hover:bg-rust-soft"
        >
          Back to hats
        </Link>
        <Link
          href="/shop/accessories"
          className="rounded-full border border-khaki px-5 py-2.5 font-body text-sm font-semibold text-charcoal transition hover:border-rust hover:text-rust"
        >
          Browse accessories
        </Link>
        <Link
          href="/community"
          className="rounded-full border border-khaki px-5 py-2.5 font-body text-sm font-semibold text-charcoal transition hover:border-rust hover:text-rust"
        >
          Say hi in the community
        </Link>
      </div>
    </div>
  );
}
