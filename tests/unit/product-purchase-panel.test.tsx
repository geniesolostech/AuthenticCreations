import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import ProductPurchasePanel, { type PurchaseOption } from '@/components/product-purchase-panel';
import { CartProvider, useCart } from '@/lib/cart-context';

function CartLinesProbe() {
  const { lines } = useCart();
  return <pre data-testid="lines">{JSON.stringify(lines)}</pre>;
}

function renderWithCart(ui: ReactNode) {
  return render(
    <CartProvider>
      <CartLinesProbe />
      {ui}
    </CartProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  // Untracked in every fixture below, so use-inventory's poll never matters,
  // but stub fetch anyway so an accidental call can't hang the test.
  vi.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ counts: {} }), { status: 200 }));
});

describe('ProductPurchasePanel', () => {
  const flowerOptions: PurchaseOption[] = [
    { label: 'Rose', variationId: 'rose-1', priceCents: 1200, trackInventory: false },
    { label: 'Tulip', variationId: 'tulip-1', priceCents: 1400, trackInventory: false },
    { label: 'Lavender', variationId: 'lavender-1', priceCents: 1300, trackInventory: false },
  ];

  test('defaults to the first variant', () => {
    renderWithCart(<ProductPurchasePanel productName="Crochet Flower" options={flowerOptions} />);

    expect(screen.getByText('$12.00')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Rose' })).toBeChecked();
  });

  test('selecting a variant switches the displayed price and the line added to cart', async () => {
    const user = userEvent.setup();
    renderWithCart(<ProductPurchasePanel productName="Crochet Flower" options={flowerOptions} />);

    await user.click(screen.getByRole('radio', { name: 'Tulip' }));
    expect(screen.getByText('$14.00')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /add to cart/i }));

    const lines = JSON.parse(screen.getByTestId('lines').textContent ?? '[]');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ variationId: 'tulip-1', unitAmount: 1400 });
  });

  test('does not render a variant picker for a single-option product', () => {
    renderWithCart(
      <ProductPurchasePanel
        productName="Crochet Beanie"
        options={[{ label: 'Crochet Beanie', variationId: 'v-1', priceCents: 2000, trackInventory: false }]}
      />,
    );

    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  test('shows the sold-out badge and disables Add to Cart for a sold-out tracked variant', async () => {
    renderWithCart(
      <ProductPurchasePanel
        productName="Crochet Beanie"
        options={[
          { label: 'Crochet Beanie', variationId: 'v-1', priceCents: 2000, trackInventory: true, initialCount: 0 },
        ]}
      />,
    );
    // trackInventory:true means use-inventory issues a live poll; flush it so
    // the effect's state update lands inside act() before we assert.
    await act(async () => {
      await Promise.resolve();
    });

    // Both the badge and the (relabeled) button read "Sold out".
    expect(screen.getAllByText(/sold out/i)).toHaveLength(2);
    expect(screen.getByRole('button', { name: /sold out/i })).toBeDisabled();
  });

  test('shows "price at checkout" and disables Add to Cart when the price is unknown', () => {
    renderWithCart(
      <ProductPurchasePanel
        productName="Crochet Beanie"
        options={[{ label: 'Crochet Beanie', variationId: 'v-1', priceCents: null, trackInventory: false }]}
      />,
    );

    expect(screen.getByText(/price at checkout/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add to cart/i })).toBeDisabled();
  });

  test('adds no piece to the line for a product that is not sold by piece', async () => {
    const user = userEvent.setup();
    renderWithCart(
      <ProductPurchasePanel
        productName="Crochet Beanie"
        options={[{ label: 'Crochet Beanie', variationId: 'v-1', priceCents: 3200, trackInventory: false }]}
      />,
    );

    await user.click(screen.getByRole('button', { name: /add to cart/i }));

    const lines = JSON.parse(screen.getByTestId('lines').textContent ?? '[]');
    expect(lines[0]).toMatchObject({ name: 'Crochet Beanie', quantity: 1 });
    expect(lines[0]).not.toHaveProperty('piece');
  });
});

describe('ProductPurchasePanel — sold by piece', () => {
  const bag: PurchaseOption[] = [
    { label: 'Crochet slouch bag', variationId: 'bag-1', priceCents: 6500, trackInventory: false },
  ];

  test('names the line for the chosen piece and carries the piece onto it', async () => {
    const user = userEvent.setup();
    renderWithCart(
      <ProductPurchasePanel
        productName="Crochet slouch bag"
        options={bag}
        piece={{ number: 1, label: 'Sunset' }}
      />,
    );

    await user.click(screen.getByRole('button', { name: /add to cart/i }));

    const lines = JSON.parse(screen.getByTestId('lines').textContent ?? '[]');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      variationId: 'bag-1',
      name: 'Crochet slouch bag — Sunset',
      quantity: 1,
      piece: { number: 1, label: 'Sunset' },
    });
  });

  test('numbers an unnamed piece by its position', async () => {
    const user = userEvent.setup();
    renderWithCart(
      <ProductPurchasePanel productName="Crochet slouch bag" options={bag} piece={{ number: 2 }} />,
    );

    await user.click(screen.getByRole('button', { name: /add to cart/i }));

    const lines = JSON.parse(screen.getByTestId('lines').textContent ?? '[]');
    expect(lines[0].name).toBe('Crochet slouch bag — Piece 2');
  });

  test('disables the buy button exactly like a sold-out product when every piece is sold', async () => {
    const user = userEvent.setup();
    // Square still counts stock for this variation — it counts pieces without
    // naming them — so only the seller's per-piece marks can answer this.
    renderWithCart(
      <ProductPurchasePanel productName="Crochet slouch bag" options={bag} allPiecesSold />,
    );

    expect(screen.getAllByText(/sold out/i)).toHaveLength(2);
    const button = screen.getByRole('button', { name: /sold out/i });
    expect(button).toBeDisabled();

    await user.click(button);
    expect(JSON.parse(screen.getByTestId('lines').textContent ?? '[]')).toHaveLength(0);
  });
});
