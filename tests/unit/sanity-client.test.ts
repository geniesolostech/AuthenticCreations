/**
 * A configuration regression test, not a behaviour test.
 *
 * Two settings on the Sanity clients decide whether the public site can ever
 * be shown an unpublished draft, and both are easy to change without noticing
 * what they cost. `useCdn` aside, the pair below is load-bearing:
 *
 *  - `apiVersion` must be **>= 2025-02-19**. That is the version in which the
 *    default perspective changed from `raw` to `published`. Pinned to an
 *    earlier date, a client with no explicit perspective serves drafts *and*
 *    published documents side by side: duplicate rows in the grid and the
 *    sitemap, an arbitrary draft-or-published pick on every `[0]` query, and
 *    half-written copy live on the site the moment anyone opens Studio.
 *  - `perspective: 'published'` says the same thing outright, so the guarantee
 *    survives a future apiVersion bump *or* rollback.
 */
import { describe, expect, test } from 'vitest';

import { SANITY_API_VERSION } from '@/lib/sanity/api-version';
import { sanityClient, sanityWriteClient } from '@/lib/sanity/client';

/** The version in which Sanity's default perspective became `published`. */
const PUBLISHED_DEFAULT_SINCE = '2025-02-19';

describe('Sanity client configuration', () => {
  test('the shared api version is at or after the published-by-default change', () => {
    // ISO dates compare correctly as strings, which is the whole point of the format.
    expect(SANITY_API_VERSION >= PUBLISHED_DEFAULT_SINCE).toBe(true);
  });

  test('the read client pins that api version and asks for published documents only', () => {
    const config = sanityClient.config();

    expect(config.apiVersion).toBe(SANITY_API_VERSION);
    expect(config.perspective).toBe('published');
  });

  test('the write client pins the same api version', () => {
    expect(sanityWriteClient.config().apiVersion).toBe(SANITY_API_VERSION);
  });

  test('the read client is CDN-cached; the write client is not', () => {
    expect(sanityClient.config().useCdn).toBe(true);
    expect(sanityWriteClient.config().useCdn).toBe(false);
  });

  test('the RSVP route’s non-CDN clone still reads published documents only', () => {
    // app/api/rsvp/route.ts derives its reader this way so it can see its own
    // writes. Dropping the CDN must not quietly drop the perspective with it —
    // an RSVP is created as a published document, so `published` still reads
    // back everything that endpoint writes.
    const fresh = sanityClient.withConfig({ useCdn: false });

    expect(fresh.config().perspective).toBe('published');
    expect(fresh.config().useCdn).toBe(false);
    expect(fresh.config().apiVersion).toBe(SANITY_API_VERSION);
  });
});
