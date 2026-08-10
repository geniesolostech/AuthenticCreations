import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import CartPage from '@/app/cart/page';
import { makeLine, readCartLines, renderWithCart } from '@/tests/helpers/cart-render';

vi.mock('@/lib/navigate', () => ({
  assignLocation: vi.fn(),
  reloadLocation: vi.fn(),
}));

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('/cart', () => {
  test('empty cart shows the cozy empty state and links to both shop sections', () => {
    renderWithCart(<CartPage />);

    expect(screen.getByText(/your cart is empty — go find something cozy/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /hats/i })).toHaveAttribute('href', '/shop/hats');
    expect(screen.getByRole('link', { name: /accessories/i })).toHaveAttribute('href', '/shop/accessories');
    expect(screen.queryByRole('button', { name: /checkout/i })).not.toBeInTheDocument();
  });

  test('lists the lines with an order summary and the shipping note', () => {
    renderWithCart(<CartPage />, [
      makeLine({ name: 'Crochet Beanie', unitAmount: 3200, quantity: 2 }),
      makeLine({ name: 'Flower Clip', variationId: 'var-2', unitAmount: 1250 }),
    ]);

    expect(screen.getByText('Crochet Beanie')).toBeInTheDocument();
    expect(screen.getByText('Flower Clip')).toBeInTheDocument();
    expect(screen.getByTestId('cart-subtotal')).toHaveTextContent('$76.50');
    expect(screen.getByText(/shipping & tax calculated at checkout/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /checkout/i })).toBeEnabled();
  });

  test('the quantity stepper on the page updates the summary', async () => {
    renderWithCart(<CartPage />, [makeLine({ unitAmount: 3200, quantity: 1 })]);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /increase quantity of crochet beanie/i }));
    });

    expect(readCartLines()[0].quantity).toBe(2);
    expect(screen.getByTestId('cart-subtotal')).toHaveTextContent('$64.00');
  });

  test('a SOLD_OUT checkout marks every affected row on the page', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'SOLD_OUT', soldOutIds: ['var-gone'] }), { status: 409 }),
    );

    renderWithCart(<CartPage />, [
      makeLine({ variationId: 'var-gone', name: 'Sold Out Beanie' }),
      makeLine({ variationId: 'var-gone', name: 'Custom — Sold Out Beanie', custom: { color: 'Red', comments: '' } }),
      makeLine({ variationId: 'var-ok', name: 'Flower Clip' }),
    ]);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /checkout/i }));
    });

    const marked = screen.getAllByTestId('line-sold-out');
    expect(marked).toHaveLength(2);
    for (const mark of marked) {
      expect(mark).toHaveTextContent(/sold out/i);
    }

    const okRow = screen.getByText('Flower Clip').closest('li') as HTMLElement;
    expect(within(okRow).queryByTestId('line-sold-out')).not.toBeInTheDocument();
  });
});
