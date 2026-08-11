# Known issues & post-launch follow-ups

Accepted at merge time after the final review (2026-08-10). None block launch; each is small and deliberately deferred rather than forgotten.

## Post-merge one-liners

- **`app/blog/[slug]/page.tsx`** converts a transient Sanity outage into `notFound()`, which ISR can cache as a 404 for a real post. The product and event detail pages were fixed to rethrow instead (retryable 500) — apply the same one-line pattern here.
- **Runbook §4.4** says only `NEXT_PUBLIC_SITE_URL` fails a production build when missing; `NEXT_PUBLIC_SANITY_PROJECT_ID` now does too (by design). Add it to the sentence and to §8's pre-flight list.
- **Seed script** writes `variants`/`photos` array items without `_key`; Sanity Studio will prompt CJ to auto-generate keys the first time she edits the crochet-flowers product. Harmless — add `_key` in the seed to remove the prompt.

## Accepted behaviors (by design, documented in the launch runbook)

- **Rare oversell is possible**: two buyers can pass the stock check in the same second, and Square payment links stay payable after creation (no webhook / post-payment re-check in v1). Remedy: refund from the Square dashboard. See runbook §8.
- **RSVP capacity is best-effort** under simultaneous submits (no transactions across query+create in Sanity); blast radius is a seat or two on a free call.
- **Rate limiting is per-Lambda-instance** and IP-spoofable; AWS WAF is the upgrade path if abuse ever materializes.
- **Charging postage requires a code change** (`shippingFee` on the payment link) — the Square-dashboard shipping settings do not apply to Checkout-API orders (ground-truthed against the sandbox). Tax must be verified on the first real order.
- **Square's "sold out" location toggle is not read by the site** — CJ manages availability via inventory counts only (both docs say so).

## Deferred polish (full list in git history of the SDD ledger)

- `useInventory` should key by product to avoid stale counts if product→product links are ever added (`key={product._id}` on the purchase panel).
- Dead export `isCheckoutErrorCode` — delete or adopt in `checkout-button.tsx`.
- `safeFetch<T>()` helper could replace ~8 repeated try/catch fetch guards.
- Fixtures carry no images (E2E never exercises `urlFor`), and fixture/seed featured flags drift slightly.
- RSVP route logs raw error objects; trim to message/status to keep submitter PII out of CloudWatch.
- Hero logo `alt` duplicates adjacent visible text (announce-once cleanup) and lacks explicit dimensions.
- PowerShell-friendly variants for two bash-style env-prefix commands in the runbook.
- **Khaki body text on quilt tints computes ~2.48-2.67:1** (e.g. khaki `#a98f68` on plum-tint `#ebe4f1` 2.48:1, on mustard-tint `#f7eed8` 2.67:1) — well under the 4.5:1 body-text floor. PRE-EXISTING pattern, not introduced by the Woven branch: khaki-on-linen was already 2.49:1 before it. Recorded in `app/globals.css`'s contrast-evidence comment; not fixed here since it predates this work.
