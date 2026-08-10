import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';

import ProductGallery from '@/components/product-gallery';
import type { SanityImage } from '@/lib/sanity/queries';

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
});
