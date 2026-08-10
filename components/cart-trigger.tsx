'use client';

import { useCart } from '@/lib/cart-context';

/**
 * The header's cart button. It owns no panel state of its own: clicking it
 * fires the same `cart:open` event the shop's Add-to-Cart buttons fire, so the
 * mini-cart has exactly one way in and this component never has to know
 * whether the panel is already showing.
 */
export default function CartTrigger() {
  const { itemCount } = useCart();

  const label =
    itemCount === 0
      ? 'Open cart, empty'
      : `Open cart, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`;

  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => window.dispatchEvent(new CustomEvent('cart:open'))}
      className="relative rounded-full p-2 text-charcoal transition hover:bg-linen hover:text-rust"
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-6 w-6 fill-none stroke-current"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4.5 7.5h15l-1.4 11.2a1.5 1.5 0 0 1-1.5 1.3H7.4a1.5 1.5 0 0 1-1.5-1.3L4.5 7.5Z" />
        <path d="M9 7.5a3 3 0 0 1 6 0" />
      </svg>
      {itemCount > 0 && (
        <span
          data-testid="cart-count"
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rust px-1 font-body text-xs font-semibold text-cream"
        >
          {itemCount}
        </span>
      )}
    </button>
  );
}
