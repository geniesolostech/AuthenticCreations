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
import { realGateway, type SquareGateway } from '@/lib/square/gateway';
import { makeInventoryService, type InventoryService } from '@/lib/square/service';

export const dynamic = 'force-dynamic';

/**
 * Module-level singleton, so the service's per-id TTL cache is shared across
 * requests instead of being thrown away after each one.
 *
 * Built lazily rather than at import time: `realGateway()` reads and validates
 * Square credentials eagerly, and this module is imported during `next build`
 * and by tests, neither of which has (or should need) production secrets.
 */
let service: InventoryService | null = null;

function inventory(): InventoryService {
  service ??= makeInventoryService(realGateway());
  return service;
}

/** Test seam: swap in a fake gateway and start from a cold cache. */
export function _setGatewayForTests(gw: SquareGateway): void {
  service = makeInventoryService(gw);
}

/** Test seam: drop the fake so the next call rebuilds the real gateway. */
export function _resetGatewayForTests(): void {
  service = null;
}

export async function GET(request: Request): Promise<Response> {
  const ids = parseInventoryIds(new URL(request.url).searchParams.get('ids'));
  if (ids === null) {
    return Response.json({ error: 'INVALID_REQUEST' }, { status: 400 });
  }

  try {
    const counts = await inventory().counts(ids);
    return Response.json({ counts });
  } catch (error) {
    // Unlike checkout, `counts()` lets gateway failures propagate. Log the
    // detail server-side and hand the client the same opaque code the checkout
    // route uses — never the SDK's message, which can carry request context.
    console.error('[api/inventory] inventory lookup failed', error);
    return Response.json({ error: 'SQUARE_UNAVAILABLE' }, { status: 503 });
  }
}
