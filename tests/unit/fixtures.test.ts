/**
 * Tests for the two development-only fixture layers.
 *
 * The property that matters most here is the *negative* one: with the flags
 * unset, neither seam is on. A fixture catalog that leaked into a deployed
 * build would sell real customers imaginary hats at imaginary prices, so the
 * "flag off" cases below are not ceremony — they are the guard rail.
 *
 * The second property is that the two fixture sets agree with each other: every
 * variation id the Sanity products carry must be one the Square catalog prices,
 * or the E2E suite tests a shop where nothing has a price.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SquareGatewayError } from '@/lib/square/errors';

const mocked = vi.hoisted(() => ({ client: {} as Record<string, unknown> }));

vi.mock('square', () => ({
  SquareClient: class {
    constructor(options: unknown) {
      mocked.client.constructedWith = options;
      return mocked.client;
    }
  },
  SquareEnvironment: {
    Production: 'https://connect.squareup.com',
    Sandbox: 'https://connect.squareupsandbox.com',
  },
}));

const { realGateway } = await import('@/lib/square/gateway');
const { FIXTURE_VARIATIONS, sanityFixtures, sanityFixturesEnabled, fixtureRsvpDeps } = await import(
  '@/lib/sanity/fixtures'
);
const { squareFixturesEnabled } = await import('@/lib/square/fixtures');
const { pieceName, piecesOf } = await import('@/lib/shop/pieces');
const queries = await import('@/lib/sanity/queries');

beforeEach(() => {
  mocked.client = {
    catalog: { batchGet: vi.fn().mockResolvedValue({ objects: [] }) },
  };
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------

describe('SQUARE_FAKE — flag off', () => {
  it('is off when the variable is unset', () => {
    vi.stubEnv('SQUARE_FAKE', undefined);
    expect(squareFixturesEnabled()).toBe(false);
  });

  it('is off for any value other than exactly "1"', () => {
    for (const value of ['0', 'true', 'yes', '', ' 1']) {
      vi.stubEnv('SQUARE_FAKE', value);
      expect(squareFixturesEnabled()).toBe(false);
    }
  });

  it('leaves the real client-construction path untouched', () => {
    vi.stubEnv('SQUARE_FAKE', undefined);
    vi.stubEnv('SQUARE_ACCESS_TOKEN', 'test-token');
    vi.stubEnv('SQUARE_ENVIRONMENT', 'sandbox');
    vi.stubEnv('SQUARE_LOCATION_ID', 'LOC-1');

    realGateway();

    expect(mocked.client.constructedWith).toEqual({
      token: 'test-token',
      environment: 'https://connect.squareupsandbox.com',
    });
  });

  it('still refuses to build without credentials', () => {
    vi.stubEnv('SQUARE_FAKE', undefined);
    vi.stubEnv('SQUARE_ACCESS_TOKEN', '');
    vi.stubEnv('SQUARE_ENVIRONMENT', 'sandbox');
    vi.stubEnv('SQUARE_LOCATION_ID', 'LOC-1');

    expect(() => realGateway()).toThrow(SquareGatewayError);
  });
});

describe('SQUARE_FAKE — flag on', () => {
  beforeEach(() => {
    vi.stubEnv('SQUARE_FAKE', '1');
    // Deliberately no Square credentials: needing none is the point.
    vi.stubEnv('SQUARE_ACCESS_TOKEN', '');
    vi.stubEnv('SQUARE_ENVIRONMENT', '');
    vi.stubEnv('SQUARE_LOCATION_ID', '');
  });

  it('builds a gateway with no credentials and never constructs the SDK client', () => {
    const gateway = realGateway();

    expect(gateway).toBeDefined();
    expect(mocked.client.constructedWith).toBeUndefined();
  });

  it('prices variations from the fixture catalog, in cents', async () => {
    const variations = await realGateway().getVariations([FIXTURE_VARIATIONS.ruffledBucketHat]);

    expect(variations.get(FIXTURE_VARIATIONS.ruffledBucketHat)).toEqual({
      id: FIXTURE_VARIATIONS.ruffledBucketHat,
      priceCents: 4500,
      trackInventory: true,
    });
  });

  it('omits unknown ids rather than inventing a price for them', async () => {
    const variations = await realGateway().getVariations(['NOT-A-REAL-ID']);

    expect(variations.size).toBe(0);
  });

  it('reports one product as sold out and another as in stock', async () => {
    const counts = await realGateway().getInventoryCounts([
      FIXTURE_VARIATIONS.beanie,
      FIXTURE_VARIATIONS.slouchBag,
    ]);

    expect(counts.get(FIXTURE_VARIATIONS.beanie)).toBe(0);
    expect(counts.get(FIXTURE_VARIATIONS.slouchBag)).toBeGreaterThan(0);
  });

  it('gives the made-to-order custom variation no count row at all', async () => {
    // Absence is how the app tells "always available" from "sold out"; a 0 here
    // would make every custom order unbuyable.
    const counts = await realGateway().getInventoryCounts([
      FIXTURE_VARIATIONS.customRuffledBucketHat,
    ]);

    expect(counts.has(FIXTURE_VARIATIONS.customRuffledBucketHat)).toBe(false);
  });

  it('returns a payment link spelling out the order it was given', async () => {
    const { url } = await realGateway().createPaymentLink({
      lineItems: [
        { variationId: FIXTURE_VARIATIONS.slouchBag, quantity: 2 },
        {
          variationId: FIXTURE_VARIATIONS.customRuffledBucketHat,
          quantity: 1,
          note: 'Custom order — Color: Blue. with a wide brim please',
        },
      ],
      redirectUrl: 'http://localhost:3000/thanks',
    });

    const parsed = new URL(url);
    expect(parsed.origin).toBe('https://sandbox.square.link');
    expect(parsed.searchParams.get('items')).toBe(
      `${FIXTURE_VARIATIONS.slouchBag}:2,${FIXTURE_VARIATIONS.customRuffledBucketHat}:1`,
    );
    expect(parsed.searchParams.get('notes')).toContain('Color: Blue');
    expect(parsed.searchParams.get('redirect')).toBe('http://localhost:3000/thanks');
  });

  it('refuses an empty order, as Square would', async () => {
    await expect(
      realGateway().createPaymentLink({ lineItems: [], redirectUrl: 'http://localhost:3000/thanks' }),
    ).rejects.toThrow(SquareGatewayError);
  });
});

// ---------------------------------------------------------------------------

describe('SANITY_FAKE — flag off', () => {
  it('is off when the variable is unset, and off for anything but "1"', () => {
    vi.stubEnv('SANITY_FAKE', undefined);
    expect(sanityFixturesEnabled()).toBe(false);

    for (const value of ['0', 'true', '']) {
      vi.stubEnv('SANITY_FAKE', value);
      expect(sanityFixturesEnabled()).toBe(false);
    }
  });

  it('leaves the query helpers fetching from Sanity', async () => {
    vi.stubEnv('SANITY_FAKE', undefined);
    const client = await import('@/lib/sanity/client');
    // `fetch` is overloaded and its resolved type varies by call shape; the
    // assertion below is about *whether* it was called, not what it answered.
    const fetchSpy = vi.spyOn(client.sanityClient, 'fetch').mockResolvedValue([] as never);

    await queries.getProducts('hats');

    expect(fetchSpy).toHaveBeenCalledWith(queries.PRODUCTS_QUERY, { section: 'hats' });
  });
});

describe('SANITY_FAKE — flag on', () => {
  beforeEach(() => {
    vi.stubEnv('SANITY_FAKE', '1');
  });

  it('serves products through the query helpers without touching Sanity', async () => {
    const client = await import('@/lib/sanity/client');
    const fetchSpy = vi.spyOn(client.sanityClient, 'fetch');

    const hats = await queries.getProducts('hats');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(hats.length).toBeGreaterThan(0);
    expect(hats.every((product) => product.section === 'hats')).toBe(true);
  });

  it('covers the four shapes the shop pages need', () => {
    const all = [...sanityFixtures.products('hats'), ...sanityFixtures.products('accessories')];

    expect(all.some((product) => product.featured === true)).toBe(true);
    expect(all.some((product) => (product.variants?.length ?? 0) > 1)).toBe(true);
    expect(all.some((product) => Boolean(product.customSquareVariationId))).toBe(true);
    expect(all.length).toBeGreaterThanOrEqual(3);
  });

  it('leaves squareVariationId empty on the variants product', () => {
    // Authoring both would price the grid tile from one source and the buy
    // button from another — the pre-flight rule in the runbook.
    const flowers = sanityFixtures.product('crochet-flowers');

    expect(flowers?.variants?.length).toBe(3);
    expect(flowers?.squareVariationId ?? '').toBe('');
  });

  it('offers custom ids on some flower styles and not on others', () => {
    // Both halves matter to the custom page: the styles with an id are the
    // picker, and the style without one is the branch that leaves it off.
    const variants = sanityFixtures.product('crochet-flowers')?.variants ?? [];
    const withCustom = variants.filter((variant) => Boolean(variant.customSquareVariationId));

    expect(withCustom.length).toBeGreaterThan(0);
    expect(withCustom.length).toBeLessThan(variants.length);
  });

  it('sells exactly one product by piece, covering every state the picker renders', () => {
    const all = [...sanityFixtures.products('hats'), ...sanityFixtures.products('accessories')];
    const byPiece = all.filter((product) => product.sellByPiece === true);

    expect(byPiece).toHaveLength(1);
    const pieces = piecesOf(byPiece[0]);
    expect(pieces.map(pieceName)).toEqual(['Sunset', 'Piece 2', 'Driftwood']);
    expect(pieces.filter((piece) => piece.sold)).toHaveLength(1);
    // Keys, because the picker keys its tiles by them; no assets, because a
    // fixture run must never reach cdn.sanity.io for a photo that isn't there.
    expect(pieces.every((piece) => piece.photo._key !== undefined)).toBe(true);
    expect(pieces.every((piece) => piece.photo.asset === undefined)).toBe(true);
  });

  it('leaves every other fixture product exactly as it was', () => {
    const others = [
      ...sanityFixtures.products('hats'),
      ...sanityFixtures.products('accessories'),
    ].filter((product) => product.sellByPiece !== true);

    expect(others).toHaveLength(3);
    expect(others.every((product) => product.sellByPiece === undefined)).toBe(true);
    expect(others.every((product) => product.photos === undefined)).toBe(true);
  });

  it('keeps a product whose custom order is the whole product, not a style', () => {
    // The other branch of the same page: no styles at all, one top-level id.
    const hat = sanityFixtures.product('crochet-ruffled-bucket-hat');

    expect(hat?.customSquareVariationId).toBeTruthy();
    expect(hat?.variants ?? []).toHaveLength(0);
  });

  it('orders products by displayOrder and posts newest first', () => {
    const hats = sanityFixtures.products('hats');
    expect(hats.map((product) => product.displayOrder)).toEqual(
      [...hats.map((product) => product.displayOrder)].sort((a, b) => (a ?? 0) - (b ?? 0)),
    );

    const posts = sanityFixtures.posts();
    expect(posts.length).toBeGreaterThanOrEqual(2);
    expect(posts[0].publishedAt! > posts[1].publishedAt!).toBe(true);
  });

  it('keeps the upcoming events in the future and the past one behind', () => {
    const now = new Date();

    const upcoming = sanityFixtures.upcomingEvents(now);
    const past = sanityFixtures.pastEvents(now);

    expect(upcoming.length).toBeGreaterThanOrEqual(2);
    expect(upcoming.every((event) => new Date(event.startsAt) > now)).toBe(true);
    expect(past.every((event) => new Date(event.startsAt) < now)).toBe(true);
  });

  it('has one circle with room and one already full', () => {
    const open = sanityFixtures.eventBySlug('cozy-crochet-circle');
    const full = sanityFixtures.eventBySlug('sold-out-stitching-circle');

    expect(sanityFixtures.rsvpCount(open!._id)).toBeLessThan(open!.capacity!);
    expect(sanityFixtures.rsvpCount(full!._id)).toBeGreaterThanOrEqual(full!.capacity!);
  });

  it('records an RSVP and then recognises it as a duplicate', async () => {
    const event = sanityFixtures.eventBySlug('cozy-crochet-circle')!;
    const email = `guest-${Math.random().toString(36).slice(2)}@example.com`;

    expect(await fixtureRsvpDeps.emailExists(event._id, email)).toBe(false);
    await fixtureRsvpDeps.create({ eventId: event._id, name: 'Guest', email });

    expect(await fixtureRsvpDeps.emailExists(event._id, email)).toBe(true);
    // Case and padding must not open a second seat.
    expect(await fixtureRsvpDeps.emailExists(event._id, `  ${email.toUpperCase()} `)).toBe(true);
  });

  it('serves the about and policies singletons with real body text', () => {
    expect(sanityFixtures.aboutPage().body?.length).toBeGreaterThan(0);
    expect(sanityFixtures.policiesPage().body?.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------

describe('the two fixture sets agree', () => {
  it('stocks one Square variation with exactly as many on hand as there are pieces', async () => {
    // The pilot's whole inventory model: one variation per sell-by-piece
    // product, whose count is the total number of physical pieces. Per-piece
    // SKUs are deliberately not a thing, so this is the only number that can
    // stop an oversale.
    vi.stubEnv('SQUARE_FAKE', '1');
    const bag = sanityFixtures.product('crochet-slouch-bag')!;

    const counts = await realGateway().getInventoryCounts([bag.squareVariationId!]);

    expect(bag.sellByPiece).toBe(true);
    expect(counts.get(bag.squareVariationId!)).toBe(piecesOf(bag).length);
  });

  it('prices every variation id the fixture products reference', async () => {
    vi.stubEnv('SQUARE_FAKE', '1');
    const products = [
      ...sanityFixtures.products('hats'),
      ...sanityFixtures.products('accessories'),
    ];

    const ids = products.flatMap((product) => [
      ...(product.squareVariationId ? [product.squareVariationId] : []),
      ...(product.customSquareVariationId ? [product.customSquareVariationId] : []),
      ...(product.variants ?? []).flatMap((variant) => [
        variant.squareVariationId,
        ...(variant.customSquareVariationId ? [variant.customSquareVariationId] : []),
      ]),
    ]);
    expect(ids.length).toBeGreaterThan(0);

    const variations = await realGateway().getVariations(ids);

    expect([...variations.keys()].sort()).toEqual([...new Set(ids)].sort());
  });
});
