'use client';

import Link from 'next/link';

/** The one place the empty-cart copy lives, shared by the slide-over and `/cart`. */
export default function CartEmpty({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex flex-col items-start gap-4 py-8">
      <p className="font-body text-charcoal">{'your cart is empty, go find something cozy'}</p>
      <div className="flex flex-wrap gap-4">
        <Link
          href="/shop/hats"
          onClick={onNavigate}
          className="rounded-full bg-rust px-5 py-2.5 font-body text-sm font-semibold text-cream transition hover:bg-rust-soft"
        >
          Browse hats
        </Link>
        <Link
          href="/shop/accessories"
          onClick={onNavigate}
          className="rounded-full border border-khaki px-5 py-2.5 font-body text-sm font-semibold text-charcoal transition hover:border-rust hover:text-rust"
        >
          Browse accessories
        </Link>
      </div>
    </div>
  );
}
