'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { addLine, itemCount, removeLine, setQuantity, subtotal } from '@/lib/cart';
import type { CartLine } from '@/lib/types';

const STORAGE_KEY = 'ac-cart-v1';

interface CartContextValue {
  lines: CartLine[];
  add: (line: Omit<CartLine, 'lineId'>) => void;
  remove: (lineId: string) => void;
  setQty: (lineId: string, qty: number) => void;
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
      setLines(Array.isArray(parsed) ? (parsed as CartLine[]) : []);
    } catch {
      setLines([]);
    }
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Persist every mutation, but only once we've hydrated so we don't clobber
  // stored state with the initial empty array.
  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
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

  const clear = useCallback(() => {
    setLines([]);
  }, []);

  const value: CartContextValue = {
    lines,
    add,
    remove,
    setQty,
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
