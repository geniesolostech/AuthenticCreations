import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import Home from '@/app/page';
import { getAboutPage, getFeaturedProducts, getPosts, getUpcomingEvents } from '@/lib/sanity/queries';
import type { AboutPage, EventDoc, PostSummary, Product } from '@/lib/sanity/queries';
import { fetchPricesAndStock } from '@/lib/shop/fetch-prices';

vi.mock('@/lib/sanity/queries', () => ({
  getFeaturedProducts: vi.fn(),
  getUpcomingEvents: vi.fn(),
  getPosts: vi.fn(),
  getAboutPage: vi.fn(),
}));

vi.mock('@/lib/shop/fetch-prices', () => ({
  fetchPricesAndStock: vi.fn(),
}));

const mockedFeatured = vi.mocked(getFeaturedProducts);
const mockedUpcoming = vi.mocked(getUpcomingEvents);
const mockedPosts = vi.mocked(getPosts);
const mockedAbout = vi.mocked(getAboutPage);
const mockedFetchPrices = vi.mocked(fetchPricesAndStock);

function product(overrides: Partial<Product> = {}): Product {
  return {
    _id: 'p1',
    title: 'Ruffled Bucket Hat',
    slug: 'ruffled-bucket-hat',
    section: 'hats',
    squareVariationId: 'var-1',
    featured: true,
    ...overrides,
  };
}

const EVENT: EventDoc = {
  _id: 'e1',
  title: 'August Crochet Circle',
  slug: 'august-circle',
  startsAt: '2099-08-20T23:00:00.000Z',
  description: 'Bring your yarn and a cup of something warm.',
};

const POST: PostSummary = {
  _id: 'post1',
  title: 'A Weekend with the Fiber Guild',
  slug: 'fiber-guild-weekend',
  excerpt: 'Notes from a cozy weekend of swapping yarn and stories.',
  publishedAt: '2026-08-01T00:00:00.000Z',
};

/** Home section headings each sit in `<div className="flex ..."><h2/><motif/></div>`,
 * itself the first child of `<div className="inline-flex flex-col ..."><row/><underline/></div>`
 * (Woven spec §3/§4) — scopes the motif/underline lookup to one specific
 * section's heading so tests don't accidentally grab a sibling section's. */
function motifAndUnderlineFor(heading: HTMLElement) {
  const row = heading.parentElement as HTMLElement;
  const motif = within(row).getByTestId('granny-motif');
  const colWrap = row.parentElement as HTMLElement;
  const underline = within(colWrap).getByTestId('yarn-underline');
  return { motif, underline, row, colWrap };
}

beforeEach(() => {
  mockedFeatured.mockReset().mockResolvedValue([]);
  mockedUpcoming.mockReset().mockResolvedValue([]);
  mockedPosts.mockReset().mockResolvedValue([]);
  mockedAbout.mockReset().mockResolvedValue(null);
  mockedFetchPrices.mockReset().mockResolvedValue({ variations: new Map(), counts: {} });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('/ — hero', () => {
  test('shows the script tagline and both shop CTAs with correct hrefs', async () => {
    render(await Home());

    expect(screen.getByText(/find you in whatever you do/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /shop hats/i })).toHaveAttribute('href', '/shop/hats');
    expect(screen.getByRole('link', { name: /shop accessories/i })).toHaveAttribute(
      'href',
      '/shop/accessories',
    );
  });

  test('shows the brand headline and the logo with its full alt text', async () => {
    render(await Home());

    expect(screen.getByRole('heading', { level: 1, name: 'Authentic Creations' })).toBeInTheDocument();
    const logo = screen.getByRole('img', {
      name: 'Authentic Creations: Find you in whatever you do',
    });
    expect(logo).toBeInTheDocument();
    // The transparent PNG, not the source JPEG: the JPEG's baked-in white
    // background sits on the linen hero as a visible rectangle.
    expect(logo).toHaveAttribute('src', '/logo.png');
  });

  test('sits on the sand-to-sand-deep gradient, not the flat linen fill (Woven spec §3)', async () => {
    render(await Home());

    const heroSection = screen
      .getByRole('heading', { level: 1, name: 'Authentic Creations' })
      .closest('section');
    expect(heroSection).toHaveClass(
      'bg-[linear-gradient(135deg,var(--color-sand),var(--color-sand-deep))]',
    );
    expect(heroSection).not.toHaveClass('bg-linen');
  });
});

describe('/ — featured pieces', () => {
  test('renders up to 4 featured products as ProductCards, priced from Square', async () => {
    mockedFeatured.mockResolvedValue([
      product({ _id: 'p1', title: 'Hat One', slug: 'hat-one', squareVariationId: 'var-1' }),
      product({ _id: 'p2', title: 'Hat Two', slug: 'hat-two', squareVariationId: 'var-2' }),
      product({ _id: 'p3', title: 'Hat Three', slug: 'hat-three', squareVariationId: 'var-3' }),
      product({ _id: 'p4', title: 'Hat Four', slug: 'hat-four', squareVariationId: 'var-4' }),
      product({ _id: 'p5', title: 'Hat Five', slug: 'hat-five', squareVariationId: 'var-5' }),
    ]);
    mockedFetchPrices.mockResolvedValue({
      variations: new Map([['var-1', { id: 'var-1', priceCents: 4500, trackInventory: false }]]),
      counts: {},
    });

    render(await Home());

    expect(screen.getByRole('heading', { name: /featured/i })).toBeInTheDocument();
    expect(screen.getByText('$45.00')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /hat (one|two|three|four|five)/i })).toHaveLength(4);
  });

  test('asks Square for prices using each product’s own variation id', async () => {
    mockedFeatured.mockResolvedValue([product({ squareVariationId: 'var-99' })]);

    render(await Home());

    expect(mockedFetchPrices).toHaveBeenCalledWith(['var-99']);
  });

  test('omits the section entirely when there are no featured products', async () => {
    render(await Home());

    expect(screen.queryByRole('heading', { name: /featured/i })).not.toBeInTheDocument();
  });

  test('degrades to an omitted section instead of crashing when Sanity throws', async () => {
    mockedFeatured.mockRejectedValue(new Error('network down'));

    render(await Home());

    expect(screen.queryByRole('heading', { name: /featured/i })).not.toBeInTheDocument();
  });
});

