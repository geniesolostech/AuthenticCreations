/**
 * `/shop/[section]/custom` — the page shell (title + underline/motif).
 * The picker form's own behavior is covered by
 * `tests/unit/custom-order-form.test.tsx`; the picker grid's RevealGrid
 * wrap is asserted there too, since that's where the grid actually lives.
 */
import { render, screen, within } from '@testing-library/react';
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

describe('/shop/[section]/custom — products sold in styles', () => {
  const flowers = product({
    _id: 'p-flowers',
    title: 'Crochet flowers',
    slug: 'crochet-flowers',
    section: 'accessories',
    variants: [
      {
        _key: 'variant-rose',
        label: 'Rose',
        squareVariationId: 'flower-rose',
        customSquareVariationId: 'cust-flower-rose',
      },
      {
        _key: 'variant-tulip',
        label: 'Tulip',
        squareVariationId: 'flower-tulip',
        customSquareVariationId: 'cust-flower-tulip',
      },
      // No custom SKU built for this one yet.
      { _key: 'variant-lavender', label: 'Lavender', squareVariationId: 'flower-lavender' },
    ],
  });

  function priced(entries: [string, number][]) {
    return new Map(
      entries.map(([id, priceCents]) => [id, { id, priceCents, trackInventory: false }]),
    );
  }

  test('looks up every per-style custom id alongside the top-level ones', async () => {
    mockedProducts.mockResolvedValue([
      flowers,
      product({ _id: 'p-hat', customSquareVariationId: 'cust-hat' }),
    ]);

    await renderPage('accessories');

    // The ready-made ids are not in the list: this page only ever charges the
    // custom SKUs, and asking Square for the rest would be a wasted lookup.
    expect(mockedFetchPrices).toHaveBeenCalledWith([
      'cust-flower-rose',
      'cust-flower-tulip',
      'cust-hat',
    ]);
  });

  test('offers only the styles that have a custom SKU, priced from Square', async () => {
    mockedProducts.mockResolvedValue([flowers]);
    mockedFetchPrices.mockResolvedValue({
      variations: priced([
        ['cust-flower-rose', 800],
        ['cust-flower-tulip', 800],
      ]),
      counts: {},
    });

    render(<CartProvider>{await renderPage('accessories')}</CartProvider>);

    const styles = screen.getByRole('group', { name: /pick a style/i });
    expect(within(styles).getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Rose',
      'Tulip',
    ]);
    // Lavender has no custom variation id, so it is not a choice at all.
    expect(within(styles).queryByRole('button', { name: 'Lavender' })).not.toBeInTheDocument();
  });

  test('prices the card from the first style, since the page shows one number', async () => {
    mockedProducts.mockResolvedValue([flowers]);
    mockedFetchPrices.mockResolvedValue({
      variations: priced([
        ['cust-flower-rose', 800],
        ['cust-flower-tulip', 800],
      ]),
      counts: {},
    });

    render(<CartProvider>{await renderPage('accessories')}</CartProvider>);

    expect(screen.getByTestId('custom-price')).toHaveTextContent('$8.00');
  });

  test('a product with no styles is mapped exactly as before', async () => {
    mockedProducts.mockResolvedValue([product({ customSquareVariationId: 'cust-hat' })]);
    mockedFetchPrices.mockResolvedValue({ variations: priced([['cust-hat', 5500]]), counts: {} });

    render(<CartProvider>{await renderPage('hats')}</CartProvider>);

    expect(screen.getByTestId('custom-price')).toHaveTextContent('$55.00');
    expect(screen.queryByRole('group', { name: /pick a style/i })).not.toBeInTheDocument();
  });
});
