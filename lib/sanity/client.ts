import 'server-only';
import { createClient } from 'next-sanity';

import { SANITY_API_VERSION } from './api-version';

// NEXT_PUBLIC_SANITY_PROJECT_ID is empty until `npx sanity init` is run (see
// docs/launch-runbook.md). 'placeholder' is a syntactically valid project id
// so client construction never throws at build/import time; every real
// request still requires the real env vars to be set.
const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || 'placeholder';
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production';
const apiVersion = SANITY_API_VERSION;

/**
 * Read-only, CDN-cached client. Used by every page/query in the app.
 *
 * `perspective: 'published'` is the whole reason CJ can edit in Studio without
 * the site changing under her: without it a draft is a real document like any
 * other, so every list query returns it *beside* its published twin and every
 * `[0]` query may pick either one. The pinned `apiVersion` (>= 2025-02-19)
 * makes `published` the default too — belt and braces, because the two
 * settings fail in opposite directions and only one of them is visible in a
 * diff of this file.
 *
 * `withConfig({ useCdn: false })` clones inherit this, which is what
 * app/api/rsvp/route.ts relies on: an RSVP is created as a published
 * document, so a published-only reader still sees the endpoint's own writes.
 */
export const sanityClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: true,
  perspective: 'published',
});

/**
 * Write-capable client (mutations: RSVP creation, the seed script's own
 * client is separate — see scripts/seed-sanity.ts). Never import this from a
 * Client Component; the `server-only` import above makes that a build error.
 */
export const sanityWriteClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false,
  token: process.env.SANITY_API_WRITE_TOKEN,
});
