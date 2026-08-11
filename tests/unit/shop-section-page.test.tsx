/**
 * `/shop/[section]` — the grid page. Scoped narrowly here to the "Make it
 * custom" banner card's dashed-border color (Woven spec §3); the grid's
 * product tiles are exercised in `tests/unit/product-card.test.tsx` and the
 * e2e shop suite.
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import ShopSectionPage from '@/app/shop/[section]/page';
import { getProducts } from '@/lib/sanity/queries';
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
  return ShopSectionPage({ params: Promise.resolve({ section }) });
}

beforeEach(() => {
  mockedProducts.mockReset().mockResolvedValue([]);
  mockedFetchPrices.mockReset().mockResolvedValue({ variations: new Map(), counts: {} });
});

describe('/shop/[section] — custom-order banner card', () => {
  test('the dashed border is rose, not khaki (Woven spec §3)', async () => {
    render(await renderPage('hats'));

    const banner = screen.getByRole('link', { name: /make it custom/i });
    expect(banner).toHaveClass('border-dashed', 'border-rose');
    expect(banner).not.toHaveClass('border-khaki');
  });
});
