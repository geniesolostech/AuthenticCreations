import type { Page } from '@playwright/test';

/**
 * Waits until React has hydrated the page.
 *
 * Every interactive thing in this app is a Client Component — Add to Cart, the
 * mini-cart, the custom-order form, the RSVP form — and every one of them is
 * *server-rendered first*. So the markup is there, and Playwright will happily
 * click it, seconds before React attaches a single event handler.
 *
 * The failures that causes are the confusing kind rather than the obvious kind:
 * clicking Add to Cart does nothing at all (`type="button"`, no listener yet),
 * and submitting the RSVP form does something worse — the browser performs a
 * *native* GET submission, reloading the page with the answers in the query
 * string and no request ever reaching `/api/rsvp`. Both look like the feature
 * is broken. Under `next dev`, where a route can take seconds to compile on
 * first hit, the window is wide enough to lose that race most runs.
 *
 * React marks each host node it hydrates with an own `__reactFiber$…` property,
 * so its presence anywhere in the body is a direct signal that hydration has
 * happened — no arbitrary sleep, and nothing to keep in step with app code.
 */
export async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      Array.from(document.querySelectorAll('body *')).some((node) =>
        Object.keys(node).some((key) => key.startsWith('__reactFiber$')),
      ),
    undefined,
    { timeout: 60_000 },
  );
}

/** `page.goto`, but not considered arrived until the page can actually respond. */
export async function gotoHydrated(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await waitForHydration(page);
}
