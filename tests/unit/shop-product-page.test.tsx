/**
 * `/shop/[section]/[slug]` — how the page tells "this product does not exist"
 * apart from "Sanity was unreachable for a moment".
 *
 * The distinction is the whole subject here, because the two answers have very
 * different lifetimes: `notFound()` is a 404 Next may cache, while a thrown
 * error is a retryable 500.
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import ProductDetailPage from '@/app/shop/[section]/[slug]/page';
import { CartProvider } from '@/lib/cart-context';
import { getProduct } from '@/lib/sanity/queries';
import { fetchPricesAndStock } from '@/lib/shop/fetch-prices';

vi.mock('@/lib/sanity/queries', () => ({
  getProduct: vi.fn(),
  getProducts: vi.fn(),
}));

// Stubbed so the Square gateway (and its SDK) stays out of this test entirely;
// none of the cases below get far enough to price anything anyway.
vi.mock('@/lib/shop/fetch-prices', () => ({
  fetchPricesAndStock: vi.fn(),
}));

const product = vi.mocked(getProduct);
const pricesAndStock = vi.mocked(fetchPricesAndStock);

function renderPage(section: string, slug: string) {
  return ProductDetailPage({ params: Promise.resolve({ section, slug }) });
}

beforeEach(() => {
  product.mockReset();
  pricesAndStock.mockReset();
  pricesAndStock.mockResolvedValue({ variations: new Map(), counts: {} });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('/shop/[section]/[slug] — missing products vs. outages', () => {
  test('calls notFound() when Sanity says there is no such product', async () => {
    product.mockResolvedValue(null);

    await expect(renderPage('hats', 'no-such-hat')).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404');
  });

  test('calls notFound() when the product lives in another section', async () => {
    product.mockResolvedValue({
      _id: 'p1',
      title: 'Crochet slouch bag',
      slug: 'crochet-slouch-bag',
      section: 'accessories',
    });

    await expect(renderPage('hats', 'crochet-slouch-bag')).rejects.toThrow(
      'NEXT_HTTP_ERROR_FALLBACK;404',
    );
  });

  test('a Sanity outage propagates as an error, not a 404', async () => {
    product.mockRejectedValue(new Error('network down'));

    // Swallowing this into notFound() would let a few seconds of Sanity trouble
    // put a cacheable "this hat does not exist" in front of a hat that does.
    await expect(renderPage('hats', 'crochet-beanie')).rejects.toThrow('network down');
  });

  test('calls notFound() for a section that is not a section, without asking Sanity', async () => {
    await expect(renderPage('sweaters', 'anything')).rejects.toThrow(
      'NEXT_HTTP_ERROR_FALLBACK;404',
    );
    expect(product).not.toHaveBeenCalled();
  });
});

describe('/shop/[section]/[slug] — products sold by piece', () => {
  const bag = {
    _id: 'p-bag',
    title: 'Crochet slouch bag',
    slug: 'crochet-slouch-bag',
    section: 'accessories' as const,
    squareVariationId: 'bag-1',
    photos: [{ _key: 'a', pieceLabel: 'Sunset' }, { _key: 'b' }],
  };

  // The panel reads cart context (Add to Cart), which the root layout supplies
  // in the real app but this page component does not.
  async function renderBag(overrides: Record<string, unknown> = {}) {
    product.mockResolvedValue({ ...bag, ...overrides });
    render(<CartProvider>{await renderPage('accessories', 'crochet-slouch-bag')}</CartProvider>);
  }

  test('turns the gallery into the piece picker when the flag is on', async () => {
    await renderBag({ sellByPiece: true });

    expect(screen.getByRole('group', { name: /pick your piece/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sunset' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { level: 1, name: 'Crochet slouch bag' })).toBeInTheDocument();
  });

  test('leaves a product without the flag on the plain gallery', async () => {
    await renderBag();

    expect(screen.queryByRole('group', { name: /pick your piece/i })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Crochet slouch bag' })).toBeInTheDocument();
  });

  test('leaves a sell-by-piece product with no photos yet on the plain gallery', async () => {
    // Nothing to pick between: the picker would be an empty shelf, so the page
    // falls back to the gallery's own "photo coming soon" placeholder.
    await renderBag({ sellByPiece: true, photos: [] });

    expect(screen.queryByRole('group', { name: /pick your piece/i })).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: /photo coming soon/i })).toBeInTheDocument();
  });
});
