import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import AddToCart from '@/components/add-to-cart';
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

function readLines(): unknown[] {
  return JSON.parse(screen.getByTestId('lines').textContent ?? '[]');
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('AddToCart', () => {
  test('click adds the correct CartLine to the cart and fires cart:open', async () => {
    const user = userEvent.setup();
    const openSpy = vi.fn();
    window.addEventListener('cart:open', openSpy);

    renderWithCart(
      <AddToCart
        variationId="var-1"
        name="Crochet Beanie"
        priceCents={3200}
        imageUrl="https://cdn.test/img.jpg"
      />,
    );

    await user.click(screen.getByRole('button', { name: /add to cart/i }));

    const lines = readLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      variationId: 'var-1',
      name: 'Crochet Beanie',
      unitAmount: 3200,
      quantity: 1,
      imageUrl: 'https://cdn.test/img.jpg',
    });
    expect(openSpy).toHaveBeenCalledTimes(1);

    window.removeEventListener('cart:open', openSpy);
  });

  test('is disabled with an accessible name matching /sold out/i when soldOut', () => {
    renderWithCart(<AddToCart variationId="var-1" name="Crochet Beanie" priceCents={3200} soldOut />);

    const button = screen.getByRole('button', { name: /sold out/i });
    expect(button).toBeDisabled();
  });

  test('sold-out click never adds a line', async () => {
    const user = userEvent.setup();
    renderWithCart(<AddToCart variationId="var-1" name="Crochet Beanie" priceCents={3200} soldOut />);

    await user.click(screen.getByRole('button', { name: /sold out/i }));

    expect(readLines()).toHaveLength(0);
  });

  test('is disabled (but still labeled Add to Cart) when the price is unknown', () => {
    renderWithCart(<AddToCart variationId="var-1" name="Crochet Beanie" priceCents={null} />);

    expect(screen.getByRole('button', { name: /add to cart/i })).toBeDisabled();
  });

  test('honors an explicit disabled prop', () => {
    renderWithCart(<AddToCart variationId="var-1" name="Crochet Beanie" priceCents={3200} disabled />);

    expect(screen.getByRole('button', { name: /add to cart/i })).toBeDisabled();
  });
});
