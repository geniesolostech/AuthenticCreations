'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { useCart } from '@/lib/cart-context';
import { MAX_CART_LINES } from '@/lib/constants';
import { assignLocation, reloadLocation } from '@/lib/navigate';

/** How long the "prices were updated" notice sits before the page reloads —
 * long enough to read, short enough that nobody wonders what happened. */
const PRICE_CHANGED_RELOAD_DELAY_MS = 2000;

/**
 * Whether a checkout POST is in flight, deliberately held *outside* React.
 *
 * Two situations make per-component state the wrong home for this flag, and
 * both end the same way — two Square orders for one shopper:
 *  - the mini-cart unmounts its whole subtree when it closes, so "click
 *    Checkout, press Esc, reopen, click again" would meet a brand-new button
 *    with a brand-new guard while the first POST is still open;
 *  - `/cart` renders a button of its own, and the header trigger can open the
 *    mini-cart on top of it, putting two live buttons on screen at once.
 *
 * Every mounted button subscribes, so they all show the same pending state
 * rather than one of them silently swallowing clicks.
 */
let checkoutInFlight = false;
const inFlightListeners = new Set<() => void>();

function setCheckoutInFlight(value: boolean): void {
  checkoutInFlight = value;
  for (const listener of inFlightListeners) listener();
}

function subscribeInFlight(listener: () => void): () => void {
  inFlightListeners.add(listener);
  return () => {
    inFlightListeners.delete(listener);
  };
}

const getInFlight = () => checkoutInFlight;
/** Server render: nothing can be in flight before the page is interactive. */
const getInFlightOnServer = () => false;

/** Test seam: the flag outlives any one component, so tests must reset it. */
export function _resetCheckoutInFlightForTests(): void {
  checkoutInFlight = false;
}

/**
 * Every way this button can end up not on Square's payment page. `soldOut`
 * carries the variation ids so the "remove sold-out items" affordance can act
 * on exactly the lines Square turned down.
 */
type Status =
  | { kind: 'idle' }
  | { kind: 'soldOut'; ids: string[] }
  | { kind: 'priceChanged' }
  | { kind: 'unavailable' }
  | { kind: 'offline' }
  | { kind: 'generic' };

const MESSAGES = {
  soldOut: 'oh no — something in your cart just sold out.',
  priceChanged: 'prices were updated — please review your cart.',
  unavailable: "Square's having a moment — try again shortly.",
  offline: "we couldn't reach checkout — check your connection and try again.",
  generic: 'something looked off — please refresh and try again.',
} as const;

const OVER_LIMIT_MESSAGE = `your cart has more than ${MAX_CART_LINES} different items — take a few out and we'll get you checked out.`;

export interface CheckoutButtonProps {
  /** Receives the variation ids Square reported sold out — and `[]` when that
   * mark is cleared — so the surrounding cart can flag the affected rows. */
  onSoldOutIds?: (ids: string[]) => void;
  className?: string;
}

/**
 * The handoff to Square. POSTs the cart to `/api/checkout` and, on success,
 * sends the browser to the returned payment link.
 *
 * The cart is deliberately *not* cleared here: a shopper who backs out of
 * Square's page must come back to the cart they left. Only `/thanks` empties it.
 */
