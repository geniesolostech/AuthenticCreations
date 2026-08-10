import 'server-only';
import { createClient } from 'next-sanity';

// NEXT_PUBLIC_SANITY_PROJECT_ID is empty until `npx sanity init` is run (see
// docs/launch-runbook.md). 'placeholder' is a syntactically valid project id
// so client construction never throws at build/import time; every real
// request still requires the real env vars to be set.
const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || 'placeholder';
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production';
const apiVersion = '2024-06-01';

/** Read-only, CDN-cached client. Used by every page/query in the app. */
export const sanityClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: true,
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
