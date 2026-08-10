/**
 * `GET /api/inventory?ids=id1,id2` — on-hand counts for the storefront.
 *
 * Thin by design: parse the query, ask the inventory service, map the outcome to
 * a status. No stock rules live here; those are in `lib/square/service.ts`.
 *
 * Untracked (made-to-order) and unknown ids are simply absent from `counts`,
 * which is what lets the UI tell "sold out" apart from "always available".
 */
import { parseInventoryIds } from '@/lib/api-schemas';
// The inventory-service singleton and its test seam live in
// lib/square/runtime.ts: a Next route module may export only its handlers and
// route config, so anything else has to have a home elsewhere.
import { inventoryService } from '@/lib/square/runtime';

export const dynamic = 'force-dynamic';

/**
 * `dynamic` keeps Next from caching this route, but it emits no cache header of
 * its own, which would leave a CDN or browser free to reuse a response under its
 * own heuristics. A stale count reads as stock that is not there, so say it
 * outright on every response.
 */
const NO_STORE = { 'cache-control': 'no-store' } as const;

export async function GET(request: Request): Promise<Response> {
  const ids = parseInventoryIds(new URL(request.url).searchParams.get('ids'));
  if (ids === null) {
    return Response.json({ error: 'INVALID_REQUEST' }, { status: 400, headers: NO_STORE });
  }

  try {
    const counts = await inventoryService().counts(ids);
    return Response.json({ counts }, { headers: NO_STORE });
  } catch (error) {
    // Unlike checkout, `counts()` lets gateway failures propagate. Log the
    // detail server-side and hand the client the same opaque code the checkout
    // route uses — never the SDK's message, which can carry request context.
    console.error('[api/inventory] inventory lookup failed', error);
    return Response.json({ error: 'SQUARE_UNAVAILABLE' }, { status: 503, headers: NO_STORE });
  }
}
