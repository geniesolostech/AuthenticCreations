/**
 * The whole "pick your piece" answer, end to end: the picker in one column, the
 * buy button in the other, and one client component holding the choice between
 * them.
 *
 * What makes this worth testing as a pair rather than a component at a time is
 * that every piece of a product shares a single Square variation. Two pieces
 * therefore look identical to the cart engine except for the piece itself, and
 * that is exactly the thing this component supplies.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import PiecePurchase from '@/components/piece-purchase';
import type { PurchaseOption } from '@/components/product-purchase-panel';
import { CartProvider, useCart } from '@/lib/cart-context';
import { piecesOf } from '@/lib/shop/pieces';
import type { CartLine } from '@/lib/types';

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

function readLines(): CartLine[] {
  return JSON.parse(screen.getByTestId('lines').textContent ?? '[]') as CartLine[];
}

const options: PurchaseOption[] = [
  { label: 'Crochet slouch bag', variationId: 'bag-1', priceCents: 6500, trackInventory: false },
];

/** Three photos, three bags: named, unnamed, and one already sold. */
const pieces = piecesOf({
  sellByPiece: true,
  photos: [
    { _key: 'a', pieceLabel: 'Sunset' },
    { _key: 'b' },
    { _key: 'c', pieceLabel: 'Driftwood', sold: true },
  ],
});

function renderPurchase(which = pieces) {
  return renderWithCart(
    <PiecePurchase title="Crochet slouch bag" pieces={which} options={options}>
      <h1>Crochet slouch bag</h1>
    </PiecePurchase>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(global, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ counts: {} }), { status: 200 }),
  );
});

describe('PiecePurchase', () => {
  test('renders the page heading it was handed, unchanged', () => {
    renderPurchase();

    expect(screen.getByRole('heading', { name: 'Crochet slouch bag' })).toBeInTheDocument();
  });

  test('starts on the first piece that is not sold', () => {
    renderPurchase();

    expect(screen.getByRole('button', { name: 'Sunset' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('skips over a sold piece when choosing where to start', () => {
    renderPurchase(
      piecesOf({
        sellByPiece: true,
        photos: [{ _key: 'a', pieceLabel: 'Sunset', sold: true }, { _key: 'b' }],
      }),
    );

    expect(screen.getByRole('button', { name: 'Piece 2' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('picking a piece renames the line the buy button will add', async () => {
    const user = userEvent.setup();
    renderPurchase();

    await user.click(screen.getByRole('button', { name: 'Piece 2' }));
    await user.click(screen.getByRole('button', { name: /add to cart/i }));

    expect(readLines()[0]).toMatchObject({
      variationId: 'bag-1',
      name: 'Crochet slouch bag — Piece 2',
      quantity: 1,
      piece: { number: 2 },
    });
  });

  test('two different pieces are two cart lines, not two of one', async () => {
    const user = userEvent.setup();
    renderPurchase();

    await user.click(screen.getByRole('button', { name: /add to cart/i }));
    await user.click(screen.getByRole('button', { name: 'Piece 2' }));
    await user.click(screen.getByRole('button', { name: /add to cart/i }));

    const lines = readLines();
    expect(lines).toHaveLength(2);
    expect(lines.map((line) => line.name)).toEqual([
      'Crochet slouch bag — Sunset',
      'Crochet slouch bag — Piece 2',
    ]);
    expect(lines.every((line) => line.quantity === 1)).toBe(true);
  });

  test('adding the same piece twice leaves one line of one', async () => {
    const user = userEvent.setup();
    renderPurchase();

    await user.click(screen.getByRole('button', { name: /add to cart/i }));
    await user.click(screen.getByRole('button', { name: /add to cart/i }));

    // A piece is one physical object: the second click can only re-open the
    // cart, never buy the same bag twice.
    expect(readLines()).toHaveLength(1);
    expect(readLines()[0].quantity).toBe(1);
  });

  test('a sold piece cannot be bought', async () => {
    const user = userEvent.setup();
    renderPurchase();

    await user.click(screen.getByRole('button', { name: 'Driftwood (sold)' }));
    await user.click(screen.getByRole('button', { name: /add to cart/i }));

    expect(readLines()[0].name).toBe('Crochet slouch bag — Sunset');
  });

  test('every piece sold disables the buy button, whatever Square still counts', async () => {
    const user = userEvent.setup();
    // The option below is untracked and priced, i.e. Square would happily sell
    // it. The seller's per-piece marks are the truth on this page.
    renderPurchase(
      piecesOf({
        sellByPiece: true,
        photos: [{ _key: 'a', sold: true }, { _key: 'b', sold: true }],
      }),
    );

    const button = screen.getByRole('button', { name: /sold out/i });
    expect(button).toBeDisabled();

    await user.click(button);
    expect(readLines()).toHaveLength(0);
  });
});
