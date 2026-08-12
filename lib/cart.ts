import { MAX_LINE_QUANTITY, MIN_LINE_QUANTITY } from '@/lib/constants';
import type { CartLine } from '@/lib/types';

/**
 * A piece line is one physical object that exists exactly once, so its ceiling
 * is 1 rather than the shared `MAX_LINE_QUANTITY`. Everything the stepper and
 * the merge below do about quantity asks here, so there is one answer.
 */
export function maxQuantityFor(line: Pick<CartLine, 'piece'>): number {
  return line.piece === undefined ? MAX_LINE_QUANTITY : MIN_LINE_QUANTITY;
}

function clampQuantity(qty: number, max: number = MAX_LINE_QUANTITY): number {
  return Math.min(max, Math.max(MIN_LINE_QUANTITY, qty));
}

/**
 * Whether two lines are the same piece — including "neither is a piece", which
 * is what keeps ordinary lines merging as they always have.
 *
 * Every piece of a product shares one Square variation id, so variation alone
 * cannot tell piece 1 from piece 3; the piece number has to join the line
 * identity or the two would merge into a single line of two.
 */
function samePiece(a: CartLine['piece'], b: CartLine['piece']): boolean {
  return a?.number === b?.number;
}

/**
 * Adds a line to the cart. Non-custom lines merge into an existing line with
 * the same variationId *and* the same piece (quantities are summed, then
 * clamped — so adding a piece already in the cart leaves it at 1 rather than
 * duplicating the row). Custom lines are always appended as a new line, even if
 * variationId and color match exactly.
 */
export function addLine(lines: CartLine[], line: Omit<CartLine, 'lineId'>): CartLine[] {
  if (!line.custom) {
    const existingIndex = lines.findIndex(
      (l) => !l.custom && l.variationId === line.variationId && samePiece(l.piece, line.piece),
    );
    if (existingIndex !== -1) {
      const existing = lines[existingIndex];
      const merged: CartLine = {
        ...existing,
        quantity: clampQuantity(existing.quantity + line.quantity, maxQuantityFor(existing)),
      };
      const next = [...lines];
      next[existingIndex] = merged;
      return next;
    }
  }

  const newLine: CartLine = {
    ...line,
    lineId: crypto.randomUUID(),
    quantity: clampQuantity(line.quantity, maxQuantityFor(line)),
  };
  return [...lines, newLine];
}

export function removeLine(lines: CartLine[], lineId: string): CartLine[] {
  return lines.filter((l) => l.lineId !== lineId);
}

/** Sets a line's quantity, clamped to the 1..10 range — or to exactly 1 on a
 * piece line, which is one physical object. */
export function setQuantity(lines: CartLine[], lineId: string, qty: number): CartLine[] {
  return lines.map((l) =>
    l.lineId === lineId ? { ...l, quantity: clampQuantity(qty, maxQuantityFor(l)) } : l,
  );
}

/**
 * Applies fresh catalog prices (cents, keyed by Square variation id) to every
 * line carrying one of those variations.
 *
 * This is the way out of a `PRICE_CHANGED` refusal. A line's `unitAmount` is
 * captured when it goes into the cart and then persisted, so on its own it
 * never becomes right again — the shopper retries, sends the same stale
 * number, and is refused again. `/api/checkout` returns the real prices with
 * the 409 and this puts them where the next attempt will read them.
 *
 * Prices come from a parsed JSON body, so anything that is not a finite number
 * of cents is ignored rather than trusted. Returns the *same array* when
 * nothing moved, so an unchanged cart neither re-renders nor rewrites storage.
 */
export function repriceLines(lines: CartLine[], prices: Record<string, number>): CartLine[] {
  let changed = false;
  const next = lines.map((line) => {
    const price = prices[line.variationId];
    if (typeof price !== 'number' || !Number.isFinite(price)) return line;
    if (price === line.unitAmount) return line;
    changed = true;
    return { ...line, unitAmount: price };
  });
  return changed ? next : lines;
}

/** Cart subtotal in cents. */
export function subtotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.unitAmount * l.quantity, 0);
}

/** Total number of items across all lines. */
export function itemCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0);
}
