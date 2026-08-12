import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end suite.
 *
 * Runs against a real `next dev` server with both fixture switches on, so the
 * whole journey — grid, product, variants, custom order, cart, checkout
 * handoff, RSVP — is exercised with no Sanity project, no Square credentials
 * and no network. See lib/sanity/fixtures.ts and lib/square/fixtures.ts for
 * what those switches serve, and why they cannot reach a deployed build.
 *
 * Everything the specs assert still goes through the app's own rules: the
 * fixture gateway is a `SquareGateway` like any other, so `createCheckout`
 * re-validates price and stock against it exactly as it would against Square.
 *
 * First run on a new machine needs the browser binary:
 *   npx playwright install chromium
 */
const PORT = 3100;
/**
 * `localhost`, not `127.0.0.1`, and that is load-bearing.
 *
 * `next dev` treats requests for `/_next/static/*` from a host it does not
 * recognise as cross-origin and blocks them. Reaching the same server by IP
 * therefore serves the HTML but none of the JavaScript, so React never
 * hydrates and every interactive element — Add to Cart, the mini-cart, both
 * forms — is inert. The symptom is baffling (the RSVP form performs a *native*
 * GET submission and reloads the page), and the fix is simply to talk to the
 * dev server by the name it answers to.
 */
const BASE_URL = `http://localhost:${PORT}`;

/**
 * A distinct client address per project, and it is load-bearing.
 *
 * `POST /api/rsvp` is rate-limited to 5 posts per caller per 10 minutes
 * (lib/rate-limit.ts), counted in the dev server's memory — one server for the
 * whole run. A browser talking to localhost sends no `x-forwarded-for`, so
 * every request from every project lands in the single `unknown` bucket: the
 * RSVP spec posts three times, so one project fits and two do not, and the
 * second one's last assertion sees a 429 instead of the duplicate it asked
 * about. Two real devices have two addresses; this says so, through exactly the
 * header `clientIp` reads in production. Addresses from RFC 5737's
 * documentation range, so they can never be anyone's.
 */
function forwardedFor(ip: string): Record<string, string> {
  return { 'x-forwarded-for': ip };
}

export default defineConfig({
  testDir: './tests/e2e',
  // `*.spec.ts` here, `*.test.ts` for Vitest — see vitest.config.ts.
  testMatch: '**/*.spec.ts',
  // A dev server compiles routes on demand, so the first hit on a cold route
  // is seconds rather than milliseconds. Generous per-test, tight per-assertion.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // Serial, deliberately. There is one dev server and the specs share state
  // through it: the RSVP fixtures hold taken seats in its memory, and
  // `/api/rsvp` is rate-limited per caller — so parallel specs would be flaky
  // for reasons that have nothing to do with the code under test.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], extraHTTPHeaders: forwardedFor('203.0.113.10') },
    },
    // The audience for this shop is on a phone — the runbook's own smoke test
    // says to walk it on one — and a mobile viewport is where a shop breaks
    // differently: a sticky panel covering the buy button, a slide-over wider
    // than the screen, a tap target under something else. Same specs, same
    // fixture data, one browser binary (Pixel 5 is Chromium with a phone
    // viewport, touch, and a mobile user agent).
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'], extraHTTPHeaders: forwardedFor('203.0.113.20') },
    },
  ],

  // `npm run test:e2e` starts the server through scripts/run-e2e.mjs instead
  // of this block, precisely because of the Windows wart documented below —
  // the script kills the server's process tree itself the moment the tests
  // finish, so the run actually exits. E2E_EXTERNAL_SERVER=1 is how it tells
  // this config to stand down; running `npx playwright test` bare still works
  // and still owns its server, slow teardown and all.
  webServer: process.env.E2E_EXTERNAL_SERVER === '1' ? undefined : {
    // Next's own entry point, run directly rather than through `npx` or
    // `npm run`: each wrapper is one more process between Playwright and the
    // server, and Playwright tears the server down by killing the process tree
    // it spawned. A re-parented grandchild escapes that and keeps the port.
    //
    // A port of its own, so a dev server someone already has open on 3000 is
    // neither hijacked nor a source of confusing cross-talk.
    //
    // Known wart, Windows only: after the last test Playwright spends *minutes*
    // terminating this server — visible as the gap between "Terminating the
    // WebServer" and "Terminated the WebServer" under `DEBUG=pw:webserver`. The
    // tests themselves take about ten seconds and the exit code is already
    // decided; it is not a hung suite. Measured to be unaffected by
    // `gracefulShutdown` (either signal, any timeout), by the `stdout`/`stderr`
    // settings, and by the bundler (`--webpack` stalls identically), so there is
    // nothing to tune here. A `taskkill /PID <server pid> /T /F` from another
    // shell unblocks it instantly and Playwright then reports and exits
    // normally — which is exactly what scripts/run-e2e.mjs automates.
    command: `node ./node_modules/next/dist/bin/next dev --port ${PORT}`,
    url: BASE_URL,
    // Never reuse: a server started without these env vars would serve real
    // Sanity/Square data (or fail for want of credentials) and the failure
    // would look like a bug in the app.
    reuseExistingServer: false,
    timeout: 180_000,
    // stdout dropped (a request log per test buries the results); stderr kept,
    // because a server that will not start says so there.
    stderr: 'pipe',
    env: {
      // The two fixture switches. Everything else about the app is real.
      SQUARE_FAKE: '1',
      SANITY_FAKE: '1',
      // Set explicitly rather than left to .env.local: `createCheckout` refuses
      // to build a payment link without it, so a developer whose .env.local
      // lacks it would see the checkout spec fail for the wrong reason.
      NEXT_PUBLIC_SITE_URL: BASE_URL,
      // A dist dir of its own (see next.config.ts): Next 16 locks one dev
      // server per dist dir regardless of port, so without this, this
      // webServer refuses to start whenever a `npm run dev` is already
      // running on the default `.next` dir.
      NEXT_DIST_DIR: 'node_modules/.next-e2e',
    },
  },
});
