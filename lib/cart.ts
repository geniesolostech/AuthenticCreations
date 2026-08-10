import { MAX_LINE_QUANTITY, MIN_LINE_QUANTITY } from '@/lib/constants';
import type { CartLine } from '@/lib/types';

function clampQuantity(qty: number): number {
  return Math.min(MAX_LINE_QUANTITY, Math.max(MIN_LINE_QUANTITY, qty));
}

/**
 * Adds a line to the cart. Non-custom lines merge into an existing line with
 * the same variationId (quantities are summed). Custom lines are always
 * appended as a new line, even if variationId and color match exactly.
 */
export function addLine(lines: CartLine[], line: Omit<CartLine, 'lineId'>): CartLine[] {
  if (!line.custom) {
    const existingIndex = lines.findIndex((l) => !l.custom && l.variationId === line.variationId);
    if (existingIndex !== -1) {
      const existing = lines[existingIndex];
      const merged: CartLine = { ...existing, quantity: clampQuantity(existing.quantity + line.quantity) };
      const next = [...lines];
      next[existingIndex] = merged;
      return next;
    }
  }

  const newLine: CartLine = { ...line, lineId: crypto.randomUUID(), quantity: clampQuantity(line.quantity) };
  return [...lines, newLine];
}

export function removeLine(lines: CartLine[], lineId: string): CartLine[] {
  return lines.filter((l) => l.lineId !== lineId);
}

/** Sets a line's quantity, clamped to the 1..10 range. */
export function setQuantity(lines: CartLine[], lineId: string, qty: number): CartLine[] {
  return lines.map((l) => (l.lineId === lineId ? { ...l, quantity: clampQuantity(qty) } : l));
}

/** Cart subtotal in cents. */
export function subtotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.unitAmount * l.quantity, 0);
}

/** Total number of items across all lines. */
export function itemCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0);
}
