import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test } from 'vitest';

import CartTrigger from '@/components/cart-trigger';
import MiniCart from '@/components/mini-cart';
import { makeLine, readCartLines, renderWithCart } from '@/tests/helpers/cart-render';
import type { CartLine } from '@/lib/types';

/** Trigger + panel together — how `app/layout.tsx` mounts them. */
function renderCartUi(lines: CartLine[] = []) {
  return renderWithCart(
    <>
      <CartTrigger />
      <MiniCart />
    </>,
    lines,
  );
}

function panel() {
  return screen.getByRole('dialog', { name: /your cart/i });
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('CartTrigger', () => {
  test('shows no count bubble when the cart is empty', () => {
    renderCartUi();

    expect(screen.getByRole('button', { name: /cart/i })).toBeInTheDocument();
    expect(screen.queryByTestId('cart-count')).not.toBeInTheDocument();
  });

  test('bubble reflects itemCount across lines', () => {
    renderCartUi([makeLine({ quantity: 2 }), makeLine({ variationId: 'var-2', quantity: 3 })]);

    expect(screen.getByTestId('cart-count')).toHaveTextContent('5');
    expect(screen.getByRole('button', { name: /5 items/i })).toBeInTheDocument();
  });

  test('names a single item in the singular', () => {
    renderCartUi([makeLine({ quantity: 1 })]);

    expect(screen.getByRole('button', { name: /1 item(?!s)/i })).toBeInTheDocument();
  });
});

describe('MiniCart open/close', () => {
  test('is closed until something opens it', () => {
    renderCartUi([makeLine()]);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('opens on the cart:open event', () => {
    renderCartUi([makeLine()]);

    act(() => {
      window.dispatchEvent(new CustomEvent('cart:open'));
    });

    expect(panel()).toBeInTheDocument();
  });

  test('opens on the header trigger click', async () => {
    const user = userEvent.setup();
    renderCartUi([makeLine()]);

    await user.click(screen.getByRole('button', { name: /cart/i }));

    expect(panel()).toBeInTheDocument();
  });

  test('Escape closes it', async () => {
    const user = userEvent.setup();
    renderCartUi([makeLine()]);

    await user.click(screen.getByRole('button', { name: /cart/i }));
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('a click on the overlay closes it', async () => {
    const user = userEvent.setup();
    renderCartUi([makeLine()]);

    await user.click(screen.getByRole('button', { name: /cart/i }));
    await user.click(screen.getByTestId('mini-cart-overlay'));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('the close button closes it and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    renderCartUi([makeLine()]);

    const trigger = screen.getByRole('button', { name: /cart/i });
    await user.click(trigger);
    await user.click(within(panel()).getByRole('button', { name: /close/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });
});

describe('MiniCart focus trap', () => {
  test('moves focus into the panel when it opens', async () => {
    const user = userEvent.setup();
    renderCartUi([makeLine()]);

    await user.click(screen.getByRole('button', { name: /cart/i }));

    expect(panel().contains(document.activeElement)).toBe(true);
  });

  test('Tab cycles within the panel instead of escaping to the page', async () => {
    const user = userEvent.setup();
    renderCartUi([makeLine()]);

    await user.click(screen.getByRole('button', { name: /cart/i }));

    // More tabs than there are focusable controls: without a trap, focus would
    // have walked out into the document (and onto the trigger) long before now.
    for (let i = 0; i < 12; i += 1) {
      await user.tab();
      expect(panel().contains(document.activeElement)).toBe(true);
    }
  });

  test('Shift+Tab also stays inside the panel', async () => {
    const user = userEvent.setup();
    renderCartUi([makeLine()]);

    await user.click(screen.getByRole('button', { name: /cart/i }));

    for (let i = 0; i < 12; i += 1) {
      await user.tab({ shift: true });
      expect(panel().contains(document.activeElement)).toBe(true);
    }
  });
});

describe('MiniCart contents', () => {
  test('lists each line with its name and line total', async () => {
    const user = userEvent.setup();
    renderCartUi([
      makeLine({ name: 'Crochet Beanie', unitAmount: 3200, quantity: 2 }),
      makeLine({ name: 'Flower Clip', variationId: 'var-2', unitAmount: 1250 }),
    ]);

    await user.click(screen.getByRole('button', { name: /cart/i }));

    const scope = within(panel());
    expect(scope.getByText('Crochet Beanie')).toBeInTheDocument();
    expect(scope.getByText('$64.00')).toBeInTheDocument();
    expect(scope.getByText('Flower Clip')).toBeInTheDocument();
    expect(scope.getByText('$12.50')).toBeInTheDocument();
  });

  test('shows the color and comments of a custom line', async () => {
    const user = userEvent.setup();
    renderCartUi([
      makeLine({
        name: 'Custom — Crochet Beanie',
        custom: { color: 'Purple', comments: 'please add a big pom pom on top' },
      }),
    ]);

    await user.click(screen.getByRole('button', { name: /cart/i }));

    const scope = within(panel());
    expect(scope.getByText(/color: purple/i)).toBeInTheDocument();
    expect(scope.getByText(/big pom pom/i)).toBeInTheDocument();
  });

  test('clamps a long custom comment visually rather than cutting the text', async () => {
    const user = userEvent.setup();
    const comments = 'x'.repeat(400);
    renderCartUi([makeLine({ custom: { color: 'Blue', comments } })]);

    await user.click(screen.getByRole('button', { name: /cart/i }));

    const note = within(panel()).getByText(comments);
    expect(note).toHaveClass('line-clamp-2');
  });

  test('shows the subtotal and the shipping & tax note', async () => {
    const user = userEvent.setup();
    renderCartUi([makeLine({ unitAmount: 3200, quantity: 2 }), makeLine({ variationId: 'var-2', unitAmount: 1250 })]);

    await user.click(screen.getByRole('button', { name: /cart/i }));

    const scope = within(panel());
    expect(scope.getByTestId('cart-subtotal')).toHaveTextContent('$76.50');
    expect(scope.getByText(/shipping & tax calculated at checkout/i)).toBeInTheDocument();
  });

  test('links through to the full cart page', async () => {
    const user = userEvent.setup();
    renderCartUi([makeLine()]);

    await user.click(screen.getByRole('button', { name: /cart/i }));

    expect(within(panel()).getByRole('link', { name: /view cart/i })).toHaveAttribute('href', '/cart');
  });

  test('empty cart shows the cozy empty state, both shop links, and no checkout button', async () => {
    const user = userEvent.setup();
    renderCartUi();

    await user.click(screen.getByRole('button', { name: /cart/i }));

    const scope = within(panel());
    expect(scope.getByText(/your cart is empty — go find something cozy/i)).toBeInTheDocument();
    expect(scope.getByRole('link', { name: /hats/i })).toHaveAttribute('href', '/shop/hats');
    expect(scope.getByRole('link', { name: /accessories/i })).toHaveAttribute('href', '/shop/accessories');
    expect(scope.queryByRole('button', { name: /checkout/i })).not.toBeInTheDocument();
  });
});

describe('CartLineRow quantity stepper', () => {
  test('increment raises the quantity and the line total', async () => {
    const user = userEvent.setup();
    renderCartUi([makeLine({ unitAmount: 3200, quantity: 1 })]);

    await user.click(screen.getByRole('button', { name: /cart/i }));
    await user.click(within(panel()).getByRole('button', { name: /increase quantity of crochet beanie/i }));

    expect(readCartLines()[0].quantity).toBe(2);
    expect(within(panel()).getByTestId('cart-subtotal')).toHaveTextContent('$64.00');
  });

  test('decrement lowers the quantity', async () => {
    const user = userEvent.setup();
    renderCartUi([makeLine({ quantity: 3 })]);

    await user.click(screen.getByRole('button', { name: /cart/i }));
    await user.click(within(panel()).getByRole('button', { name: /decrease quantity of crochet beanie/i }));

    expect(readCartLines()[0].quantity).toBe(2);
  });

  test('decrement is disabled at 1 — the floor is explicit, not silent', async () => {
    const user = userEvent.setup();
    renderCartUi([makeLine({ quantity: 1 })]);

    await user.click(screen.getByRole('button', { name: /cart/i }));

    expect(within(panel()).getByRole('button', { name: /decrease quantity/i })).toBeDisabled();
  });

  test('increment is disabled at 10, with a visible "max 10" note', async () => {
    const user = userEvent.setup();
    renderCartUi([makeLine({ quantity: 10 })]);

    await user.click(screen.getByRole('button', { name: /cart/i }));

    const scope = within(panel());
    expect(scope.getByRole('button', { name: /increase quantity/i })).toBeDisabled();
    expect(scope.getByText(/max 10/i)).toBeInTheDocument();
  });

  test('remove is named after the product and drops exactly that line', async () => {
    const user = userEvent.setup();
    renderCartUi([
      makeLine({ name: 'Crochet Beanie' }),
      makeLine({ name: 'Flower Clip', variationId: 'var-2' }),
    ]);

    await user.click(screen.getByRole('button', { name: /cart/i }));
    await user.click(within(panel()).getByRole('button', { name: /remove crochet beanie/i }));

    const lines = readCartLines();
    expect(lines).toHaveLength(1);
    expect(lines[0].name).toBe('Flower Clip');
  });
});