describe('/ — Meet CJ teaser', () => {
  test('shows the CMS heading and photo, and links through to the about page', async () => {
    const about: AboutPage = {
      heading: 'Meet CJ Lavender',
      photo: { asset: { _ref: 'image-abc123def456-800x800-jpg', _type: 'reference' } },
    };
    mockedAbout.mockResolvedValue(about);

    render(await Home());

    expect(screen.getByRole('heading', { name: 'Meet CJ Lavender' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Meet CJ Lavender' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /about/i })).toHaveAttribute('href', '/about');
  });

  test('falls back to the static heading when Sanity has no about content yet', async () => {
    render(await Home());

    expect(screen.getByRole('heading', { name: 'Meet CJ' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /about/i })).toHaveAttribute('href', '/about');
  });

  test('falls back gracefully instead of crashing when Sanity throws', async () => {
    mockedAbout.mockRejectedValue(new Error('network down'));

    render(await Home());

    expect(screen.getByRole('heading', { name: 'Meet CJ' })).toBeInTheDocument();
  });
});

describe('/ — next event', () => {
  test('shows the single soonest upcoming circle', async () => {
    mockedUpcoming.mockResolvedValue([
      EVENT,
      { ...EVENT, _id: 'e2', title: 'September Crochet Circle', slug: 'september-circle' },
    ]);

    render(await Home());

    expect(screen.getByRole('heading', { name: /next event/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /august crochet circle/i })).toHaveAttribute(
      'href',
      '/community/august-circle',
    );
    expect(screen.queryByRole('link', { name: /september crochet circle/i })).not.toBeInTheDocument();
  });

  test('omits the section entirely when there is nothing upcoming', async () => {
    render(await Home());

    expect(screen.queryByRole('heading', { name: /next event/i })).not.toBeInTheDocument();
  });

  test('degrades to an omitted section instead of crashing when Sanity throws', async () => {
    mockedUpcoming.mockRejectedValue(new Error('network down'));

    render(await Home());

    expect(screen.queryByRole('heading', { name: /next event/i })).not.toBeInTheDocument();
  });
});

describe('/ — latest posts', () => {
  test('shows the first 2 posts as PostCards, in the order Sanity returns them', async () => {
    mockedPosts.mockResolvedValue([
      POST,
      { ...POST, _id: 'post2', title: 'Second Post', slug: 'second-post' },
      { ...POST, _id: 'post3', title: 'Third Post', slug: 'third-post' },
    ]);

    render(await Home());

    expect(screen.getByRole('heading', { name: /latest posts/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /a weekend with the fiber guild/i })).toHaveAttribute(
      'href',
      '/blog/fiber-guild-weekend',
    );
    expect(screen.getByRole('link', { name: /second post/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /third post/i })).not.toBeInTheDocument();
  });

  test('omits the section entirely when there are no posts', async () => {
    render(await Home());

    expect(screen.queryByRole('heading', { name: /latest posts/i })).not.toBeInTheDocument();
  });

  test('degrades to an omitted section instead of crashing when Sanity throws', async () => {
    mockedPosts.mockRejectedValue(new Error('network down'));

    render(await Home());

    expect(screen.queryByRole('heading', { name: /latest posts/i })).not.toBeInTheDocument();
  });
});

describe('/ — dev resilience', () => {
  test('renders fully — hero and the Meet CJ fallback — with zero backing services reachable', async () => {
    mockedFeatured.mockRejectedValue(new Error('down'));
    mockedUpcoming.mockRejectedValue(new Error('down'));
    mockedPosts.mockRejectedValue(new Error('down'));
    mockedAbout.mockRejectedValue(new Error('down'));
    // fetchPricesAndStock itself never throws (see lib/shop/fetch-prices.ts) —
    // an unreachable Square resolves to empty maps, exactly like the default
    // mock above already simulates.

    render(await Home());

    expect(screen.getByRole('heading', { level: 1, name: 'Authentic Creations' })).toBeInTheDocument();
    expect(screen.getByText(/find you in whatever you do/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /shop hats/i })).toHaveAttribute('href', '/shop/hats');
    expect(screen.getByRole('heading', { name: 'Meet CJ' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /about/i })).toHaveAttribute('href', '/about');

    expect(screen.queryByRole('heading', { name: /featured/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /next event/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /latest posts/i })).not.toBeInTheDocument();
  });
});

describe('/ — crochet signatures (Woven spec §3/§4)', () => {
  test('Featured heading pairs a left-side motif with a rose underline', async () => {
    mockedFeatured.mockResolvedValue([product()]);

    render(await Home());

    const { motif, underline } = motifAndUnderlineFor(screen.getByRole('heading', { name: /featured/i }));
    expect(motif).toHaveClass('order-first');
    expect(underline.querySelector('path')).toHaveClass('stroke-rose');
  });

  test('Meet CJ heading pairs a right-side motif with a mustard underline', async () => {
    render(await Home());

    const { motif, underline } = motifAndUnderlineFor(screen.getByRole('heading', { name: 'Meet CJ' }));
    expect(motif).toHaveClass('order-last');
    expect(underline.querySelector('path')).toHaveClass('stroke-mustard');
  });

  test('Next event heading pairs a left-side motif with a sage underline', async () => {
    mockedUpcoming.mockResolvedValue([EVENT]);

    render(await Home());

    const { motif, underline } = motifAndUnderlineFor(
      screen.getByRole('heading', { name: /next event/i }),
    );
    expect(motif).toHaveClass('order-first');
    expect(underline.querySelector('path')).toHaveClass('stroke-sage');
  });

  test('Latest posts heading pairs a right-side motif with a plum underline', async () => {
    mockedPosts.mockResolvedValue([POST]);

    render(await Home());

    const { motif, underline } = motifAndUnderlineFor(
      screen.getByRole('heading', { name: /latest posts/i }),
    );
    expect(motif).toHaveClass('order-last');
    expect(underline.querySelector('path')).toHaveClass('stroke-plum');
  });

  test('renders exactly one motif per rendered section — four when every section has content', async () => {
    mockedFeatured.mockResolvedValue([product()]);
    mockedUpcoming.mockResolvedValue([EVENT]);
    mockedPosts.mockResolvedValue([POST]);

    render(await Home());

    expect(screen.getAllByTestId('granny-motif')).toHaveLength(4);
  });
});

describe('/ — bands (Woven spec §3)', () => {
  test('Meet CJ section sits on the sage-band tint, not the flat linen fill', async () => {
    render(await Home());

    const section = screen.getByRole('heading', { name: 'Meet CJ' }).closest('section');
    expect(section).toHaveClass('bg-sage-band');
    expect(section).not.toHaveClass('bg-linen');
  });

  test('Next event section sits on the sand band', async () => {
    mockedUpcoming.mockResolvedValue([EVENT]);

    render(await Home());

    const section = screen.getByRole('heading', { name: /next event/i }).closest('section');
    expect(section).toHaveClass('bg-sand');
  });
});

describe('/ — Featured grid: entrance stagger + quilt rotation (Woven spec §3/§5)', () => {
  test('the grid wrapper carries the reveal-grid class', async () => {
    mockedFeatured.mockResolvedValue([product()]);

    render(await Home());

    const section = screen.getByRole('heading', { name: /featured/i }).closest('section');
    expect(section!.querySelector('.reveal-grid')).not.toBeNull();
  });

  test('the first three cards rotate mustard/rose/sage quilt frames by grid position', async () => {
    mockedFeatured.mockResolvedValue([
      product({ _id: 'p1', title: 'Hat One', slug: 'hat-one', squareVariationId: 'var-1' }),
      product({ _id: 'p2', title: 'Hat Two', slug: 'hat-two', squareVariationId: 'var-2' }),
      product({ _id: 'p3', title: 'Hat Three', slug: 'hat-three', squareVariationId: 'var-3' }),
    ]);

    render(await Home());

    const cards = screen.getAllByRole('link', { name: /hat (one|two|three)/i });
    expect(cards[0]).toHaveClass('border-mustard');
    expect(cards[1]).toHaveClass('border-rose');
    expect(cards[2]).toHaveClass('border-sage');
  });
});

describe('/ — Latest posts: quilt rotation without entrance stagger (Woven spec §3)', () => {
  test('cards rotate quilt frames by grid position, but the grid is not wrapped for stagger', async () => {
    mockedPosts.mockResolvedValue([
      POST,
      { ...POST, _id: 'post2', title: 'Second Post', slug: 'second-post' },
    ]);

    render(await Home());

    const section = screen.getByRole('heading', { name: /latest posts/i }).closest('section');
    expect(section!.querySelector('.reveal-grid')).toBeNull();

    const cards = screen.getAllByRole('link', {
      name: /(a weekend with the fiber guild|second post)/i,
    });
    expect(cards[0]).toHaveClass('border-mustard');
    expect(cards[1]).toHaveClass('border-rose');
  });
});
