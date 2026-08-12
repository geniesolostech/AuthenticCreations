import { createElement } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { addLine, itemCount, removeLine, repriceLines, setQuantity, subtotal } from '@/lib/cart';
import { CartProvider, useCart } from '@/lib/cart-context';
import { readCartLines, readStoredLines, renderWithCart } from '@/tests/helpers/cart-render';
import type { CartLine } from '@/lib/types';

const STORAGE_KEY = 'ac-cart-v1';

function CartConsumer() {
  const cart = useCart();
  return createElement(
    'div',
    null,
    createElement('span', { 'data-testid': 'count' }, String(cart.itemCount)),
    createElement(
      'button',
      {
        onClick: () =>
          cart.add({ variationId: 'var-1', name: 'Crochet Beanie', unitAmount: 4500, quantity: 1 }),
      },
      'add',
    ),
  );
}

function makeLine(overrides: Partial<Omit<CartLine, 'lineId'>> = {}): Omit<CartLine, 'lineId'> {
  return {
    variationId: 'var-1',
    name: 'Crochet Beanie',
    unitAmount: 4500,
    quantity: 1,
    ...overrides,
  };
}

describe('addLine', () => {
  test('merges quantities for the same non-custom variation', () => {
    let lines: CartLine[] = [];
    lines = addLine(lines, makeLine({ quantity: 2 }));
    lines = addLine(lines, makeLine({ quantity: 3 }));
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(5);
  });

  test('keeps two custom lines separate even with identical variation and color', () => {
    let lines: CartLine[] = [];
    const customLine = makeLine({ custom: { colors: ['Black'], comments: 'extra long ties' } });
    lines = addLine(lines, customLine);
    lines = addLine(lines, customLine);
    expect(lines).toHaveLength(2);
    expect(lines[0].lineId).not.toBe(lines[1].lineId);
  });
});

describe('addLine — one-of-a-kind pieces', () => {
  test('keeps two pieces of the same variation as two lines', () => {
    // Every piece of a product shares one Square variation, so variation alone
    // would merge two different bags into a single line of two.
    let lines = addLine([], makeLine({ piece: { number: 1, label: 'Sunset' } }));
    lines = addLine(lines, makeLine({ piece: { number: 2 } }));

    expect(lines).toHaveLength(2);
    expect(lines.map((line) => line.piece?.number)).toEqual([1, 2]);
  });

  test('adding the same piece again neither duplicates the line nor raises the quantity', () => {
    const piece = makeLine({ piece: { number: 1, label: 'Sunset' } });
    let lines = addLine([], piece);
    lines = addLine(lines, piece);

    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(1);
  });

  test('never merges a piece line into the plain line for the same variation', () => {
    let lines = addLine([], makeLine());
    lines = addLine(lines, makeLine({ piece: { number: 1 } }));

    expect(lines).toHaveLength(2);
    expect(lines[0].piece).toBeUndefined();
  });

  test('clamps a piece line to one, however many were asked for', () => {
    const lines = addLine([], makeLine({ quantity: 4, piece: { number: 1 } }));

    expect(lines[0].quantity).toBe(1);
  });
});

describe('setQuantity', () => {
  test('clamps quantity to the 1..10 range', () => {
    let lines = addLine([], makeLine({ quantity: 1 }));
    const lineId = lines[0].lineId;

    lines = setQuantity(lines, lineId, 99);
    expect(lines[0].quantity).toBe(10);

    lines = setQuantity(lines, lineId, -5);
    expect(lines[0].quantity).toBe(1);
  });

  test('pins a piece line at one, whatever it is asked for', () => {
    let lines = addLine([], makeLine({ piece: { number: 1, label: 'Sunset' } }));
    const lineId = lines[0].lineId;

    lines = setQuantity(lines, lineId, 2);
    expect(lines[0].quantity).toBe(1);

    lines = setQuantity(lines, lineId, 10);
    expect(lines[0].quantity).toBe(1);
  });
});

describe('removeLine', () => {
  test('drops only the target line', () => {
    let lines = addLine([], makeLine({ variationId: 'var-1' }));
    lines = addLine(lines, makeLine({ variationId: 'var-2' }));
    const targetId = lines[0].lineId;

    lines = removeLine(lines, targetId);

    expect(lines).toHaveLength(1);
    expect(lines[0].variationId).toBe('var-2');
  });
});

describe('subtotal', () => {
  test('multiplies unit amount by quantity across lines', () => {
    let lines = addLine([], makeLine({ variationId: 'var-1', unitAmount: 4500, quantity: 2 }));
    lines = addLine(lines, makeLine({ variationId: 'var-2', unitAmount: 3000, quantity: 1 }));

    expect(subtotal(lines)).toBe(12000);
  });
});

describe('itemCount', () => {
  test('sums quantities across all lines', () => {
    let lines = addLine([], makeLine({ variationId: 'var-1', quantity: 2 }));
    lines = addLine(lines, makeLine({ variationId: 'var-2', quantity: 3 }));

    expect(itemCount(lines)).toBe(5);
  });
});

