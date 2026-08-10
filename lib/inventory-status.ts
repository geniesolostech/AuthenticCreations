/**
 * The single place the shop UI decides "sold out". Carried over from Task 4's
 * review finding: a variation is sold out only when BOTH are true — it is
 * inventory-tracked, AND its live count is missing or <= 0. A missing count
 * alone must never be read as sold out (that would punish a Square hiccup)
 * and must never be read as unlimited either (that would oversell) — the
 * `trackInventory` flag is checked first and settles the question for
 * made-to-order (untracked) items before any count is even consulted.
 */
export function isSoldOut(trackInventory: boolean, count: number | undefined): boolean {
  if (!trackInventory) return false;
  return count === undefined || count <= 0;
}
