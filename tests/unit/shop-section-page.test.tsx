/**
 * `/shop/[section]` — the grid page. Scoped narrowly here to the "Make it
 * custom" banner card's dashed-border color (Woven spec §3); the grid's
 * product tiles are exercised in `tests/unit/product-card.test.tsx` and the
 * e2e shop suite.
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import ShopSectionPage from '@/app/shop/[section]/page';
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
  return ShopSectionPage({ params: Promise.resolve({ section }) });
}

function product(overrides: Partial<Product> = {}): Product {
  return {
    _id: 'p1',
    title: 'Ruffled Bucket Hat',
    slug: 'ruffled-bucket-hat',
    section: 'hats',
    ...overrides,
  };
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

describe('/shop/[section] — outages vs. an empty shelf', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('a Sanity outage propagates as an error rather than rendering an empty grid', async () => {
    mockedProducts.mockRejectedValue(new Error('network down'));

    // Rendering on would put an empty shelf on the page, and `revalidate = 60`
    // would then *cache* it — a few seconds of Sanity trouble becoming a minute
    // of a shop that looks closed. A throw is a retryable 500 that is never
    // cached, and ISR keeps serving the last good page meanwhile.
    await expect(renderPage('accessories')).rejects.toThrow('network down');
  });

  test('an empty answer from Sanity still gets the friendly empty-shelf copy', async () => {
    mockedProducts.mockResolvedValue([]);

    render(await renderPage('hats'));

    expect(screen.getByText(/still being stitched together/i)).toBeInTheDocument();
  });
});

describe('/shop/[section] — page title (Woven spec §3/§4)', () => {
  test('h1 pairs a motif with a rose underline', async () => {
    render(await renderPage('hats'));

    const heading = screen.getByRole('heading', { level: 1 });
    const motif = screen.getByTestId('granny-motif');
    expect(heading.parentElement).toContainElement(motif);
    expect(screen.getByTestId('yarn-underline').querySelector('path')).toHaveClass('stroke-rose');
  });
});

describe('/shop/[section] — grid: quilt rotation, deliberately no entrance stagger (Woven spec §3)', () => {
  test('the first three cards rotate mustard/rose/sage quilt frames by grid position', async () => {
    mockedProducts.mockResolvedValue([
      product({ _id: 'p1', title: 'Hat One', slug: 'hat-one' }),
      product({ _id: 'p2', title: 'Hat Two', slug: 'hat-two' }),
      product({ _id: 'p3', title: 'Hat Three', slug: 'hat-three' }),
    ]);

    render(await renderPage('hats'));

    const cards = screen.getAllByRole('link', { name: /hat (one|two|three)/i });
    expect(cards[0]).toHaveClass('border-mustard');
    expect(cards[1]).toHaveClass('border-rose');
    expect(cards[2]).toHaveClass('border-sage');
  });

  // Deliberately unwrapped in RevealGrid: this grid is the page's main
  // content and a plausible Largest Contentful Paint element, so it must
  // never start at opacity:0 waiting on an IntersectionObserver (carried
  // finding from Task 4's review — see task-5-brief.md / progress.md).
  test('the grid is NOT wrapped in RevealGrid (deliberately unwrapped — LCP)', async () => {
    mockedProducts.mockResolvedValue([product()]);

    render(await renderPage('hats'));

    expect(document.querySelector('.reveal-grid')).toBeNull();
  });
});