describe('repriceLines', () => {
  test('writes the fresh price onto every line carrying that variation', () => {
    let lines = addLine([], makeLine({ variationId: 'var-1', unitAmount: 4500, quantity: 2 }));
    lines = addLine(lines, makeLine({ variationId: 'var-1', unitAmount: 4500, custom: { colors: ['Red'], comments: '' } }));

    const repriced = repriceLines(lines, { 'var-1': 5000 });

    expect(repriced.map((l) => l.unitAmount)).toEqual([5000, 5000]);
    // Everything else about a line survives — quantity, custom note, line id.
    expect(repriced[0].quantity).toBe(2);
    expect(repriced[1].custom).toEqual({ colors: ['Red'], comments: '' });
    expect(repriced.map((l) => l.lineId)).toEqual(lines.map((l) => l.lineId));
  });

  test('leaves lines whose variation is not mentioned alone', () => {
    let lines = addLine([], makeLine({ variationId: 'var-1', unitAmount: 4500 }));
    lines = addLine(lines, makeLine({ variationId: 'var-2', unitAmount: 3000 }));

    const repriced = repriceLines(lines, { 'var-1': 5000 });

    expect(repriced.map((l) => l.unitAmount)).toEqual([5000, 3000]);
  });

  test('ignores a price that is not a usable number of cents', () => {
    const lines = addLine([], makeLine({ variationId: 'var-1', unitAmount: 4500 }));

    // The map arrives as parsed JSON from the network, so it is not a
    // `Record<string, number>` until something checks.
    const repriced = repriceLines(lines, {
      'var-1': Number.NaN,
    } as unknown as Record<string, number>);

    expect(repriced[0].unitAmount).toBe(4500);
  });

  test('returns the same array when nothing actually moved', () => {
    const lines = addLine([], makeLine({ variationId: 'var-1', unitAmount: 4500 }));

    // Identity, not just equality: an unchanged cart must not re-render the
    // whole tree or rewrite localStorage.
    expect(repriceLines(lines, { 'var-1': 4500 })).toBe(lines);
    expect(repriceLines(lines, {})).toBe(lines);
  });
});

describe('CartProvider / useCart persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test('restores cart lines from localStorage on a fresh provider mount', async () => {
    const user = userEvent.setup();
    const { unmount } = render(createElement(CartProvider, null, createElement(CartConsumer)));

    await user.click(screen.getByRole('button', { name: 'add' }));
    expect(screen.getByTestId('count')).toHaveTextContent('1');
    await waitFor(() => expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull());

    unmount();

    render(createElement(CartProvider, null, createElement(CartConsumer)));
    expect(await screen.findByTestId('count')).toHaveTextContent('1');
  });

  test('resets to an empty cart when localStorage contains corrupt JSON', async () => {
    window.localStorage.setItem(STORAGE_KEY, '{not valid json');

    render(createElement(CartProvider, null, createElement(CartConsumer)));

    expect(await screen.findByTestId('count')).toHaveTextContent('0');
  });

  test('does not throw when localStorage.setItem fails (e.g. quota exceeded)', async () => {
    const user = userEvent.setup();
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    });

    render(createElement(CartProvider, null, createElement(CartConsumer)));

    await user.click(screen.getByRole('button', { name: 'add' }));

    expect(screen.getByTestId('count')).toHaveTextContent('1');

    setItemSpy.mockRestore();
  });
});

/**
 * A cart outlives a deploy: it sits in the shopper's browser until they check
 * out. These are the lines an older build left behind, which the provider has
 * to bring up to the current shape on the way in — mid-session, with no reload.
 */
describe('CartProvider — carts saved before custom orders took more than one color', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  /** A stored custom line carrying whatever `custom` block the test is about. */
  function storedCustomLine(custom: unknown): unknown {
    return {
      lineId: 'line-stored',
      variationId: 'var-1',
      name: 'Custom: Crochet Beanie',
      unitAmount: 4500,
      quantity: 1,
      custom,
    };
  }

  test('hydrates a legacy single color as a one-color list', () => {
    renderWithCart(null, [
      storedCustomLine({ color: 'Red', comments: 'extra long ties' }),
    ] as CartLine[]);

    expect(readCartLines()[0].custom).toEqual({ colors: ['Red'], comments: 'extra long ties' });
  });

  test('drops the legacy field rather than carrying both shapes forward', () => {
    renderWithCart(null, [storedCustomLine({ color: 'Red', comments: '' })] as CartLine[]);

    expect(readCartLines()[0].custom).not.toHaveProperty('color');
  });

  test('writes the converted cart back, so the conversion happens once', async () => {
    renderWithCart(null, [storedCustomLine({ color: 'Red', comments: '' })] as CartLine[]);

    await waitFor(() =>
      expect(readStoredLines()[0].custom).toEqual({ colors: ['Red'], comments: '' }),
    );
  });

  test('leaves a line already carrying a list alone, pick order and all', () => {
    renderWithCart(null, [
      storedCustomLine({ colors: ['Purple', 'Green'], comments: 'stripes' }),
    ] as CartLine[]);

    expect(readCartLines()[0].custom).toEqual({ colors: ['Purple', 'Green'], comments: 'stripes' });
  });

  test('leaves an ordinary line without a custom block alone', () => {
    renderWithCart(null, [{ ...makeLine(), lineId: 'line-plain' }]);

    expect(readCartLines()[0]).not.toHaveProperty('custom');
  });
});
