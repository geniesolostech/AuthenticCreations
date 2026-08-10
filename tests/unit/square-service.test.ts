import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SquareGateway, VariationInfo } from '@/lib/square/gateway';
import {
  INVENTORY_CACHE_MAX_ENTRIES,
  SQUARE_LINE_ITEM_NOTE_MAX,
  createCheckout,
  makeInventoryService,
} from '@/lib/square/service';
import type { CartLine } from '@/lib/types';

const SITE_URL = 'https://authentic-creations.test';

/**
 * Hand-rolled stand-in for the real Square gateway. Mirrors the real one's
 * contract exactly: unknown ids are omitted from `getVariations`, and untracked
 * ids are omitted from `getInventoryCounts` (Square has no count row for them).
 */
class FakeGateway implements SquareGateway {
  variations = new Map<string, VariationInfo>();
  inventory = new Map<string, number>();
  paymentLinkUrl = 'https://square.link/u/fake';

  /** Set to make the next call of the named method reject. */
  failOn: Partial<Record<keyof SquareGateway, Error>> = {};

  calls = {
    getVariations: [] as string[][],
    getInventoryCounts: [] as string[][],
    createPaymentLink: [] as Parameters<SquareGateway['createPaymentLink']>[0][],
  };

  withVariation(info: VariationInfo): this {
    this.variations.set(info.id, info);
    return this;
  }

  withCount(id: string, count: number): this {
    this.inventory.set(id, count);
    return this;
  }

  async getVariations(ids: string[]): Promise<Map<string, VariationInfo>> {
    this.calls.getVariations.push([...ids]);
    if (this.failOn.getVariations) throw this.failOn.getVariations;
    const out = new Map<string, VariationInfo>();
    for (const id of ids) {
      const info = this.variations.get(id);
      if (info) out.set(id, info);
    }
    return out;
  }

  async getInventoryCounts(ids: string[]): Promise<Map<string, number>> {
    this.calls.getInventoryCounts.push([...ids]);
    if (this.failOn.getInventoryCounts) throw this.failOn.getInventoryCounts;
    const out = new Map<string, number>();
    for (const id of ids) {
      const count = this.inventory.get(id);
      // Untracked variations simply have no count row.
      if (count !== undefined) out.set(id, count);
    }
    return out;
  }

  async createPaymentLink(
    input: Parameters<SquareGateway['createPaymentLink']>[0],
  ): Promise<{ url: string }> {
    this.calls.createPaymentLink.push(input);
    if (this.failOn.createPaymentLink) throw this.failOn.createPaymentLink;
    return { url: this.paymentLinkUrl };
  }
}

let nextLineId = 0;
function line(overrides: Partial<CartLine> = {}): CartLine {
  nextLineId += 1;
  return {
    lineId: `line-${nextLineId}`,
    variationId: 'var-ready',
    name: 'Crochet Beanie',
    unitAmount: 4500,
    quantity: 1,
    ...overrides,
  };
}

