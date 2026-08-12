import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import ProductGallery from '@/components/product-gallery';
import type { SanityImage } from '@/lib/sanity/queries';
import { piecesOf } from '@/lib/shop/pieces';

const photos: SanityImage[] = [
  { asset: { _ref: 'image-abc123-2000x2000-jpg', _type: 'reference' } },
  { asset: { _ref: 'image-def456-2000x2000-jpg', _type: 'reference' } },
];

describe('ProductGallery', () => {
  test('shows a placeholder with a "photo coming soon" accessible name when there are no photos', () => {
    render(<ProductGallery title="Crochet Beanie" photos={[]} />);

    expect(
      screen.getByRole('img', { name: /crochet beanie.*photo coming soon/i }),
    ).toBeInTheDocument();
  });

  test('shows the first photo as the main image with the product title as alt text', () => {
    render(<ProductGallery title="Crochet Beanie" photos={photos} />);

    expect(screen.getByRole('img', { name: 'Crochet Beanie' })).toBeInTheDocument();
  });

  test('clicking a thumbnail switches the main image', async () => {
    const user = userEvent.setup();
    render(<ProductGallery title="Crochet Beanie" photos={photos} />);

    const thumbs = screen.getAllByRole('button', { name: /photo \d/i });
    expect(thumbs).toHaveLength(2);

    await user.click(thumbs[1]);

    const main = screen.getByRole('img', { name: 'Crochet Beanie' }) as HTMLImageElement;
    expect(main.src).toContain('def456');
  });

  test('stays the plain gallery when the product has no pieces', () => {
    // The regression that matters most: every product but the pilot one passes
    // an empty `pieces`, and must render exactly what it always has.
    render(<ProductGallery title="Crochet Beanie" photos={photos} pieces={[]} />);

    expect(screen.queryByRole('group', { name: /pick your piece/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /photo \d/i })).toHaveLength(2);
  });
});

describe('ProductGallery — piece picker', () => {
  const pieces = piecesOf({
    sellByPiece: true,
    photos: [
      { _key: 'a', asset: { _ref: 'image-abc123-2000x2000-jpg', _type: 'reference' }, pieceLabel: 'Sunset' },
      { _key: 'b' },
      { _key: 'c', pieceLabel: 'Driftwood', sold: true },
    ],
  });

  function renderPicker(selectedPiece: number | null, onSelectPiece = vi.fn()) {
    render(
      <ProductGallery
        title="Crochet slouch bag"
        pieces={pieces}
        selectedPiece={selectedPiece}
        onSelectPiece={onSelectPiece}
      />,
    );
    return onSelectPiece;
  }

  test('offers one tile per piece, named by label or by position', () => {
    renderPicker(1);

    const picker = screen.getByRole('group', { name: /pick your piece/i });
    expect(within(picker).getAllByRole('button').map((tile) => tile.getAttribute('aria-label'))).toEqual([
      'Sunset',
      'Piece 2',
      'Driftwood (sold)',
    ]);
  });

  test('marks the selected tile pressed, with the rust ring the rest of the shop uses', () => {
    renderPicker(2);

    const selected = screen.getByRole('button', { name: 'Piece 2' });
    expect(selected).toHaveAttribute('aria-pressed', 'true');
    expect(selected).toHaveClass('border-rust', 'ring-rust/40');
    expect(screen.getByRole('button', { name: 'Sunset' })).toHaveAttribute('aria-pressed', 'false');
  });

  test('clicking a piece asks the owner to select it', async () => {
    const user = userEvent.setup();
    const onSelectPiece = renderPicker(1);

    await user.click(screen.getByRole('button', { name: 'Piece 2' }));

    expect(onSelectPiece).toHaveBeenCalledWith(2);
  });

  test('a sold piece stays on the shelf, badged and unselectable', async () => {
    const user = userEvent.setup();
    const onSelectPiece = renderPicker(1);

    // Still shown, because hiding it would renumber every piece after it — and
    // those numbers are what the maker reads off the order.
    const sold = screen.getByRole('button', { name: 'Driftwood (sold)' });
    expect(sold).toBeDisabled();
    // The photo greys out; the badge on top of it stays at full strength.
    expect(sold.querySelector('.grayscale')).not.toBeNull();
    expect(within(sold).getByText('Sold')).toHaveClass('bg-olive-deep', 'text-cream');
    expect(within(sold).getByText('Sold').closest('.grayscale')).toBeNull();
    // A sold tile must not offer the rust hover the buyable ones do.
    expect(sold).not.toHaveClass('hover:border-rust');

    await user.click(sold);
    expect(onSelectPiece).not.toHaveBeenCalled();
  });

  test('shows the selected piece large, by name', () => {
    renderPicker(1);

    expect(screen.getByRole('img', { name: 'Crochet slouch bag: Sunset' })).toBeInTheDocument();
  });

  test('falls back to the placeholder for a piece with no photo uploaded yet', () => {
    renderPicker(2);

    // Fixture mode and CJ's pre-photo catalog both look like this.
    expect(screen.getByRole('img', { name: /crochet slouch bag: piece 2.*photo coming soon/i })).toBeInTheDocument();
  });

  test('shows the first piece when every one of them is sold and nothing is selected', () => {
    render(
      <ProductGallery
        title="Crochet slouch bag"
        pieces={piecesOf({
          sellByPiece: true,
          photos: [{ _key: 'a', pieceLabel: 'Sunset', sold: true }, { _key: 'b', sold: true }],
        })}
        selectedPiece={null}
      />,
    );

    expect(screen.getByRole('img', { name: /crochet slouch bag: sunset/i })).toBeInTheDocument();
    for (const tile of screen.getAllByRole('button')) {
      expect(tile).toBeDisabled();
    }
  });
});
