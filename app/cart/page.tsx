'use client';

import Link from 'next/link';
import { useState } from 'react';

import CartEmpty from '@/components/cart-empty';
import CartLineRow from '@/components/cart-line-row';
import CheckoutButton from '@/components/checkout-button';
import { useCart } from '@/lib/cart-context';
import { formatMoney } from '@/lib/money';

/**
 * The full cart page — the same rows as the slide-over, given room to breathe,
 * plus an order summary. A client page by necessity: the cart lives in the
 * browser (localStorage), so there is nothing here for the server to render.
 */
export default function CartPage() {
  const { lines, subtotal } = useCart();
  const [soldOutIds, setSoldOutIds] = useState<string[]>([]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      {/* This page is a client component, so it can't export the `metadata`
          object App Router pages normally use for this — React 19 hoists a
          <meta> rendered anywhere in the tree into <head> instead. Per-shopper
          cart state has nothing to offer a search index. */}
      <meta name="robots" content="noindex" />
      <h1 className="font-heading text-3xl text-charcoal sm:text-4xl">Your cart</h1>

      {lines.length === 0 ? (
        <>
          <CartEmpty />
          {/* Present but disabled: the plan keeps checkout where the shopper
              expects it rather than making it appear out of nowhere. */}
          <CheckoutButton className="items-start" />
        </>
      ) : (
        <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:items-start">
          <ul className="flex-1 divide-y divide-linen">
            {lines.map((line) => (
              <CartLineRow
                key={line.lineId}
                line={line}
                soldOut={soldOutIds.includes(line.variationId)}
              />
            ))}
          </ul>

          <div className="flex w-full flex-col gap-3 rounded-2xl bg-linen p-5 shadow-card lg:w-80">
            <h2 className="font-heading text-lg text-charcoal">Order summary</h2>
            <div className="flex items-baseline justify-between">
              <span className="font-body text-sm text-charcoal">Subtotal</span>
              <span data-testid="cart-subtotal" className="font-heading text-xl text-charcoal">
                {formatMoney(subtotal)}
              </span>
            </div>
            <p className="font-body text-xs text-khaki">shipping &amp; tax calculated at checkout</p>
            <CheckoutButton onSoldOutIds={setSoldOutIds} />
            <Link
              href="/shop/hats"
              className="text-center font-body text-sm text-khaki underline underline-offset-2 transition hover:text-rust"
            >
              Keep shopping
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
