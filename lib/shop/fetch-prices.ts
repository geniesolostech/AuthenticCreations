import { realGateway, type VariationInfo } from '@/lib/square/gateway';

/**
 * Server-fetches Square prices/stock for a batch of variation ids. Never
 * throws: an unset or unreachable Square (dev without creds, or an outage)
 * falls back to empty maps, which callers render as a "Price at checkout"
 * fallback with a disabled Add to Cart, rather than a crashed page.
 *
 * Shared by every shop page that needs Square pricing at render time
 * (`app/shop/[section]/page.tsx`, `app/shop/[section]/[slug]/page.tsx`,
 * `app/shop/[section]/custom/page.tsx`) — extracted from Task 6's two pages,
 * which had this verbatim-duplicated, per a deferred-minor from that task's
 * review.
 */
export async function fetchPricesAndStock(
  ids: string[],
): Promise<{ variations: Map<string, VariationInfo>; counts: Record<string, number> }> {
  try {
    const gw = realGateway();
    const variations = await gw.getVariations(ids);
    const trackedIds = ids.filter((id) => variations.get(id)?.trackInventory);
    const counts =
      trackedIds.length > 0 ? Object.fromEntries(await gw.getInventoryCounts(trackedIds)) : {};
    return { variations, counts };
  } catch (error) {
    console.error('[shop] failed to fetch Square prices/stock', error);
    return { variations: new Map(), counts: {} };
  }
}
