/**
 * The one Sanity API version every client in this repository pins — the app's
 * read and write clients (`lib/sanity/client.ts`) and the standalone seed
 * script (`scripts/seed-sanity.ts`).
 *
 * **It must stay at or after 2025-02-19.** That is the version in which
 * Sanity's *default* perspective changed from `raw` to `published`. Pinned
 * earlier, a client that does not name a perspective is served drafts
 * alongside published documents: the shop grid and the sitemap gain a
 * duplicate row per edited product, every `[0]` query picks between a draft
 * and its published twin arbitrarily, and unfinished copy is live on the
 * public site from the moment CJ opens Studio.
 *
 * `lib/sanity/client.ts` also sets `perspective: 'published'` explicitly, so
 * the guarantee does not rest on this constant alone. Both belong together:
 * this file is deliberately dependency-free (no `server-only`) so the seed
 * script, which runs under plain Node via `tsx`, can share it.
 */
export const SANITY_API_VERSION = '2025-02-19';
