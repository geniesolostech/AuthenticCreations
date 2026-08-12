'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { addLine, itemCount, removeLine, repriceLines, setQuantity, subtotal } from '@/lib/cart';
import type { CartLine, CustomColor } from '@/lib/types';

const STORAGE_KEY = 'ac-cart-v1';

/**
 * A cart line as it comes back out of storage, which may predate the running
 * build: carts live in the shopper's browser across deploys.
 *
 * The one field that has moved is `custom.color`, a single color, which is now
 * `custom.colors`, a list of one to three. Both are read here so a cart filled
 * before that deploy still shows its color and still checks out.
 */
type StoredCartLine = Omit<CartLine, 'custom'> & {
  custom?: { color?: CustomColor; colors?: CustomColor[]; comments: string };
};

/**
 * Stored lines in the shape the rest of the app works in: a legacy single
 * color becomes a one-color list, and the old field is dropped rather than
 * carried alongside the new one, so nothing past this border has two places to
 * look for a color.
 */
function migrateStoredLines(lines: StoredCartLine[]): CartLine[] {
  return lines.map(({ custom, ...line }) => {
    if (custom === undefined) return line;
    // The empty fallback is unreachable from any cart this app has written —
    // but storage is the shopper's to edit, and a missing list would read as
    // `undefined.length` in the cart row.
    const colors = custom.colors ?? (custom.color === undefined ? [] : [custom.color]);
    return { ...line, custom: { colors, comments: custom.comments } };
  });
}

interface CartContextValue {
  lines: CartLine[];
  add: (line: Omit<CartLine, 'lineId'>) => void;
  remove: (lineId: string) => void;
  setQty: (lineId: string, qty: number) => void;
  /**
   * Replaces the stored unit price of every line carrying one of the given
   * variations. `/api/checkout` supplies the map when it refuses a checkout
   * with `PRICE_CHANGED`; see `repriceLines` for why the cart cannot recover
   * without it.
   */
  reprice: (prices: Record<string, number>) => void;
  clear: () => void;
  subtotal: number;
  itemCount: number;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage after mount so the client render matches the
  // server render on first paint (avoids an SSR hydration mismatch). This is
  // a deliberate one-time sync with an external store on mount, not a derived
  // state update, so the general set-state-in-effect advice doesn't apply.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      setLines(Array.isArray(parsed) ? migrateStoredLines(parsed as StoredCartLine[]) : []);
    } catch {
      setLines([]);
    }
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Persist every mutation, but only once we've hydrated so we don't clobber
  // stored state with the initial empty array. setItem can throw (e.g. quota
  // exceeded in Safari private browsing); since CartProvider wraps the whole
  // app, an uncaught throw here would take down more than just the cart, so
  // we no-op on failure the same way the read path does.
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // Persistence is best-effort; in-memory cart state still works.
    }
  }, [lines, hydrated]);

  const add = useCallback((line: Omit<CartLine, 'lineId'>) => {
    setLines((prev) => addLine(prev, line));
  }, []);

  const remove = useCallback((lineId: string) => {
    setLines((prev) => removeLine(prev, lineId));
  }, []);

  const setQty = useCallback((lineId: string, qty: number) => {
    setLines((prev) => setQuantity(prev, lineId, qty));
  }, []);

  const reprice = useCallback((prices: Record<string, number>) => {
    // `repriceLines` returns the same array when nothing moved, so React bails
    // out of the update and the persistence effect below does not re-fire.
    setLines((prev) => repriceLines(prev, prices));
  }, []);

  const clear = useCallback(() => {
    setLines([]);
  }, []);

  const value: CartContextValue = {
    lines,
    add,
    remove,
    setQty,
    reprice,
    clear,
    subtotal: subtotal(lines),
    itemCount: itemCount(lines),
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