/** A gateway with one tracked ready-made and one untracked made-to-order item. */
function shopGateway(): FakeGateway {
  return new FakeGateway()
    .withVariation({ id: 'var-ready', priceCents: 4500, trackInventory: true })
    .withVariation({ id: 'var-custom', priceCents: 6000, trackInventory: false })
    .withCount('var-ready', 5);
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', SITE_URL);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('createCheckout', () => {
  it('returns EMPTY_CART for an empty cart without touching Square', async () => {
    const gw = shopGateway();

    const result = await createCheckout([], gw);

    expect(result).toEqual({ ok: false, error: 'EMPTY_CART' });
    expect(gw.calls.getVariations).toHaveLength(0);
    expect(gw.calls.createPaymentLink).toHaveLength(0);
  });

  it('returns the payment link url and passes correct line items on the happy path', async () => {
    const gw = shopGateway();
    const cart = [
      line({ variationId: 'var-ready', unitAmount: 4500, quantity: 2 }),
      line({
        variationId: 'var-custom',
        name: 'Custom — Crochet Beanie',
        unitAmount: 6000,
        quantity: 1,
        custom: { color: 'Blue', comments: 'Please make it extra slouchy.' },
      }),
    ];

    const result = await createCheckout(cart, gw);

    expect(result).toEqual({ ok: true, url: 'https://square.link/u/fake' });
    expect(gw.calls.createPaymentLink).toHaveLength(1);
    expect(gw.calls.createPaymentLink[0]).toEqual({
      lineItems: [
        { variationId: 'var-ready', quantity: 2 },
        {
          variationId: 'var-custom',
          quantity: 1,
          note: 'Custom order — Color: Blue. Please make it extra slouchy.',
        },
      ],
      redirectUrl: `${SITE_URL}/thanks`,
    });
  });

  it('uses the exact em-dash note format for custom lines', async () => {
    const gw = shopGateway();
    const cart = [
      line({
        variationId: 'var-custom',
        unitAmount: 6000,
        custom: { color: 'Red', comments: 'For my sister.' },
      }),
    ];

    await createCheckout(cart, gw);

    const note = gw.calls.createPaymentLink[0].lineItems[0].note;
    expect(note).toBe('Custom order — Color: Red. For my sister.');
    // em dash (U+2014), not a hyphen
    expect(note).toContain('—');
    expect(note).not.toContain(' - ');
  });

  it('omits the note for non-custom lines', async () => {
    const gw = shopGateway();

    await createCheckout([line()], gw);

    expect(gw.calls.createPaymentLink[0].lineItems[0].note).toBeUndefined();
  });

  it("truncates an over-long custom note to Square's line-item note limit", async () => {
    const gw = shopGateway();
    const cart = [
      line({
        variationId: 'var-custom',
        unitAmount: 6000,
        custom: { color: 'Green', comments: 'x'.repeat(SQUARE_LINE_ITEM_NOTE_MAX + 500) },
      }),
    ];

    const result = await createCheckout(cart, gw);

    expect(result.ok).toBe(true);
    const note = gw.calls.createPaymentLink[0].lineItems[0].note!;
    expect(note).toHaveLength(SQUARE_LINE_ITEM_NOTE_MAX);
    expect(note.startsWith('Custom order — Color: Green. ')).toBe(true);
  });

  it('leaves a note that is exactly at the limit untouched', async () => {
    const gw = shopGateway();
    const prefix = 'Custom order — Color: Green. ';
    const comments = 'y'.repeat(SQUARE_LINE_ITEM_NOTE_MAX - prefix.length);
    const cart = [
      line({ variationId: 'var-custom', unitAmount: 6000, custom: { color: 'Green', comments } }),
    ];

    await createCheckout(cart, gw);

    const note = gw.calls.createPaymentLink[0].lineItems[0].note!;
    expect(note).toHaveLength(SQUARE_LINE_ITEM_NOTE_MAX);
    expect(note).toBe(prefix + comments);
  });

  it('truncates a note that is one character over the limit', async () => {
    const gw = shopGateway();
    const prefix = 'Custom order — Color: Green. ';
    const comments = 'z'.repeat(SQUARE_LINE_ITEM_NOTE_MAX - prefix.length + 1);
    const cart = [
      line({ variationId: 'var-custom', unitAmount: 6000, custom: { color: 'Green', comments } }),
    ];

    await createCheckout(cart, gw);

    const note = gw.calls.createPaymentLink[0].lineItems[0].note!;
    expect(note).toHaveLength(SQUARE_LINE_ITEM_NOTE_MAX);
    expect(note).toBe((prefix + comments).slice(0, SQUARE_LINE_ITEM_NOTE_MAX));
  });

  it('never splits a surrogate pair when truncating', async () => {
    const gw = shopGateway();
    // Emoji are two UTF-16 code units each, so a naive slice would land mid-pair.
    const cart = [
      line({
        variationId: 'var-custom',
        unitAmount: 6000,
        custom: { color: 'Green', comments: '🧶'.repeat(SQUARE_LINE_ITEM_NOTE_MAX) },
      }),
    ];

    await createCheckout(cart, gw);

    const note = gw.calls.createPaymentLink[0].lineItems[0].note!;
    expect(note.length).toBeLessThanOrEqual(SQUARE_LINE_ITEM_NOTE_MAX);
    expect([...note].length).toBeLessThanOrEqual(SQUARE_LINE_ITEM_NOTE_MAX);
    const lone = [...note].filter((char) => {
      const code = char.codePointAt(0)!;
      return code >= 0xd800 && code <= 0xdfff;
    });
    expect(lone).toEqual([]);
  });

  it('returns SOLD_OUT with the offending ids when a tracked count is below the requested qty', async () => {
    const gw = shopGateway().withCount('var-ready', 1);
    const cart = [line({ variationId: 'var-ready', quantity: 2 })];

    const result = await createCheckout(cart, gw);

    expect(result).toEqual({ ok: false, error: 'SOLD_OUT', soldOutIds: ['var-ready'] });
    expect(gw.calls.createPaymentLink).toHaveLength(0);
  });

  it('allows a tracked line when the count exactly equals the requested qty', async () => {
    const gw = shopGateway().withCount('var-ready', 2);
    const cart = [line({ variationId: 'var-ready', quantity: 2 })];

    await expect(createCheckout(cart, gw)).resolves.toEqual({
      ok: true,
      url: 'https://square.link/u/fake',
    });
  });

  it('sums quantities across cart lines that share a tracked variation', async () => {
    const gw = shopGateway().withCount('var-ready', 3);
    const cart = [
      line({ variationId: 'var-ready', quantity: 2 }),
      line({ variationId: 'var-ready', quantity: 2 }),
    ];

    const result = await createCheckout(cart, gw);

    expect(result).toEqual({ ok: false, error: 'SOLD_OUT', soldOutIds: ['var-ready'] });
  });

  it('reports every sold-out id, de-duplicated', async () => {
    const gw = shopGateway()
      .withVariation({ id: 'var-other', priceCents: 1000, trackInventory: true })
      .withCount('var-ready', 0)
      .withCount('var-other', 0);
    const cart = [
      line({ variationId: 'var-ready', unitAmount: 4500 }),
      line({ variationId: 'var-ready', unitAmount: 4500 }),
      line({ variationId: 'var-other', unitAmount: 1000 }),
    ];

    const result = await createCheckout(cart, gw);

    expect(result).toEqual({
      ok: false,
      error: 'SOLD_OUT',
      soldOutIds: ['var-ready', 'var-other'],
    });
  });

  it('never marks an untracked made-to-order item sold out, even at count 0', async () => {
    const gw = shopGateway().withCount('var-custom', 0);
    const cart = [
      line({
        variationId: 'var-custom',
        unitAmount: 6000,
        quantity: 10,
        custom: { color: 'Purple', comments: 'ready-mades are gone, make me one' },
      }),
    ];

    const result = await createCheckout(cart, gw);

    expect(result).toEqual({ ok: true, url: 'https://square.link/u/fake' });
  });

  it('never marks an untracked item sold out when Square omits its count row', async () => {
    const gw = shopGateway(); // var-custom has no count row at all
    const cart = [line({ variationId: 'var-custom', unitAmount: 6000, quantity: 4 })];

    await expect(createCheckout(cart, gw)).resolves.toEqual({
      ok: true,
      url: 'https://square.link/u/fake',
    });
  });

  it('does not query inventory when every line is untracked', async () => {
    const gw = shopGateway();

    await createCheckout([line({ variationId: 'var-custom', unitAmount: 6000 })], gw);

    expect(gw.calls.getInventoryCounts).toHaveLength(0);
  });

  it('returns PRICE_CHANGED when the catalog price no longer matches the cart price', async () => {
    const gw = shopGateway();
    const cart = [line({ variationId: 'var-ready', unitAmount: 4000 })];

    const result = await createCheckout(cart, gw);

    expect(result).toEqual({ ok: false, error: 'PRICE_CHANGED' });
    expect(gw.calls.createPaymentLink).toHaveLength(0);
  });

  it('checks SOLD_OUT before PRICE_CHANGED', async () => {
    const gw = shopGateway().withCount('var-ready', 0);
    const cart = [line({ variationId: 'var-ready', unitAmount: 1 })];

    const result = await createCheckout(cart, gw);

    expect(result).toEqual({ ok: false, error: 'SOLD_OUT', soldOutIds: ['var-ready'] });
  });

  it('treats a variation missing from the catalog as sold out', async () => {
    const gw = shopGateway();
    const cart = [line({ variationId: 'var-deleted', unitAmount: 4500 })];

    const result = await createCheckout(cart, gw);

    expect(result).toEqual({ ok: false, error: 'SOLD_OUT', soldOutIds: ['var-deleted'] });
    expect(gw.calls.createPaymentLink).toHaveLength(0);
  });

  it('returns SQUARE_UNAVAILABLE when the catalog lookup throws', async () => {
    const gw = shopGateway();
    gw.failOn.getVariations = new Error('connection reset');

    await expect(createCheckout([line()], gw)).resolves.toEqual({
      ok: false,
      error: 'SQUARE_UNAVAILABLE',
    });
  });

  it('returns SQUARE_UNAVAILABLE when the inventory lookup throws', async () => {
    const gw = shopGateway();
    gw.failOn.getInventoryCounts = new Error('503');

    await expect(createCheckout([line()], gw)).resolves.toEqual({
      ok: false,
      error: 'SQUARE_UNAVAILABLE',
    });
  });

  it('returns SQUARE_UNAVAILABLE when payment-link creation throws', async () => {
    const gw = shopGateway();
    gw.failOn.createPaymentLink = new Error('rate limited');

    await expect(createCheckout([line()], gw)).resolves.toEqual({
      ok: false,
      error: 'SQUARE_UNAVAILABLE',
    });
  });

  it('returns SQUARE_UNAVAILABLE rather than a broken link when the site URL is unconfigured', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const gw = shopGateway();

    await expect(createCheckout([line()], gw)).resolves.toEqual({
      ok: false,
      error: 'SQUARE_UNAVAILABLE',
    });
    expect(gw.calls.createPaymentLink).toHaveLength(0);
  });

  it('strips a trailing slash from the configured site URL', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', `${SITE_URL}/`);
    const gw = shopGateway();

    await createCheckout([line()], gw);

    expect(gw.calls.createPaymentLink[0].redirectUrl).toBe(`${SITE_URL}/thanks`);
  });

  it('asks the catalog for each distinct variation exactly once', async () => {
    const gw = shopGateway();
    const cart = [
      line({ variationId: 'var-ready' }),
      line({ variationId: 'var-ready' }),
      line({ variationId: 'var-custom', unitAmount: 6000 }),
    ];

    await createCheckout(cart, gw);

    expect(gw.calls.getVariations).toHaveLength(1);
    expect(gw.calls.getVariations[0]).toEqual(['var-ready', 'var-custom']);
  });
});

