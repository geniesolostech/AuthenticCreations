/**
 * All Square *business* logic lives here: validation rules, the inventory
 * cache, and the shape of a checkout attempt.
 *
 * This module never imports the Square SDK. It talks only to the
 * `SquareGateway` interface (type-only import, erased at build time), which
 * means every rule below is unit-testable against a hand-rolled fake with no
 * network, no credentials, and no SDK in the module graph.
 */
import type { CartLine } from '@/lib/types';
import type { CheckoutErrorCode } from './errors';
import type { SquareGateway } from './gateway';

/**
 * Maximum length of `Order.line_items[].note` in the Square Orders API.
 * Verified against https://developer.squareup.com/reference/square/objects/OrderLineItem
 * ("Max Length 2000"). Over-long notes are truncated, never rejected — a buyer
 * writing an essay in the comments box must still be able to check out.
 */
export const SQUARE_LINE_ITEM_NOTE_MAX = 2000;

/** Default lifetime of a cached inventory count. */
export const INVENTORY_CACHE_TTL_MS = 60_000;

/**
 * Most entries the inventory cache may hold at once.
 *
 * The cache is keyed by whatever ids a caller asks about, and `/api/inventory`
 * is public, so those keys are attacker-supplied: without a ceiling the map is
 * an unbounded, process-lifetime memory leak that anyone can grow. Comfortably
 * above a full catalogue, so real traffic never reaches it.
 */
export const INVENTORY_CACHE_MAX_ENTRIES = 500;

export interface InventoryService {
  /**
   * Current on-hand counts for the given variation ids, keyed by id.
   *
   * Untracked (made-to-order) variations are absent from the result — they have
   * no meaningful count and must never be rendered as sold out. Absence is
   * cached too, so untracked ids are not re-fetched on every render.
   *
   * Intended for *display*. `createCheckout` deliberately bypasses this cache
   * and reads live counts, because a stale count must never authorise a sale.
   */
  counts(ids: string[]): Promise<Record<string, number>>;

  /**
   * Entries currently resident in the cache. Exposed so the memory bound is
   * observable from tests and diagnostics; application code has no use for it.
   */
  _cacheSize(): number;
}

interface CacheEntry {
  /** `undefined` means "Square reported no count for this id" (i.e. untracked). */
  count: number | undefined;
  expiresAt: number;
}

/**
 * Builds an inventory reader with a per-id, time-boxed, size-bounded in-memory
 * cache.
 *
 * The cache is per instance (module-level singletons are the caller's choice)
 * and per id, so a request for `[a, b]` right after a request for `[a]` only
 * asks Square about `b`.
 *
 * Two rules keep it from growing without limit, which matters because the ids
 * reaching it come from a public endpoint and are therefore caller-chosen:
 * expired entries are swept on every read, and the map is trimmed to
 * `maxEntries` at the end of every read.
 */
export function makeInventoryService(
  gw: SquareGateway,
  ttlMs: number = INVENTORY_CACHE_TTL_MS,
  maxEntries: number = INVENTORY_CACHE_MAX_ENTRIES,
): InventoryService {
  const cache = new Map<string, CacheEntry>();

  return {
    async counts(ids: string[]): Promise<Record<string, number>> {
      const wanted = dedupe(ids);
      const now = Date.now();

      // Sweep first, so an id nobody asks about again cannot stay resident for
      // the life of the process. After this, "present" means "live".
      for (const [id, entry] of cache) {
        if (entry.expiresAt <= now) cache.delete(id);
      }
      const missing = wanted.filter((id) => !cache.has(id));

      if (missing.length > 0) {
        // A throw here propagates and nothing is cached, so the next call retries.
        const fresh = await gw.getInventoryCounts(missing);
        const expiresAt = Date.now() + ttlMs;
        for (const id of missing) {
          // Delete before set so the entry moves to the back of the map. With a
          // fixed TTL that makes insertion order the same as expiry order, which
          // is what lets `trim` evict the soonest-to-expire by taking the front.
          cache.delete(id);
          cache.set(id, { count: fresh.get(id), expiresAt });
        }
      }

      const out: Record<string, number> = {};
      for (const id of wanted) {
        const entry = cache.get(id);
        if (entry?.count !== undefined) out[id] = entry.count;
      }

      // Trimmed only once the answer is built, so a single oversized call still
      // answers in full — eviction costs a future re-fetch, never a wrong count.
      trim(cache, maxEntries);
      return out;
    },

    _cacheSize(): number {
      return cache.size;
    },
  };
}

/** Drops the soonest-to-expire entries until at most `maxEntries` remain. */
function trim(cache: Map<string, CacheEntry>, maxEntries: number): void {
  if (cache.size <= maxEntries) return;
  for (const id of cache.keys()) {
    if (cache.size <= maxEntries) return;
    cache.delete(id);
  }
}

