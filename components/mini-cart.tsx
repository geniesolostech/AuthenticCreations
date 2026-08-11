'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';

import CartEmpty from '@/components/cart-empty';
import CartLineRow from '@/components/cart-line-row';
import CheckoutButton from '@/components/checkout-button';
import { useCart } from '@/lib/cart-context';
import { formatMoney } from '@/lib/money';

/** Everything a keyboard can land on inside the panel, in DOM order. */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The slide-over cart, mounted once in `app/layout.tsx`.
 *
 * It opens on the `cart:open` window event — the single entry point every
 * Add-to-Cart button and the header trigger already use — and closes on Esc,
 * on an overlay click, or on its own close button. While open it traps focus
 * and returns it to whatever opened it.
 */
export default function MiniCart() {
  const { lines, subtotal } = useCart();
  const [open, setOpen] = useState(false);
  const [soldOutIds, setSoldOutIds] = useState<string[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    function handleOpen() {
      setOpen(true);
    }
    window.addEventListener('cart:open', handleOpen);
    return () => window.removeEventListener('cart:open', handleOpen);
  }, []);

  // Move focus in on open, and hand it back to the opener on close.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
    return () => opener?.focus();
  }, [open]);

  // Esc closes; Tab cycles inside the panel rather than wandering the page
  // behind it. Bound to the document so a stray focus can't escape the trap.
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (panel === null) return;

      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const leavingForward = !event.shiftKey && (active === last || !panel.contains(active));
      const leavingBackward = event.shiftKey && (active === first || !panel.contains(active));

      if (leavingForward || leavingBackward) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  // The page behind a slide-over must not scroll with it.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  const close = () => setOpen(false);

  return (
    <>
      {/* Decorative scrim: Esc and the close button are the accessible ways
          out, so screen readers get nothing extra to trip over here. */}
      <div
        data-testid="mini-cart-overlay"
        aria-hidden="true"
        onClick={close}
        className="fixed inset-0 z-40 bg-charcoal/40"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-cream shadow-card"
      >
        <div className="flex items-center justify-between border-b border-linen px-5 py-4">
          <h2 id={titleId} className="font-heading text-xl text-charcoal">
            Your cart
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close cart"
            className="rounded-full p-2 font-body text-sm text-khaki transition hover:text-rust"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-5 w-5 fill-none stroke-current"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5">
          {lines.length === 0 ? (
            <CartEmpty onNavigate={close} />
          ) : (
            <ul className="divide-y divide-linen">
              {lines.map((line) => (
                <CartLineRow
                  key={line.lineId}
                  line={line}
                  soldOut={soldOutIds.includes(line.variationId)}
                />
              ))}
            </ul>
          )}
        </div>

        {/* The checkout button stays put even with nothing in the cart —
            disabled, so the way out is always where the shopper left it. */}
        <div className="flex flex-col gap-3 border-t border-linen px-5 py-4">
          {lines.length > 0 && (
            <>
              <div className="flex items-baseline justify-between">
                <span className="font-body text-sm text-charcoal">Subtotal</span>
                <span data-testid="cart-subtotal" className="font-heading text-xl text-charcoal">
                  {formatMoney(subtotal)}
                </span>
              </div>
              <p className="font-body text-xs text-khaki">shipping &amp; tax calculated at checkout</p>
            </>
          )}
          <CheckoutButton onSoldOutIds={setSoldOutIds} />
          {lines.length > 0 && (
            <Link
              href="/cart"
              onClick={close}
              className="text-center font-body text-sm text-khaki underline underline-offset-2 transition hover:text-rust"
            >
              View cart
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