export default function CheckoutButton({ onSoldOutIds, className }: CheckoutButtonProps) {
  const { lines, remove } = useCart();
  const pending = useSyncExternalStore(subscribeInFlight, getInFlight, getInFlightOnServer);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => clearReloadTimer(), []);

  // Firefox and Safari restore this page — and this component's state — from
  // the bfcache when a shopper backs out of Square's payment page. Without
  // this, the cart we deliberately preserved would greet them with a checkout
  // button stuck at "heading to checkout…".
  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (!event.persisted) return;
      setCheckoutInFlight(false);
    }
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  function clearReloadTimer() {
    if (reloadTimer.current !== null) {
      clearTimeout(reloadTimer.current);
      reloadTimer.current = null;
    }
  }

  const overLimit = lines.length > MAX_CART_LINES;
  const disabled = pending || lines.length === 0 || overLimit;

  function fail(next: Status) {
    setStatus(next);
    setCheckoutInFlight(false);
  }

  async function handleClick() {
    // The module-level flag, not `pending`, is the guard: a second click can
    // land in the same tick, before React has re-rendered the disabled button.
    if (disabled || checkoutInFlight) return;
    setCheckoutInFlight(true);
    setStatus({ kind: 'idle' });
    // A reload armed by a previous PRICE_CHANGED must not survive this
    // attempt: left running it would either double up with the next one or,
    // worse, preempt the navigation to Square that this click is about to win.
    clearReloadTimer();
    onSoldOutIds?.([]);

    let response: Response;
    try {
      response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines }),
      });
    } catch (error) {
      console.error('[checkout] request failed', error);
      fail({ kind: 'offline' });
      return;
    }

    const body: unknown = await response.json().catch(() => null);
    const payload = (body ?? {}) as { url?: unknown; error?: unknown; soldOutIds?: unknown };

    if (response.ok) {
      if (typeof payload.url === 'string' && payload.url !== '') {
        // Leave `pending` set: the browser is on its way to Square, and
        // re-enabling the button here would invite a second order.
        assignLocation(payload.url);
        return;
      }
      fail({ kind: 'generic' });
      return;
    }

    const code = typeof payload.error === 'string' ? payload.error : null;

    if (response.status === 409 && code === 'SOLD_OUT') {
      const ids = Array.isArray(payload.soldOutIds)
        ? payload.soldOutIds.filter((id): id is string => typeof id === 'string')
        : [];
      onSoldOutIds?.(ids);
      fail({ kind: 'soldOut', ids });
      return;
    }

    if (response.status === 409 && code === 'PRICE_CHANGED') {
      fail({ kind: 'priceChanged' });
      // A beat to read the notice, then fresh prices from the server.
      reloadTimer.current = setTimeout(reloadLocation, PRICE_CHANGED_RELOAD_DELAY_MS);
      return;
    }

    fail({ kind: response.status === 503 ? 'unavailable' : 'generic' });
  }

  function handleRemoveSoldOut() {
    if (status.kind !== 'soldOut') return;
    const soldOut = new Set(status.ids);
    for (const line of lines) {
      if (soldOut.has(line.variationId)) remove(line.lineId);
    }
    onSoldOutIds?.([]);
    setStatus({ kind: 'idle' });
  }

  function handleReloadNow() {
    clearReloadTimer();
    reloadLocation();
  }

  return (
    <div className={`flex flex-col gap-3${className ? ` ${className}` : ''}`}>
      {overLimit && <p className="font-body text-sm text-rust">{OVER_LIMIT_MESSAGE}</p>}

      {status.kind !== 'idle' && (
        <div role="alert" className="flex flex-col gap-2 rounded-xl bg-linen px-4 py-3">
          <p className="font-body text-sm text-charcoal">{MESSAGES[status.kind]}</p>
          {status.kind === 'soldOut' && status.ids.length > 0 && (
            <button
              type="button"
              onClick={handleRemoveSoldOut}
              className="self-start font-body text-sm font-semibold text-rust underline underline-offset-2"
            >
              Remove sold-out items
            </button>
          )}
          {status.kind === 'priceChanged' && (
            <button
              type="button"
              onClick={handleReloadNow}
              className="self-start font-body text-sm font-semibold text-rust underline underline-offset-2"
            >
              Refresh now
            </button>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className="rounded-full bg-rust px-6 py-3 font-body text-sm font-semibold text-cream transition hover:bg-rust-soft disabled:cursor-not-allowed disabled:bg-khaki disabled:hover:bg-khaki"
      >
        {pending ? 'heading to checkout…' : 'Checkout'}
      </button>
    </div>
  );
}
