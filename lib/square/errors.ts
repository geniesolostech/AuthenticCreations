/**
 * Error taxonomy for the Square layer.
 *
 * Two distinct kinds of failure live here:
 *
 * 1. `CheckoutErrorCode` — the closed set of *expected* checkout outcomes that
 *    the UI must be able to explain to a buyer. `createCheckout` never throws
 *    for these; it returns them. Callers are expected to switch exhaustively.
 * 2. `SquareGatewayError` — an *unexpected* failure while talking to Square
 *    (network, auth, malformed response). The gateway throws these; the service
 *    catches anything thrown and collapses it to `SQUARE_UNAVAILABLE` so that a
 *    Square outage can never leak an SDK stack trace into a route response.
 *
 * This file deliberately imports nothing — neither the Square SDK nor the
 * service — so both sides can depend on it.
 */

/**
 * Every failure mode the checkout flow can report to the buyer.
 *
 * - `EMPTY_CART` — nothing to buy.
 * - `SOLD_OUT` — an inventory-tracked variation no longer has enough on hand
 *   (or has vanished from the catalog). Accompanied by `soldOutIds`.
 *   Made-to-order (untracked) variations can never produce this.
 * - `PRICE_CHANGED` — the catalog price moved after the item was added to the
 *   cart. The buyer must re-confirm at the new price; we never silently charge
 *   a different amount than the cart showed.
 * - `SQUARE_UNAVAILABLE` — anything else. Square threw, returned nonsense, or
 *   the deployment is misconfigured. Always safe to retry.
 */
export const CHECKOUT_ERROR_CODES = [
  'EMPTY_CART',
  'SOLD_OUT',
  'PRICE_CHANGED',
  'SQUARE_UNAVAILABLE',
] as const;

export type CheckoutErrorCode = (typeof CHECKOUT_ERROR_CODES)[number];

/** Narrows an unknown value (e.g. a JSON field) to a known checkout error code. */
export function isCheckoutErrorCode(value: unknown): value is CheckoutErrorCode {
  return (
    typeof value === 'string' && (CHECKOUT_ERROR_CODES as readonly string[]).includes(value)
  );
}

/**
 * Thrown by `lib/square/gateway.ts` when a Square call cannot be completed or
 * its response cannot be trusted. Never returned to a buyer directly — the
 * service turns it into `SQUARE_UNAVAILABLE`.
 */
export class SquareGatewayError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'SquareGatewayError';
  }
}
