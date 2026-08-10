/**
 * Gateway tests. Unlike `square-service.test.ts` (which uses a hand-rolled fake
 * and never loads the SDK at all), this file replaces the `square` module with
 * a structural stand-in so the *translation* layer can be exercised: what we
 * send Square, what we make of what comes back, and — critically — that no raw
 * SDK failure escapes as anything other than a SquareGatewayError.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SquareGatewayError } from '@/lib/square/errors';

const mocked = vi.hoisted(() => ({ client: {} as Record<string, unknown> }));

vi.mock('square', () => ({
  // Returning an object from a constructor overrides `this`, so
  // `new SquareClient(...)` hands back whatever the current test installed.
  SquareClient: class {
    constructor() {
      return mocked.client;
    }
  },
  SquareEnvironment: {
    Production: 'https://connect.squareup.com',
    Sandbox: 'https://connect.squareupsandbox.com',
  },
}));

const { realGateway } = await import('@/lib/square/gateway');

const LOCATION = 'LOC-1';

/** Structural stand-in for the SDK's `core.Page`: iterable, plus `.response`. */
function fakePage(options: {
  counts?: Record<string, unknown>[];
  errors?: { detail?: string }[];
  throwOnIteration?: boolean;
}) {
  return {
    response: { errors: options.errors },
    async *[Symbol.asyncIterator]() {
      for (const count of options.counts ?? []) {
        yield count;
      }
      if (options.throwOnIteration) {
        throw new Error('cursor expired while paginating');
      }
    },
  };
}

