import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import ProductCard from '@/components/product-card';
import type { Product } from '@/lib/sanity/queries';

const baseProduct: Product = {
  _id: 'p1',
  title: 'Ruffled Bucket Hat',
  slug: 'ruffled-bucket-hat',
  section: 'hats',
  photos: [{ asset: { _ref: 'image-abc123def456-2000x2000-jpg', _type: 'reference' } }],
};

describe('ProductCard', () => {
  test('shows formatted price and links to the product page', () => {
    render(<ProductCard product={baseProduct} priceCents={4500} soldOut={false} />);

    expect(screen.getByText('$45.00')).toBeInTheDocument();
    expect(screen.getByText('Ruffled Bucket Hat')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/shop/hats/ruffled-bucket-hat');
  });

  test('shows the real photo with the product title as alt text when a photo exists', () => {
    render(<ProductCard product={baseProduct} priceCents={4500} soldOut={false} />);

    expect(screen.getByRole('img', { name: 'Ruffled Bucket Hat' })).toBeInTheDocument();
  });

  test('shows a placeholder SVG with a "photo coming soon" accessible name when there is no photo', () => {
    const product: Product = { ...baseProduct, photos: [] };
    render(<ProductCard product={product} priceCents={4500} soldOut={false} />);

    expect(
      screen.getByRole('img', { name: /ruffled bucket hat.*photo coming soon/i }),
    ).toBeInTheDocument();
  });

  test('shows a "price at checkout" fallback when the price is unknown', () => {
    render(<ProductCard product={baseProduct} priceCents={null} soldOut={false} />);

    expect(screen.getByText(/price at checkout/i)).toBeInTheDocument();
    expect(screen.queryByText(/^\$/)).not.toBeInTheDocument();
  });

  test('shows a sold-out badge overlay when soldOut is true', () => {
    render(<ProductCard product={baseProduct} priceCents={4500} soldOut={true} />);

    expect(screen.getByText(/sold out/i)).toBeInTheDocument();
  });

  test('does not show a sold-out badge when not sold out', () => {
    render(<ProductCard product={baseProduct} priceCents={4500} soldOut={false} />);

    expect(screen.queryByText(/sold out/i)).not.toBeInTheDocument();
  });
});
