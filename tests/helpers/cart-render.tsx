import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import { CartProvider, useCart } from '@/lib/cart-context';
import type { CartLine } from '@/lib/types';

/**
 * Mirrors the private `STORAGE_KEY` in `lib/cart-context.tsx`. Seeding storage
 * is the only way to hand the provider a pre-populated cart from outside, and
 * pinning the key here also documents the persistence contract.
 */
const STORAGE_KEY = 'ac-cart-v1';

let nextLineId = 0;

/** A plain cart line with sensible defaults; override whatever the test cares about. */
export function makeLine(overrides: Partial<CartLine> = {}): CartLine {
  nextLineId += 1;
  return {
    lineId: `line-${nextLineId}`,
    variationId: 'var-1',
    name: 'Crochet Beanie',
    unitAmount: 3200,
    quantity: 1,
    ...overrides,
  };
}

/** Renders the live cart as JSON so tests can assert on cart state. */
function CartLinesProbe() {
  const { lines } = useCart();
  return <pre data-testid="cart-lines">{JSON.stringify(lines)}</pre>;
}

/**
 * Renders `ui` inside a `CartProvider` whose localStorage has been seeded with
 * `lines`. The provider hydrates from storage in a mount effect, which
 * `render`'s `act` flushes before this returns.
 */
export function renderWithCart(ui: ReactNode, lines: CartLine[] = []) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  return render(
    <CartProvider>
      {ui}
      <CartLinesProbe />
    </CartProvider>,
  );
}

/** The cart's current lines, as rendered by the probe. */
export function readCartLines(): CartLine[] {
  return JSON.parse(screen.getByTestId('cart-lines').textContent ?? '[]') as CartLine[];
}

/** What the provider has persisted to localStorage. */
export function readStoredLines(): CartLine[] {
  return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as CartLine[];
}