export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: CheckoutErrorCode; soldOutIds?: string[] };

/**
 * Validates a cart against live Square state and, if it holds up, returns a
 * hosted checkout URL.
 *
 * Order of checks matters and is deliberate:
 *   1. empty cart          — no reason to call Square at all
 *   2. availability        — the most actionable failure for a buyer
 *   3. price               — re-read from the catalog, never trusted from the client
 *   4. create payment link
 *
 * Every price used to charge the buyer comes from Square's catalog, not from
 * the cart. The cart's `unitAmount` is only ever *compared* against it.
 */
export async function createCheckout(
  cart: CartLine[],
  gw: SquareGateway,
): Promise<CheckoutResult> {
  if (cart.length === 0) return { ok: false, error: 'EMPTY_CART' };

  const redirectUrl = thanksUrl();
  if (redirectUrl === null) {
    // A missing NEXT_PUBLIC_SITE_URL is a deploy misconfiguration. Fail closed:
    // a payment link with a broken (or "undefined/thanks") return URL would
    // strand a buyer who has already paid.
    console.error('[square] NEXT_PUBLIC_SITE_URL is not set; refusing to create a payment link');
    return { ok: false, error: 'SQUARE_UNAVAILABLE' };
  }

  try {
    const variationIds = dedupe(cart.map((line) => line.variationId));
    const variations = await gw.getVariations(variationIds);

    // Quantities are summed per variation: two cart lines of the same variation
    // (e.g. two customs in different colours) draw down the same stock.
    const requested = new Map<string, number>();
    for (const line of cart) {
      requested.set(line.variationId, (requested.get(line.variationId) ?? 0) + line.quantity);
    }

    const trackedIds = variationIds.filter((id) => variations.get(id)?.trackInventory === true);
    const counts =
      trackedIds.length > 0 ? await gw.getInventoryCounts(trackedIds) : new Map<string, number>();

    const soldOutIds = variationIds.filter((id) => {
      const info = variations.get(id);
      // Gone from the catalog: it cannot be priced or fulfilled, so it is not
      // for sale. Reported as sold out because that is what the buyer needs to
      // do about it (remove the line and carry on).
      if (info === undefined) return true;
      // Made-to-order items are always purchasable, including at count 0.
      if (!info.trackInventory) return false;
      // A tracked variation with no count row has nothing on hand.
      return (counts.get(id) ?? 0) < (requested.get(id) ?? 0);
    });
    if (soldOutIds.length > 0) return { ok: false, error: 'SOLD_OUT', soldOutIds };

    for (const line of cart) {
      const info = variations.get(line.variationId);
      if (info === undefined || info.priceCents !== line.unitAmount) {
        return { ok: false, error: 'PRICE_CHANGED' };
      }
    }

    const { url } = await gw.createPaymentLink({
      lineItems: cart.map(toLineItem),
      redirectUrl,
    });
    return { ok: true, url };
  } catch (error) {
    console.error('[square] checkout failed', error);
    return { ok: false, error: 'SQUARE_UNAVAILABLE' };
  }
}

function toLineItem(line: CartLine): { variationId: string; quantity: number; note?: string } {
  if (line.custom === undefined) {
    return { variationId: line.variationId, quantity: line.quantity };
  }
  return {
    variationId: line.variationId,
    quantity: line.quantity,
    note: customNote(line.custom.color, line.custom.comments),
  };
}

/**
 * The exact note the maker sees on the Square order for a custom piece.
 * Format is fixed by spec (em dash, U+2014) and truncated to Square's limit.
 */
function customNote(color: string, comments: string): string {
  return truncateToLimit(`Custom order — Color: ${color}. ${comments}`, SQUARE_LINE_ITEM_NOTE_MAX);
}

/**
 * Truncates to at most `max` UTF-16 code units *and* at most `max` code points,
 * without ever splitting a surrogate pair — Square's docs do not say which unit
 * the limit is counted in, so satisfy both and never emit a lone surrogate.
 */
function truncateToLimit(text: string, max: number): string {
  if (text.length <= max) return text;
  let out = '';
  for (const char of text) {
    if (out.length + char.length > max) break;
    out += char;
  }
  return out;
}

/** `${NEXT_PUBLIC_SITE_URL}/thanks`, or null when the site URL is unconfigured. */
function thanksUrl(): string | null {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!base) return null;
  return `${base.replace(/\/+$/, '')}/thanks`;
}

/** Preserves first-seen order, which keeps gateway calls and tests deterministic. */
function dedupe(ids: string[]): string[] {
  return [...new Set(ids)];
}
