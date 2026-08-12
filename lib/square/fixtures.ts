/**
 * In-repo stand-in for the Square catalog, served when `SQUARE_FAKE=1`.
 *
 * The twin of `lib/sanity/fixtures.ts`, and deliberately so: the variation ids
 * here are the ids those fixture products carry, which is what lets a whole
 * checkout run — grid price, stock, sold-out badge, cart, payment link — with
 * neither Sanity nor Square reachable and no credentials on the machine.
 *
 * It implements `SquareGateway` and nothing more. No SDK import, no network, no
 * env vars. Every rule that decides whether a sale is allowed still lives in
 * `lib/square/service.ts` and runs unchanged against this — a fixture that
 * answered "yes" to everything would make the E2E suite prove nothing.
 *
 * **Never live behaviour.** `realGateway()` consults `squareFixturesEnabled()`
 * and nothing else. The flag is not `NEXT_PUBLIC_`, so a browser cannot set it,
 * and Amplify never does (see docs/launch-runbook.md).
 */
import { FIXTURE_VARIATIONS } from '@/lib/sanity/fixtures';

import { SquareGatewayError } from './errors';
import type { SquareGateway, VariationInfo } from './gateway';

/** Read per call, not captured at module load, so tests can stub the env. */
export function squareFixturesEnabled(): boolean {
  return process.env.SQUARE_FAKE === '1';
}

/**
 * Where a fixture checkout sends the browser.
 *
 * A real payment link would be `https://square.link/u/…`; this keeps the
 * sandbox host so the URL is recognisably a Square one, and adds a path no
 * real link uses. Playwright intercepts it rather than letting the navigation
 * leave the machine.
 */
export const FIXTURE_PAYMENT_LINK_ORIGIN = 'https://sandbox.square.link';
export const FIXTURE_PAYMENT_LINK_PATH = '/u/fake-checkout';

interface FixtureVariation extends VariationInfo {
  /** On-hand count. Only meaningful when `trackInventory` is true. */
  onHand: number;
}

/**
 * Prices in cents, because that is the only unit Square speaks and the one
 * place a units mistake would silently mis-charge someone.
 */
const CATALOG: FixtureVariation[] = [
  {
    id: FIXTURE_VARIATIONS.ruffledBucketHat,
    priceCents: 4500,
    trackInventory: true,
    onHand: 6,
  },
  {
    // Made-to-order: untracked, so it stays purchasable at any count — the
    // behaviour the custom-order flow depends on.
    id: FIXTURE_VARIATIONS.customRuffledBucketHat,
    priceCents: 5500,
    trackInventory: false,
    onHand: 0,
  },
  {
    // The sold-out one. Tracked and empty, which is what the badge and the
    // disabled buy button are driven by.
    id: FIXTURE_VARIATIONS.beanie,
    priceCents: 3200,
    trackInventory: true,
    onHand: 0,
  },
  // Sold by piece on the Sanity side: one variation, and the count is the
  // total number of physical bags (three photos, three bags). Square never
  // learns which one a shopper picked — that rides in the order note.
  { id: FIXTURE_VARIATIONS.slouchBag, priceCents: 6500, trackInventory: true, onHand: 3 },
  { id: FIXTURE_VARIATIONS.flowerRose, priceCents: 900, trackInventory: true, onHand: 12 },
  { id: FIXTURE_VARIATIONS.flowerTulip, priceCents: 900, trackInventory: true, onHand: 8 },
  { id: FIXTURE_VARIATIONS.flowerLavender, priceCents: 900, trackInventory: true, onHand: 5 },
  // Made-to-order like the custom hat above, and priced alike per style — the
  // custom page shows one number for a piece, so a rose that cost more than a
  // tulip would make the card price a lie.
  { id: FIXTURE_VARIATIONS.customFlowerRose, priceCents: 800, trackInventory: false, onHand: 0 },
  { id: FIXTURE_VARIATIONS.customFlowerTulip, priceCents: 800, trackInventory: false, onHand: 0 },
];

const BY_ID = new Map(CATALOG.map((variation) => [variation.id, variation]));

/**
 * A gateway backed by the table above, matching the real one's contract at
 * every edge that a caller can observe:
 *  - unknown ids are *omitted* from `getVariations`, not defaulted;
 *  - untracked ids have no count row at all, which is how the app tells
 *    "made to order" apart from "sold out";
 *  - a payment link with no line items throws, as Square's would.
 */
export function fixtureGateway(): SquareGateway {
  return {
    async getVariations(ids: string[]): Promise<Map<string, VariationInfo>> {
      const out = new Map<string, VariationInfo>();
      for (const id of ids) {
        const variation = BY_ID.get(id);
        if (variation === undefined) continue;
        out.set(id, {
          id: variation.id,
          priceCents: variation.priceCents,
          trackInventory: variation.trackInventory,
        });
      }
      return out;
    },

    async getInventoryCounts(ids: string[]): Promise<Map<string, number>> {
      const out = new Map<string, number>();
      for (const id of ids) {
        const variation = BY_ID.get(id);
        // Untracked variations have no IN_STOCK row in Square either.
        if (variation === undefined || !variation.trackInventory) continue;
        out.set(id, variation.onHand);
      }
      return out;
    },

    async createPaymentLink(input): Promise<{ url: string }> {
      if (input.lineItems.length === 0) {
        throw new SquareGatewayError('Square checkout.paymentLinks.create failed: empty order');
      }

      // The order is spelled out in the URL so an E2E spec can assert what was
      // actually sent to Square from the address bar alone — the closest thing
      // to reading the order off the hosted checkout page.
      const url = new URL(FIXTURE_PAYMENT_LINK_PATH, FIXTURE_PAYMENT_LINK_ORIGIN);
      url.searchParams.set(
        'items',
        input.lineItems.map((item) => `${item.variationId}:${item.quantity}`).join(','),
      );
      const notes = input.lineItems.filter((item) => item.note !== undefined);
      if (notes.length > 0) {
        url.searchParams.set('notes', notes.map((item) => item.note).join(' | '));
      }
      url.searchParams.set('redirect', input.redirectUrl);
      return { url: url.toString() };
    },
  };
}