function installClient(overrides: Record<string, unknown>): void {
  mocked.client = {
    catalog: { batchGet: vi.fn().mockResolvedValue({ objects: [] }) },
    inventory: { batchGetCounts: vi.fn().mockResolvedValue(fakePage({})) },
    checkout: {
      paymentLinks: {
        create: vi.fn().mockResolvedValue({ paymentLink: { url: 'https://square.link/u/abc' } }),
      },
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubEnv('SQUARE_ACCESS_TOKEN', 'test-token');
  vi.stubEnv('SQUARE_ENVIRONMENT', 'sandbox');
  vi.stubEnv('SQUARE_LOCATION_ID', LOCATION);
  installClient({});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('realGateway configuration', () => {
  it('throws a SquareGatewayError when a required env var is missing', () => {
    vi.stubEnv('SQUARE_LOCATION_ID', '');
    expect(() => realGateway()).toThrow(SquareGatewayError);
  });

  it('throws a SquareGatewayError for an unrecognised SQUARE_ENVIRONMENT', () => {
    vi.stubEnv('SQUARE_ENVIRONMENT', 'staging');
    expect(() => realGateway()).toThrow(/sandbox.*production/i);
  });
});

describe('getVariations', () => {
  it('maps price to integer cents and resolves the location override', async () => {
    const batchGet = vi.fn().mockResolvedValue({
      objects: [
        {
          type: 'ITEM_VARIATION',
          id: 'var-global',
          itemVariationData: {
            priceMoney: { amount: BigInt(4500), currency: 'USD' },
            trackInventory: true,
          },
        },
        {
          type: 'ITEM_VARIATION',
          id: 'var-override',
          itemVariationData: {
            priceMoney: { amount: BigInt(4500), currency: 'USD' },
            trackInventory: true,
            locationOverrides: [
              {
                locationId: LOCATION,
                priceMoney: { amount: BigInt(5000), currency: 'USD' },
                trackInventory: false,
              },
            ],
          },
        },
        // Variable pricing: no amount to trust, so it must be omitted.
        {
          type: 'ITEM_VARIATION',
          id: 'var-variable',
          itemVariationData: { pricingType: 'VARIABLE_PRICING' },
        },
        { type: 'ITEM', id: 'item-1', itemData: { name: 'not a variation' } },
      ],
    });
    installClient({ catalog: { batchGet } });

    const result = await realGateway().getVariations(['var-global', 'var-override']);

    expect(result.get('var-global')).toEqual({
      id: 'var-global',
      priceCents: 4500,
      trackInventory: true,
    });
    expect(result.get('var-override')).toEqual({
      id: 'var-override',
      priceCents: 5000,
      trackInventory: false,
    });
    expect(result.has('var-variable')).toBe(false);
    expect(result.has('item-1')).toBe(false);
  });

  it('throws when Square reports errors in an otherwise successful response', async () => {
    installClient({
      catalog: {
        batchGet: vi.fn().mockResolvedValue({ objects: [], errors: [{ detail: 'bad id' }] }),
      },
    });

    await expect(realGateway().getVariations(['x'])).rejects.toThrow(SquareGatewayError);
  });
});

describe('getInventoryCounts', () => {
  it('floors quantities and ignores rows for other states or locations', async () => {
    installClient({
      inventory: {
        batchGetCounts: vi.fn().mockResolvedValue(
          fakePage({
            counts: [
              { catalogObjectId: 'a', state: 'IN_STOCK', locationId: LOCATION, quantity: '7' },
              { catalogObjectId: 'b', state: 'IN_STOCK', locationId: LOCATION, quantity: '2.9' },
              { catalogObjectId: 'c', state: 'SOLD', locationId: LOCATION, quantity: '9' },
              { catalogObjectId: 'd', state: 'IN_STOCK', locationId: 'OTHER', quantity: '9' },
            ],
          }),
        ),
      },
    });

    const counts = await realGateway().getInventoryCounts(['a', 'b', 'c', 'd']);

    expect(Object.fromEntries(counts)).toEqual({ a: 7, b: 2 });
  });

  it('throws rather than returning a short count map when Square reports errors', async () => {
    // A 200 with partial errors would otherwise yield a silently incomplete map,
    // and a missing id reads as "untracked" — i.e. always available. Fail closed.
    installClient({
      inventory: {
        batchGetCounts: vi.fn().mockResolvedValue(
          fakePage({
            counts: [{ catalogObjectId: 'a', state: 'IN_STOCK', locationId: LOCATION, quantity: '7' }],
            errors: [{ detail: 'location unavailable' }],
          }),
        ),
      },
    });

    await expect(realGateway().getInventoryCounts(['a', 'b'])).rejects.toThrow(SquareGatewayError);
  });

  it('wraps a mid-pagination failure in a SquareGatewayError', async () => {
    installClient({
      inventory: {
        batchGetCounts: vi.fn().mockResolvedValue(
          fakePage({
            counts: [{ catalogObjectId: 'a', state: 'IN_STOCK', locationId: LOCATION, quantity: '7' }],
            throwOnIteration: true,
          }),
        ),
      },
    });

    const error = await realGateway()
      .getInventoryCounts(['a'])
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(SquareGatewayError);
    expect((error as SquareGatewayError).message).toContain('inventory.batchGetCounts');
    expect((error as SquareGatewayError).cause).toBeInstanceOf(Error);
  });

  it('wraps a request failure in a SquareGatewayError', async () => {
    installClient({
      inventory: { batchGetCounts: vi.fn().mockRejectedValue(new Error('ECONNRESET')) },
    });

    await expect(realGateway().getInventoryCounts(['a'])).rejects.toThrow(SquareGatewayError);
  });

  it('does not call Square for an empty id list', async () => {
    const batchGetCounts = vi.fn();
    installClient({ inventory: { batchGetCounts } });

    await expect(realGateway().getInventoryCounts([])).resolves.toEqual(new Map());
    expect(batchGetCounts).not.toHaveBeenCalled();
  });
});

describe('createPaymentLink', () => {
  it('asks the buyer for a shipping address', async () => {
    // Physical goods: without this, orders arrive with no address to ship to.
    const create = vi
      .fn()
      .mockResolvedValue({ paymentLink: { url: 'https://square.link/u/abc' } });
    installClient({ checkout: { paymentLinks: { create } } });

    await realGateway().createPaymentLink({
      lineItems: [{ variationId: 'var-1', quantity: 2, note: 'Custom order — Color: Blue. hi' }],
      redirectUrl: 'https://example.test/thanks',
    });

    const request = create.mock.calls[0][0];
    expect(request.checkoutOptions.askForShippingAddress).toBe(true);
    expect(request.checkoutOptions.redirectUrl).toBe('https://example.test/thanks');
    // Deferred product decision — must not silently appear.
    expect(request.checkoutOptions.shippingFee).toBeUndefined();
  });

  it('sends order-level location and catalog-backed line items', async () => {
    const create = vi
      .fn()
      .mockResolvedValue({ paymentLink: { url: 'https://square.link/u/abc' } });
    installClient({ checkout: { paymentLinks: { create } } });

    await realGateway().createPaymentLink({
      lineItems: [
        { variationId: 'var-1', quantity: 2 },
        { variationId: 'var-2', quantity: 1, note: 'Custom order — Color: Red. hi' },
      ],
      redirectUrl: 'https://example.test/thanks',
    });

    const request = create.mock.calls[0][0];
    expect(request.idempotencyKey).toEqual(expect.any(String));
    expect(request.order.locationId).toBe(LOCATION);
    expect(request.order.lineItems).toEqual([
      { catalogObjectId: 'var-1', quantity: '2' },
      { catalogObjectId: 'var-2', quantity: '1', note: 'Custom order — Color: Red. hi' },
    ]);
  });

  it('throws when Square returns errors or omits the URL', async () => {
    installClient({
      checkout: {
        paymentLinks: { create: vi.fn().mockResolvedValue({ errors: [{ detail: 'nope' }] }) },
      },
    });
    await expect(
      realGateway().createPaymentLink({ lineItems: [], redirectUrl: 'https://example.test/thanks' }),
    ).rejects.toThrow(SquareGatewayError);

    installClient({
      checkout: { paymentLinks: { create: vi.fn().mockResolvedValue({ paymentLink: {} }) } },
    });
    await expect(
      realGateway().createPaymentLink({ lineItems: [], redirectUrl: 'https://example.test/thanks' }),
    ).rejects.toThrow(/no URL/i);
  });
});
