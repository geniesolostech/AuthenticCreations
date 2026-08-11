/**
 * `/shop/[section]/custom` — the page shell (title + underline/motif).
 * The picker form's own behavior is covered by
 * `tests/unit/custom-order-form.test.tsx`; the picker grid's RevealGrid
 * wrap is asserted there too, since that's where the grid actually lives.
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import CustomOrderPage from '@/app/shop/[section]/custom/page';
import { CartProvider } from '@/lib/cart-context';
import { getProducts, type Product } from '@/lib/sanity/queries';
import { fetchPricesAndStock } from '@/lib/shop/fetch-prices';

vi.mock('@/lib/sanity/queries', () => ({
  getProducts: vi.fn(),
}));

vi.mock('@/lib/shop/fetch-prices', () => ({
  fetchPricesAndStock: vi.fn(),
}));

const mockedProducts = vi.mocked(getProducts);
const mockedFetchPrices = vi.mocked(fetchPricesAndStock);

function renderPage(section: string) {
  return CustomOrderPage({ params: Promise.resolve({ section }) });
}

function product(overrides: Partial<Product> = {}): Product {
  return {
    _id: 'p1',
    title: 'Custom Beanie',
    slug: 'custom-beanie',
    section: 'hats',
    ...overrides,
  };
}

beforeEach(() => {
  mockedProducts.mockReset().mockResolvedValue([]);
  mockedFetchPrices.mockReset().mockResolvedValue({ variations: new Map(), counts: {} });
});

describe('/shop/[section]/custom — page title (Woven spec §3/§4)', () => {
  test('h1 pairs a motif with a mustard underline', async () => {
    render(await renderPage('hats'));

    const heading = screen.getByRole('heading', { level: 1 });
    const motif = screen.getByTestId('granny-motif');
    expect(heading.parentElement).toContainElement(motif);
    expect(screen.getByTestId('yarn-underline').querySelector('path')).toHaveClass('stroke-mustard');
  });

  test('still shows the motif and underline in the empty-catalog state', async () => {
    render(await renderPage('hats'));

    expect(screen.getByTestId('granny-motif')).toBeInTheDocument();
    expect(screen.getByTestId('yarn-underline')).toBeInTheDocument();
  });
});

describe('/shop/[section]/custom — picker grid wiring', () => {
  test('passes the picker grid through to CustomOrderForm unchanged', async () => {
    mockedProducts.mockResolvedValue([product()]);
    const page = await renderPage('hats');

    // CustomOrderForm reads cart context (Add to Cart), so it needs a
    // CartProvider ancestor here — the root layout supplies one in the
    // real app; this page component alone does not.
    render(<CartProvider>{page}</CartProvider>);

    expect(screen.getByRole('group', { name: /choose a piece/i })).toBeInTheDocument();
  });
});
