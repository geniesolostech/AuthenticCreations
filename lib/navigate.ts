/**
 * The two whole-page navigations the checkout flow performs, behind a seam.
 *
 * jsdom implements neither `location.assign` nor `location.reload` (it logs
 * "Not implemented" and does nothing) and its `location` resists redefinition,
 * so tests replace this module rather than the global. Keeping both calls in
 * one file also makes every full-page navigation in the app greppable.
 */

/** Hands the browser off to another origin — the Square-hosted payment page. */
export function assignLocation(url: string): void {
  window.location.assign(url);
}

/** Re-fetches the current page so the shopper sees fresh prices. */
export function reloadLocation(): void {
  window.location.reload();
}