describe('makeInventoryService', () => {
  it('returns counts keyed by variation id', async () => {
    const gw = shopGateway();
    const service = makeInventoryService(gw);

    await expect(service.counts(['var-ready'])).resolves.toEqual({ 'var-ready': 5 });
  });

  it('omits untracked variations from the result', async () => {
    const gw = shopGateway();
    const service = makeInventoryService(gw);

    await expect(service.counts(['var-ready', 'var-custom'])).resolves.toEqual({ 'var-ready': 5 });
  });

  it('does not call the gateway for an empty id list', async () => {
    const gw = shopGateway();
    const service = makeInventoryService(gw);

    await expect(service.counts([])).resolves.toEqual({});
    expect(gw.calls.getInventoryCounts).toHaveLength(0);
  });

  it('serves a second call within the TTL from cache', async () => {
    vi.useFakeTimers();
    const gw = shopGateway();
    const service = makeInventoryService(gw, 60_000);

    await service.counts(['var-ready']);
    vi.advanceTimersByTime(59_999);
    await expect(service.counts(['var-ready'])).resolves.toEqual({ 'var-ready': 5 });

    expect(gw.calls.getInventoryCounts).toHaveLength(1);
  });

  it('refetches once the TTL has elapsed', async () => {
    vi.useFakeTimers();
    const gw = shopGateway();
    const service = makeInventoryService(gw, 60_000);

    await service.counts(['var-ready']);
    vi.advanceTimersByTime(60_001);
    gw.withCount('var-ready', 2);
    await expect(service.counts(['var-ready'])).resolves.toEqual({ 'var-ready': 2 });

    expect(gw.calls.getInventoryCounts).toHaveLength(2);
  });

  it('defaults to a 60 second TTL', async () => {
    vi.useFakeTimers();
    const gw = shopGateway();
    const service = makeInventoryService(gw);

    await service.counts(['var-ready']);
    vi.advanceTimersByTime(59_000);
    await service.counts(['var-ready']);
    expect(gw.calls.getInventoryCounts).toHaveLength(1);

    vi.advanceTimersByTime(2_000);
    await service.counts(['var-ready']);
    expect(gw.calls.getInventoryCounts).toHaveLength(2);
  });

  it('caches per id and only fetches the ids it is missing', async () => {
    vi.useFakeTimers();
    const gw = shopGateway().withVariation({
      id: 'var-other',
      priceCents: 1000,
      trackInventory: true,
    });
    gw.withCount('var-other', 7);
    const service = makeInventoryService(gw, 60_000);

    await service.counts(['var-ready']);
    await expect(service.counts(['var-ready', 'var-other'])).resolves.toEqual({
      'var-ready': 5,
      'var-other': 7,
    });

    expect(gw.calls.getInventoryCounts).toEqual([['var-ready'], ['var-other']]);
  });

  it('caches the absence of a count so untracked ids are not refetched', async () => {
    vi.useFakeTimers();
    const gw = shopGateway();
    const service = makeInventoryService(gw, 60_000);

    await service.counts(['var-custom']);
    await service.counts(['var-custom']);

    expect(gw.calls.getInventoryCounts).toHaveLength(1);
  });

  it('does not cache anything when the gateway throws', async () => {
    const gw = shopGateway();
    gw.failOn.getInventoryCounts = new Error('boom');
    const service = makeInventoryService(gw, 60_000);

    await expect(service.counts(['var-ready'])).rejects.toThrow('boom');

    gw.failOn.getInventoryCounts = undefined;
    await expect(service.counts(['var-ready'])).resolves.toEqual({ 'var-ready': 5 });
    expect(gw.calls.getInventoryCounts).toHaveLength(2);
  });

  it('deletes expired entries rather than leaving them resident', async () => {
    vi.useFakeTimers();
    const gw = shopGateway();
    const service = makeInventoryService(gw, 60_000);

    await service.counts(['var-ready']);
    expect(service._cacheSize()).toBe(1);

    vi.advanceTimersByTime(60_001);
    await service.counts(['var-custom']);

    // The expired entry is swept on read, not merely shadowed when re-fetched:
    // ids nobody asks for again must not stay resident for the process's life.
    expect(service._cacheSize()).toBe(1);
  });

  it('never holds more entries than the bound, and still answers in full', async () => {
    const gw = shopGateway().withVariation({
      id: 'id-0',
      priceCents: 100,
      trackInventory: true,
    });
    gw.withCount('id-0', 1).withCount('id-9', 9);
    const service = makeInventoryService(gw, 60_000, 3);
    const ids = Array.from({ length: 10 }, (_, i) => `id-${i}`);

    // Eviction runs after the response is built, so overflowing in a single
    // call can never drop an id out of that call's answer.
    await expect(service.counts(ids)).resolves.toEqual({ 'id-0': 1, 'id-9': 9 });
    expect(service._cacheSize()).toBe(3);
  });

  it('evicts the oldest entries first', async () => {
    vi.useFakeTimers();
    const gw = shopGateway();
    const service = makeInventoryService(gw, 60_000, 2);

    await service.counts(['var-ready']);
    await service.counts(['var-custom']);
    await service.counts(['var-other']);
    expect(service._cacheSize()).toBe(2);

    // The two most recent are still cached; the oldest was evicted and refetches.
    await service.counts(['var-other']);
    expect(gw.calls.getInventoryCounts).toHaveLength(3);

    await service.counts(['var-ready']);
    expect(gw.calls.getInventoryCounts).toHaveLength(4);
  });

  it('bounds the cache at 500 entries by default', async () => {
    const gw = shopGateway();
    const service = makeInventoryService(gw);

    await service.counts(Array.from({ length: 600 }, (_, i) => `id-${i}`));

    expect(INVENTORY_CACHE_MAX_ENTRIES).toBe(500);
    expect(service._cacheSize()).toBe(INVENTORY_CACHE_MAX_ENTRIES);
  });

  it('keeps caches independent between service instances', async () => {
    vi.useFakeTimers();
    const gw = shopGateway();

    await makeInventoryService(gw, 60_000).counts(['var-ready']);
    await makeInventoryService(gw, 60_000).counts(['var-ready']);

    expect(gw.calls.getInventoryCounts).toHaveLength(2);
  });
});
