// @vitest-environment node
/**
 * The build-time pre-flight in `next.config.ts`.
 *
 * That file is evaluated once per build, before any page renders, which is what
 * makes it the right place to refuse a deploy that would come up broken but
 * *look* fine. Both variables it guards fail silently and expensively:
 *
 *  - no `NEXT_PUBLIC_SITE_URL` → checkout refuses to build a payment link and
 *    blames Square ("having a moment") for what is a permanent misconfiguration;
 *  - no `NEXT_PUBLIC_SANITY_PROJECT_ID` → the client falls back to the
 *    'placeholder' project id so it can be constructed at import time, and the
 *    site deploys successfully with no products, no posts and no circles in it.
 *
 * Nothing pinned this before; these tests import the config module itself with
 * the environment stubbed, which needs no build and no server.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const REAL_SITE_URL = 'https://authenticcreationsco.com';
const REAL_PROJECT_ID = 'abc12xyz';

/** Re-evaluates next.config.ts against the environment as currently stubbed. */
async function loadConfig(): Promise<unknown> {
  vi.resetModules();
  return (await import('@/next.config')).default;
}

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', REAL_SITE_URL);
  vi.stubEnv('NEXT_PUBLIC_SANITY_PROJECT_ID', REAL_PROJECT_ID);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('next.config production pre-flight', () => {
  it('builds when both variables are set', async () => {
    await expect(loadConfig()).resolves.toBeTruthy();
  });

  it('refuses to build without NEXT_PUBLIC_SITE_URL', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');

    await expect(loadConfig()).rejects.toThrow(/NEXT_PUBLIC_SITE_URL is not set/);
  });

  it('refuses a NEXT_PUBLIC_SITE_URL that is not an absolute http(s) URL', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'authenticcreationsco.com');

    await expect(loadConfig()).rejects.toThrow(/not a valid absolute URL/);
  });

  it('refuses to build without NEXT_PUBLIC_SANITY_PROJECT_ID', async () => {
    vi.stubEnv('NEXT_PUBLIC_SANITY_PROJECT_ID', '');

    await expect(loadConfig()).rejects.toThrow(/NEXT_PUBLIC_SANITY_PROJECT_ID is not set/);
  });

  it('refuses whitespace posing as a project id', async () => {
    vi.stubEnv('NEXT_PUBLIC_SANITY_PROJECT_ID', '   ');

    await expect(loadConfig()).rejects.toThrow(/NEXT_PUBLIC_SANITY_PROJECT_ID is not set/);
  });

  it("refuses the client's own 'placeholder' fallback", async () => {
    // lib/sanity/client.ts substitutes this so the client can be constructed at
    // import time. Deployed, it is a project that does not exist: every query
    // comes back empty and the site is a working shell with nothing in it.
    vi.stubEnv('NEXT_PUBLIC_SANITY_PROJECT_ID', 'placeholder');

    await expect(loadConfig()).rejects.toThrow(/placeholder/);
  });

  it('says where to set it and that it is needed at build time', async () => {
    vi.stubEnv('NEXT_PUBLIC_SANITY_PROJECT_ID', '');

    // Same advice shape as the site-URL check: the reader is standing in the
    // Amplify console at the time, and a NEXT_PUBLIC_* variable added after a
    // build does nothing until the next one.
    await expect(loadConfig()).rejects.toThrow(/Amplify console/);
    await expect(loadConfig()).rejects.toThrow(/BUILD time/);
  });

  it('lets a non-production build through with neither variable set', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SANITY_PROJECT_ID', '');

    // Local dev runs on fixtures and localhost defaults; failing here would
    // block a developer who has no accounts at all.
    await expect(loadConfig()).resolves.toBeTruthy();
  });
});
