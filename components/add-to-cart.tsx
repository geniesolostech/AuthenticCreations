'use client';

import { useCart } from '@/lib/cart-context';

export interface AddToCartProps {
  variationId: string;
  name: string;
  /** `null` when Square couldn't be reached — the button stays disabled
   * rather than adding a line with a guessed price. */
  priceCents: number | null;
  /** Explicit override for any other reason to disable (e.g. missing variation). */
  disabled?: boolean;
  /** Drives both the disabled state and the "Sold out" label. */
  soldOut?: boolean;
  imageUrl?: string;
  quantity?: number;
}

/**
 * The one place a cart line gets created from the shop UI. On click, adds a
 * line via `useCart()` and fires `cart:open` on `window` so the (Task 8)
 * mini-cart can pop open — this component works today even though nothing
 * listens for that event yet.
 */
export default function AddToCart({
  variationId,
  name,
  priceCents,
  disabled = false,
  soldOut = false,
  imageUrl,
  quantity = 1,
}: AddToCartProps) {
  const { add } = useCart();
  const isDisabled = disabled || soldOut || priceCents === null || variationId === '';

  function handleClick() {
    if (isDisabled || priceCents === null) return;
    add({ variationId, name, unitAmount: priceCents, quantity, imageUrl });
    window.dispatchEvent(new CustomEvent('cart:open'));
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isDisabled}
      className="rounded-full bg-rust px-6 py-3 font-body text-sm font-semibold text-cream transition hover:bg-rust-soft disabled:cursor-not-allowed disabled:bg-khaki disabled:hover:bg-khaki"
    >
      {soldOut ? 'Sold out' : 'Add to Cart'}
    </button>
  );
}
