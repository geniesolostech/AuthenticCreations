import 'server-only';

/**
 * The app's long-lived Square objects, and the seam that lets tests replace them.
 *
 * These used to be module-level singletons inside the route files, which read
 * naturally but is not allowed: a Next route module may only export the request
 * handlers and the route config, and Next type-checks that. A `_setGatewayForTests`
 * export sitting next to `GET` fails the build with an error about an index
 * signature and `never`, which points nowhere near the cause. Giving them a
 * module of their own is both legal and a better home — the two routes that need
 * a gateway now share one.
 *
 * Both are built lazily. `realGateway()` reads and validates Square credentials
 * eagerly, and these modules are imported during `next build` and by tests,
 * neither of which has (or should need) production secrets.
 */
import { realGateway, type SquareGateway } from './gateway';
import { makeInventoryService, type InventoryService } from './service';

let gateway: SquareGateway | null = null;
let inventory: InventoryService | null = null;

/** The shared gateway. */
export function squareGateway(): SquareGateway {
  gateway ??= realGateway();
  return gateway;
}

/**
 * The shared inventory reader.
 *
 * A singleton so its per-id TTL cache is shared across requests rather than
 * thrown away after each one.
 */
export function inventoryService(): InventoryService {
  inventory ??= makeInventoryService(squareGateway());
  return inventory;
}

/**
 * Test seam: swap in a fake gateway.
 *
 * The inventory service is rebuilt on top of it, so a test also starts from a
 * cold cache — a count left over from the previous test would otherwise answer
 * before the new fake was ever asked.
 */
export function _setGatewayForTests(gw: SquareGateway): void {
  gateway = gw;
  inventory = makeInventoryService(gw);
}

/** Test seam: drop the fake so the next call rebuilds from the environment. */
export function _resetGatewayForTests(): void {
  gateway = null;
  inventory = null;
}
