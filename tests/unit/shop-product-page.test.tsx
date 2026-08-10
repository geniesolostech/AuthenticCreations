/**
 * `/shop/[section]/[slug]` — how the page tells "this product does not exist"
 * apart from "Sanity was unreachable for a moment".
 *
 * The distinction is the whole subject here, because the two answers have very
 * different lifetimes: `notFound()` is a 404 Next may cache, while a thrown
 * error is a retryable 500.
 */
import { beforeEach, describe, expect, test, vi } from 'vitest';

import ProductDetailPage from '@/app/shop/[section]/[slug]/page';
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
