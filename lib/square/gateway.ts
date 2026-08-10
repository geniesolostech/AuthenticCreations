import 'server-only';

import { randomUUID } from 'node:crypto';

import { SquareClient, SquareEnvironment } from 'square';
import type { CatalogItemVariation, ItemVariationLocationOverrides } from 'square';

import { SquareGatewayError } from './errors';

/**
 * The only module in the app that imports the `square` SDK.
 *
 * Everything here is translation: Square's wire shapes in, our own plain types
 * out. No validation rules, no caching, no error taxonomy beyond
 * `SquareGatewayError` — those live in `./service.ts` and `./errors.ts` so they
 * can be tested without the SDK. Nothing SDK-typed may appear in an exported
 * signature.
 *
 * Verified against `square@45.0.1` TypeScript declarations:
 *   node_modules/square/Client.d.ts
 *   node_modules/square/api/resources/catalog/client/Client.d.ts        (batchGet)
 *   node_modules/square/api/resources/inventory/client/Client.d.ts      (batchGetCounts)
 *   node_modules/square/api/resources/checkout/resources/paymentLinks/  (create)
 */

/** What the app needs to know about a Square item variation. Cents, always. */
export interface VariationInfo {
  id: string;
  priceCents: number;
  trackInventory: boolean;
}

export interface SquareGateway {
  /** Current price + inventory-tracking flag per variation. Unknown ids are omitted. */
  getVariations(ids: string[]): Promise<Map<string, VariationInfo>>;
  /** On-hand counts at the configured location. Untracked ids are omitted. */
  getInventoryCounts(ids: string[]): Promise<Map<string, number>>;
  /** Creates a Square-hosted checkout page and returns its URL. */
  createPaymentLink(input: {
    lineItems: { variationId: string; quantity: number; note?: string }[];
    redirectUrl: string;
  }): Promise<{ url: string }>;
}

/**
 * Builds a gateway from `SQUARE_ACCESS_TOKEN`, `SQUARE_ENVIRONMENT` and
 * `SQUARE_LOCATION_ID`. Env is read once, at construction, so a misconfigured
 * deployment fails loudly at first use rather than mid-checkout.
 */
export function realGateway(): SquareGateway {
  const locationId = requireEnv('SQUARE_LOCATION_ID');
  const client = new SquareClient({
    token: requireEnv('SQUARE_ACCESS_TOKEN'),
    environment: squareEnvironment(requireEnv('SQUARE_ENVIRONMENT')),
  });

  return {
    async getVariations(ids: string[]): Promise<Map<string, VariationInfo>> {
      const out = new Map<string, VariationInfo>();
      if (ids.length === 0) return out;

      const response = await call('catalog.batchGet', () =>
        client.catalog.batchGet({
          objectIds: ids,
          // Price and `track_inventory` both live on the variation itself, so
          // the parent item adds nothing but payload weight here.
          includeRelatedObjects: false,
        }),
      );
      throwOnErrors('catalog.batchGet', response.errors);

      for (const object of response.objects ?? []) {
        if (object.type !== 'ITEM_VARIATION' || object.isDeleted) continue;
        const data = object.itemVariationData;
        if (data === undefined) continue;

        const override = locationOverride(data, locationId);
        // A variable-priced variation has no amount to compare against; leaving
        // it out makes the service fail closed rather than guess a price.
        const amount = (override?.priceMoney ?? data.priceMoney)?.amount;
        if (amount === undefined || amount === null) continue;

        out.set(object.id, {
          id: object.id,
          priceCents: Number(amount),
          // Location override wins when set; otherwise the global flag; unset
          // at both levels means tracking is off (per Square's docs).
          trackInventory: override?.trackInventory ?? data.trackInventory ?? false,
        });
      }
      return out;
    },

    async getInventoryCounts(ids: string[]): Promise<Map<string, number>> {
      if (ids.length === 0) return new Map<string, number>();

      // The whole read — request, error check and pagination — runs inside
      // `call()`. `batchGetCounts` returns a lazy paginated iterator, so pages
      // after the first are fetched during the loop below; leaving the loop
      // outside the wrapper would let a mid-pagination failure escape as a raw
      // SDK error, breaking the containment contract in ./errors.ts.
      return call('inventory.batchGetCounts', async () => {
        const page = await client.inventory.batchGetCounts({
          catalogObjectIds: ids,
          locationIds: [locationId],
          states: ['IN_STOCK'],
        });
        // Square can return 200 with partial errors. Dropping those would yield
        // a short count map, and a missing id reads downstream as "untracked",
        // i.e. always available — so a partial failure would fail OPEN. Throw.
        throwOnErrors('inventory.batchGetCounts', page.response.errors);

        const out = new Map<string, number>();
        // Untracked variations simply have no IN_STOCK row and so never appear.
        for await (const count of page) {
          if (count.state !== 'IN_STOCK') continue;
          if (count.locationId !== locationId) continue;
          const id = count.catalogObjectId;
          if (!id) continue;
          const quantity = Number(count.quantity);
          if (!Number.isFinite(quantity)) continue;
          // Quantity is a decimal string; floor so a partial unit never reads as
          // sellable stock.
          out.set(id, Math.floor(quantity));
        }
        return out;
      });
    },

    async createPaymentLink(input): Promise<{ url: string }> {
      const response = await call('checkout.paymentLinks.create', () =>
        client.checkout.paymentLinks.create({
          idempotencyKey: randomUUID(),
          order: {
            locationId,
            lineItems: input.lineItems.map((item) => ({
              catalogObjectId: item.variationId,
              // Square takes quantity as a string.
              quantity: String(item.quantity),
              ...(item.note === undefined ? {} : { note: item.note }),
            })),
          },
          checkoutOptions: {
            redirectUrl: input.redirectUrl,
            // These are physical goods that get posted to the buyer, so the
            // hosted page must collect an address; without it every order
            // arrives unfulfillable.
            askForShippingAddress: true,
            // `shippingFee` is deliberately unset: whether to charge for
            // postage, and how much, is a product decision deferred to
            // docs/launch-runbook.md.
          },
        }),
      );
      throwOnErrors('checkout.paymentLinks.create', response.errors);

      const url = response.paymentLink?.url;
      if (!url) {
        throw new SquareGatewayError('Square created a payment link with no URL');
      }
      return { url };
    },
  };
}

function locationOverride(
  data: CatalogItemVariation,
  locationId: string,
): ItemVariationLocationOverrides | undefined {
  return data.locationOverrides?.find((override) => override.locationId === locationId);
}

/** Wraps any SDK throw so callers see one error type and one log shape. */
async function call<T>(label: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    // Already contained, and carrying a more specific message — don't bury it.
    if (error instanceof SquareGatewayError) throw error;
    throw new SquareGatewayError(`Square ${label} failed`, { cause: error });
  }
}

/** Square can report per-object failures in a 200 response; treat those as failures too. */
function throwOnErrors(label: string, errors: { detail?: string | null }[] | undefined): void {
  if (!errors || errors.length === 0) return;
  const detail = errors.map((error) => error.detail ?? '').join('; ');
  throw new SquareGatewayError(`Square ${label} returned errors: ${detail}`);
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new SquareGatewayError(`Missing required environment variable ${name}`);
  }
  return value;
}

function squareEnvironment(value: string): string {
  switch (value.toLowerCase()) {
    case 'production':
      return SquareEnvironment.Production;
    case 'sandbox':
      return SquareEnvironment.Sandbox;
    default:
      throw new SquareGatewayError(
        `SQUARE_ENVIRONMENT must be "sandbox" or "production", got "${value}"`,
      );
  }
}
