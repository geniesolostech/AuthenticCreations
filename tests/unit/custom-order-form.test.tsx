import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import CustomOrderForm, { type CustomProductOption } from '@/components/custom-order-form';
import { CUSTOM_COLOR_SWATCHES, CUSTOM_COLORS, CUSTOM_COMMENTS_MAX } from '@/lib/constants';
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

const products: CustomProductOption[] = [
  { id: 'p1', title: 'Custom Beanie', customVariationId: 'cust-beanie-1', priceCents: 4500 },
  { id: 'p2', title: 'Custom Scarf', customVariationId: 'cust-scarf-1', priceCents: 6000 },
];

beforeEach(() => {
  window.localStorage.clear();
});

describe('CUSTOM_COLOR_SWATCHES', () => {
  test('has exactly the 8 CUSTOM_COLORS as keys, each a hex string', () => {
    expect(Object.keys(CUSTOM_COLOR_SWATCHES).sort()).toEqual([...CUSTOM_COLORS].sort());
    for (const color of CUSTOM_COLORS) {
      expect(CUSTOM_COLOR_SWATCHES[color]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  test('matches the exact hexes from the brief', () => {
    expect(CUSTOM_COLOR_SWATCHES.Black).toBe('#1A1A1A');
    expect(CUSTOM_COLOR_SWATCHES.White).toBe('#FAFAF7');
    expect(CUSTOM_COLOR_SWATCHES.Red).toBe('#B3372F');
    expect(CUSTOM_COLOR_SWATCHES.Orange).toBe('#D97829');
    expect(CUSTOM_COLOR_SWATCHES.Yellow).toBe('#E3B341');
    expect(CUSTOM_COLOR_SWATCHES.Green).toBe('#5F7D45');
    expect(CUSTOM_COLOR_SWATCHES.Blue).toBe('#3E6B8C');
    expect(CUSTOM_COLOR_SWATCHES.Purple).toBe('#6D5382');
  });
});

describe('CustomOrderForm', () => {
  test('submitting without a color shows a validation message and adds nothing', async () => {
    const user = userEvent.setup();
    renderWithCart(<CustomOrderForm products={products} />);

    await user.click(screen.getByRole('button', { name: /add to cart/i }));

    expect(screen.getByText('pick a color for your piece')).toBeInTheDocument();
    expect(readLines()).toHaveLength(0);
  });

  test('adds a line with the exact custom fields once a color and comments are given', async () => {
    const user = userEvent.setup();
    renderWithCart(<CustomOrderForm products={products} />);

    await user.click(screen.getByRole('button', { name: 'Red' }));
    await user.type(screen.getByLabelText(/tell us what you have in mind/i), 'Extra fringe please');
    await user.click(screen.getByRole('button', { name: /add to cart/i }));

    const lines = readLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      variationId: 'cust-beanie-1',
      name: 'Custom — Custom Beanie',
      unitAmount: 4500,
      quantity: 1,
      custom: { color: 'Red', comments: 'Extra fringe please' },
    });
    // Validation message clears once the order actually goes through.
    expect(screen.queryByText('pick a color for your piece')).not.toBeInTheDocument();
  });

  test('the comments counter shows characters typed over the 500 max', async () => {
    const user = userEvent.setup();
    renderWithCart(<CustomOrderForm products={products} />);

    expect(screen.getByText(`0/${CUSTOM_COMMENTS_MAX}`)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/tell us what you have in mind/i), 'Hello');

    expect(screen.getByText(`5/${CUSTOM_COMMENTS_MAX}`)).toBeInTheDocument();
  });

  test(
    'typing past 500 characters is capped — the 501st character is ignored',
    async () => {
      const user = userEvent.setup({ delay: null });
      renderWithCart(<CustomOrderForm products={products} />);

      const longText = 'a'.repeat(CUSTOM_COMMENTS_MAX + 1);
      const textarea = screen.getByLabelText(/tell us what you have in mind/i) as HTMLTextAreaElement;
      await user.type(textarea, longText);

      expect(textarea.value).toHaveLength(CUSTOM_COMMENTS_MAX);
      expect(screen.getByText(`${CUSTOM_COMMENTS_MAX}/${CUSTOM_COMMENTS_MAX}`)).toBeInTheDocument();
    },
    15000,
  );

  test('changing the product select updates the displayed price', async () => {
    const user = userEvent.setup();
    renderWithCart(<CustomOrderForm products={products} />);

    expect(screen.getByText('$45.00')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/choose a piece/i), 'p2');

    expect(screen.getByText('$60.00')).toBeInTheDocument();
    expect(screen.queryByText('$45.00')).not.toBeInTheDocument();
  });

  test('fires cart:open on successful add', async () => {
    const user = userEvent.setup();
    const openSpy = vi.fn();
    window.addEventListener('cart:open', openSpy);

    renderWithCart(<CustomOrderForm products={products} />);
    await user.click(screen.getByRole('button', { name: 'Blue' }));
    await user.click(screen.getByRole('button', { name: /add to cart/i }));

    expect(openSpy).toHaveBeenCalledTimes(1);
    window.removeEventListener('cart:open', openSpy);
  });

  test('aria-pressed toggles as a different swatch is selected', async () => {
    const user = userEvent.setup();
    renderWithCart(<CustomOrderForm products={products} />);

    const green = screen.getByRole('button', { name: 'Green' });
    const purple = screen.getByRole('button', { name: 'Purple' });
    expect(green).toHaveAttribute('aria-pressed', 'false');
    expect(purple).toHaveAttribute('aria-pressed', 'false');

    await user.click(green);
    expect(green).toHaveAttribute('aria-pressed', 'true');
    expect(purple).toHaveAttribute('aria-pressed', 'false');

    await user.click(purple);
    expect(green).toHaveAttribute('aria-pressed', 'false');
    expect(purple).toHaveAttribute('aria-pressed', 'true');
  });

  test('a color can be selected via the keyboard', async () => {
    const user = userEvent.setup();
    renderWithCart(<CustomOrderForm products={products} />);

    const yellow = screen.getByRole('button', { name: 'Yellow' });
    yellow.focus();
    await user.keyboard('{Enter}');

    expect(yellow).toHaveAttribute('aria-pressed', 'true');
  });

  test('renders all 8 swatch buttons with visible color names', () => {
    renderWithCart(<CustomOrderForm products={products} />);

    for (const color of CUSTOM_COLORS) {
      expect(screen.getByRole('button', { name: color })).toBeInTheDocument();
    }
  });
});
