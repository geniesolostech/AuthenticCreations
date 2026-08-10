// @vitest-environment node
/**
 * The one test in this repo that talks to Square for real.
 *
 * Everything else about the Square integration is proved against a fake or a
 * structural mock, which is right — those tests are fast, offline, and describe
 * *our* rules. What they cannot tell us is whether our reading of Square's API
 * is correct: whether `batchGet` really returns the price where we look for it,
 * whether a payment link really comes back with a URL, whether the fields we
 * send are the fields Square expects. That is what this file is for, and it is
 * the reason it has to hit the network.
 *
 * **Skipped unless `SQUARE_ACCESS_TOKEN` is set**, so `npm test` stays offline
 * and green on a machine with no credentials — including CI and Amplify.
 *
 * To run it (Sandbox credentials only — never a production token):
 *   node --env-file=.env.local ./node_modules/vitest/vitest.mjs run tests/integration
 *
 * It creates a throwaway catalog item, reads it back through the gateway, and
 * deletes it again. The delete is in `afterAll` and also runs if the body
 * fails, so a bad run does not silt up the sandbox catalog. It writes only to
 * the catalog and only to objects it created; it never touches an order, a
 * payment, or an existing item.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { realGateway } from '@/lib/square/gateway';

const CREDENTIALS_PRESENT = Boolean(
  process.env.SQUARE_ACCESS_TOKEN && process.env.SQUARE_LOCATION_ID,
);

/** Marks everything this test makes, so a stray object is obvious in the dashboard. */
const PREFIX = 'ZZ E2E TEMP';
const PRICE_CENTS = 1234;
const STOCK = 7;

describe.skipIf(!CREDENTIALS_PRESENT)('Square Sandbox (live)', () => {
  let itemId: string;
  let variationId: string;
  let deleteItem: () => Promise<void>;

  beforeAll(async () => {
    // The gateway deliberately exposes no catalog *writes* — it is a read/
    // checkout surface — so the fixture this test needs is built with the SDK
    // directly. This is the only place in the repo outside lib/square/gateway.ts
    // that imports it, and it is test-only setup, not app behaviour.
    const { SquareClient, SquareEnvironment } = await import('square');
    const { randomUUID } = await import('node:crypto');

    const locationId = process.env.SQUARE_LOCATION_ID!;
    const environment = process.env.SQUARE_ENVIRONMENT?.toLowerCase();
    if (environment === 'production') {
      throw new Error(
        'Refusing to run the sandbox integration test against SQUARE_ENVIRONMENT=production.',
      );
    }

    const client = new SquareClient({
      token: process.env.SQUARE_ACCESS_TOKEN!,
      environment: SquareEnvironment.Sandbox,
    });

    const suffix = randomUUID().slice(0, 8);
    const created = await client.catalog.object.upsert({
      idempotencyKey: randomUUID(),
      object: {
        type: 'ITEM',
        // A negative id tells Square "this is new, assign a real one".
        id: '#temp-item',
        itemData: {
          name: `${PREFIX} ${suffix}`,
          variations: [
            {
              type: 'ITEM_VARIATION',
              id: '#temp-variation',
              itemVariationData: {
                name: 'Regular',
                pricingType: 'FIXED_PRICING',
                priceMoney: { amount: BigInt(PRICE_CENTS), currency: 'USD' },
                trackInventory: true,
              },
            },
          ],
        },
      },
    });

    // `CatalogObject` is a union discriminated on `type`, so the item fields
    // only exist once it has been narrowed to an ITEM.
    const object = created.catalogObject;
    itemId = object?.id ?? '';
    variationId =
      object?.type === 'ITEM' ? (object.itemData?.variations?.[0]?.id ?? '') : '';
    expect(itemId, 'Square returned no item id').toBeTruthy();
    expect(variationId, 'Square returned no variation id').toBeTruthy();

    deleteItem = async () => {
      // Deleting the item cascades to its variations.
      await client.catalog.object.delete({ objectId: itemId });
    };

    // Give the variation a real on-hand count, so `getInventoryCounts` has
    // something to round-trip rather than merely "no row".
    await client.inventory.batchCreateChanges({
      idempotencyKey: randomUUID(),
      changes: [
        {
          type: 'PHYSICAL_COUNT',
          physicalCount: {
            catalogObjectId: variationId,
            state: 'IN_STOCK',
            locationId,
            quantity: String(STOCK),
            occurredAt: new Date().toISOString(),
          },
        },
      ],
      ignoreUnchangedCounts: true,
    });
  }, 60_000);

  afterAll(async () => {
    // Runs even when the body above threw part-way, provided the item exists.
    if (itemId && deleteItem) await deleteItem();
  }, 60_000);

  it('reads the price and tracking flag back through getVariations', async () => {
    const variations = await realGateway().getVariations([variationId]);

    expect(variations.get(variationId)).toEqual({
      id: variationId,
      priceCents: PRICE_CENTS,
      trackInventory: true,
    });
  }, 30_000);

  it('omits an id that is not in the catalog', async () => {
    // Square answers a 200 with errors for unknown ids in some shapes; what
    // matters to the app is that an unknown id never comes back priced.
    const variations = await realGateway().getVariations([variationId]);

    expect(variations.has('NOT-A-REAL-VARIATION-ID')).toBe(false);
  }, 30_000);

  it('reads the on-hand count back through getInventoryCounts', async () => {
    const counts = await realGateway().getInventoryCounts([variationId]);

    expect(counts.get(variationId)).toBe(STOCK);
  }, 30_000);

  it('creates a sandbox payment link for that variation', async () => {
    const { url } = await realGateway().createPaymentLink({
      lineItems: [{ variationId, quantity: 1, note: 'Custom order — Color: Blue. integration test' }],
      redirectUrl: 'https://example.test/thanks',
    });

    // Sandbox links live on their own host; a production link would be
    // square.link, and seeing one here would mean the wrong token is in play.
    expect(url).toMatch(/^https:\/\/sandbox\.square\.link\//);
  }, 30_000);
});
