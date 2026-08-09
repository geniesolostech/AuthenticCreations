# Authentic Creations — E-commerce Site Design

**Date:** 2026-08-09
**Status:** Approved by user (pending written-spec review)

## 1. Overview

A custom e-commerce site for **Authentic Creations**, CJ Lavender's handmade crochet business. The site sells hats and accessories (with made-to-order custom pieces), tells CJ's story, hosts her blog, and builds community through free virtual crochet events with RSVP signup.

**Why "Authentic Creations":** everything is made by hand, and the mission is for people to find their authentic selves through fashion. Tagline: *"Find you in whatever you do."*

**Success criteria:**

- A visitor can browse products, see live stock, buy standard or custom pieces, and pay through Square.
- CJ can run the site day-to-day (blog, events, RSVPs, photos, About/policy text) from one dashboard with no developer help.
- The site feels cozy, vintage, earthy — not like a generic storefront.
- Running cost stays in the single-digit dollars per month.

## 2. Decisions log

| Decision | Choice |
|---|---|
| Checkout model | Cart on site; payment on Square-hosted checkout page |
| Hosting | AWS — Amplify Hosting (chosen over raw S3+CloudFront for managed CI/CD + serverless in one system) |
| Architecture | Next.js on Amplify + Sanity CMS + Square APIs ("Approach A") |
| Content editing | Sanity Studio dashboard (friendly web editor for CJ) |
| Events | Free RSVP (name + email); no user accounts; CJ emails call links manually |
| Custom orders | Fixed price, paid at checkout; color + comments travel as order notes |
| Custom color choices | Classic 8: Black, White, Red, Orange, Yellow, Green, Blue, Purple |
| Missing product photos | Branded placeholders at launch; CJ swaps real photos via dashboard |
| Square catalog state | Partially set up — catalog completion is in scope (checklist below) |
| Analytics | AWS CloudWatch RUM (~$1/mo) — traffic analytics viewed in the AWS console (developer-facing); Square's built-in reports cover sales analytics for CJ |

## 3. Brand & visual direction

- **Palette:** cream/linen backgrounds, rust-orange accents (from logo), charcoal text (from logo), khaki and olive supporting tones. Subtle paper/linen texture.
- **Typography:** warm vintage serif for headings; script accents used sparingly (echoing the logo tagline); readable body face.
- **Feel:** cozy, nostalgic, handmade — "yarn shop meets zine," not sleek startup. Photography does the emotional work; generous whitespace; soft rounded corners.
- **Logo:** `images/full/logo AC.jpg` (charcoal circle, white script "a", orange letterspaced wordmark, script tagline).
- Mobile-first: this audience predominantly shops on phones.

## 4. Site map

| Route | Purpose |
|---|---|
| `/` | Hero (logo, tagline), featured products, story teaser, upcoming event teaser, latest posts |
| `/shop/hats` | Product grid with price + sold-out badges |
| `/shop/accessories` | Same, for accessories |
| `/shop/[slug]` | Product detail: gallery, description, price, stock, Add to Cart; products with variations (crochet flowers: rose/tulip/lavender) show a variant picker |
| `/shop/hats/custom`, `/shop/accessories/custom` | Custom order flow (see §6) |
| `/about` | CJ Lavender: photo, bio (artist, musician, therapist, creative), name meaning, mission. CMS-editable |
| `/blog`, `/blog/[slug]` | Blog index + posts |
| `/community` | Upcoming events with RSVP forms; past events shown as history |
| `/cart` | Cart review (also a slide-out mini cart site-wide) |
| `/thanks` | Post-payment return page |
| `/policies` | Shipping/returns, CMS-editable |
| `/studio` | Sanity Studio — CJ's dashboard (authenticated) |

## 5. Products

**Hats:** Crochet ruffled bucket hat · Crochet granny stitch hat · Crochet granny square beanie · Crochet bucket hat · Crochet cat-ear beanie · Crochet beanie

**Accessories:** Scrunchies 3-pack · Crochet flowers (variant choice: rose, tulip, lavender) · Crochet slouch bag · Crochet bottle holder

**Plus one "Custom" entry in each section** (see §6).

**Photo status:** real photos exist (already web-optimized in `images/`, full-res in `images/full/`) for: ruffled bucket hats (several colorways), granny stitch bucket hat, bucket hat ombré, multicolor beanie, slouch bag, bottle holder, CJ's about photo, logo. Missing: granny square beanie, cat-ear beanie, scrunchies, crochet flowers → branded placeholder images until CJ uploads real ones through the dashboard. (An earwarmer photo exists unused if CJ ever adds that product.)

## 6. Shop & Square integration

**Division of labor — one source of truth each:**

- **Square owns money and stock:** prices, inventory counts, payments, shipping fees, tax.
- **Sanity owns presentation:** names, slugs, descriptions, photos, display order, section assignment.
- Each Sanity product stores its Square variation ID. The site always displays Square's price; prices are never entered in Sanity or code.

**Inventory display:** server fetches Square inventory counts (batch, cached ~60s). Count ≤ 0 → "Sold out" badge, disabled buy button. No manual updating anywhere.

**Cart:** client-side (React context + localStorage). Line items: Square variation ID, quantity, and for customs: chosen color + comments.

**Checkout flow:**

1. Customer clicks Checkout → `POST /api/checkout` with cart contents.
2. Server re-validates each line against Square (current price, stock for tracked items).
3. Server creates a Square Payment Link (Checkout API) containing the full order; custom line items carry color + comments as line-item notes visible to CJ on the Square order.
4. Customer pays on the Square-hosted page (card handling, shipping address, receipt all Square's).
5. Redirect back to `/thanks`.

**Custom orders:** each section's Custom page: (1) pick any product from that section, (2) pick one of the 8 colors, (3) free-text comments (length-capped), (4) Add to Cart at that product's fixed custom price. Custom products exist in Square as their own made-to-order items (no stock tracking), so they remain purchasable even when the ready-made version is sold out. The page and the thank-you page state clearly that custom pieces take extra production time.

**Square catalog checklist (setup work, done with CJ):**

- One Square item + variation per standard product above, with price and inventory count.
- One "Custom — [product]" item per product, no inventory tracking (default; if CJ prefers a single price per section, collapse to one "Custom — Hats" / "Custom — Accessories" item each — the site flow is unchanged either way).
- Crochet flowers as one item with rose/tulip/lavender variations.
- Shipping fees and tax configured in Square settings.
- Sandbox catalog mirroring production for development/testing.

## 7. Content & community (Sanity)

**Studio:** embedded at `/studio`, same deploy as the site. CJ logs in with one account.

**Document types:**

- `product` — title, slug, section (hats/accessories), description, photos[], squareVariationId, customizable flag, display order. *(No price/stock fields — Square owns those.)*
- `post` — title, slug, cover image, rich text (with inline images), excerpt, publishedAt.
- `event` — title, slug, date/time, description, optional capacity, status (upcoming/past derived from date).
- `rsvp` — event reference, name, email, createdAt. Created only via the server API route (write token), visible to CJ grouped by event.
- `aboutPage` (singleton) — CJ's editable bio/mission text + photo.
- `policiesPage` (singleton) — shipping/returns text.

**Publishing latency:** site pages revalidate every ~60s, so published changes appear within a minute. No webhooks needed in v1.

**RSVP flow:** form posts name + email → server validates (event exists, upcoming, under capacity, email not already registered) → writes `rsvp` document. Full event → form replaced with "this circle is full" message. Duplicate → friendly "you're already signed up." CJ emails attendees the call link from her own inbox (deliberately human for v1).

## 8. Technical architecture

- **Stack:** Next.js (App Router, TypeScript), Tailwind CSS.
- **Hosting:** AWS Amplify Hosting, git-connected to this repo; push to `main` → build & deploy. SSL automatic. Route 53 for DNS when domain is connected.
- **API routes (serverless):**
  - `GET /api/inventory` — batch Square inventory counts, 60s cache.
  - `POST /api/checkout` — cart validation + Square Payment Link creation.
  - `POST /api/rsvp` — RSVP validation + Sanity write.
- **Rendering:** server-rendered pages with ISR (~60s) combining Sanity content + Square prices; inventory refreshed client-side on product pages for accuracy at interaction time.
- **Secrets:** `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`, `SANITY_WRITE_TOKEN` in Amplify environment config only. Public values (Sanity project ID/dataset) in code.
- **Environments:** Square Sandbox for all development and testing; production token swapped at launch.
- **Images:** full-resolution photos from `images/full/` seeded into Sanity at setup; Sanity's image CDN serves responsive sizes. Placeholder images generated on-brand for unphotographed products.
- **SEO:** per-page metadata, OpenGraph share images, sitemap.xml, robots.txt.
- **Analytics:** Amazon CloudWatch RUM — app monitor + guest-access identity pool provisioned at setup, web client snippet in the root layout. Captures page views, sessions, geography, performance, JS errors; viewed in the AWS console (primarily by the developer, not CJ). Uses first-party session cookies → one-line cookie mention added to the policies page.

**Estimated running cost:** ~$3–8/month after AWS free tier (~$1–2/month in year one) including ~$1/mo CloudWatch RUM + ~$13/year domain + Square's 2.9% + $0.30 per sale. No fixed subscriptions.

## 9. Error handling & edge cases

| Scenario | Behavior |
|---|---|
| Item sells out between page view and checkout | Checkout re-validation returns a clear "just sold out" error; cart updates; no payment link created for unavailable goods |
| Square API unreachable | Pages render with last-cached prices; checkout fails gracefully with "try again in a moment"; no broken pages |
| Custom order input | Color required; comments length-capped; text passed to CJ verbatim |
| RSVP to full event | Form closed with friendly message (checked server-side too) |
| Duplicate RSVP | Polite "already signed up" response |
| Payment abandoned on Square page | No order recorded; cart preserved locally so the customer can retry |
| Sanity content missing (e.g., no upcoming events) | Sections render tasteful empty states, never errors |

## 10. Testing strategy

- **Unit:** cart math (totals, quantity edge cases), each API route with mocked Square/Sanity clients (validation, capacity, duplicate, sold-out paths).
- **Integration:** checkout flow against Square Sandbox — real payment link created from a real sandbox catalog.
- **E2E (Playwright):** browse → product page → add to cart → checkout link; RSVP happy path + full-event path.
- **Quality gates:** mobile viewport pass, accessibility pass (semantics, contrast, focus), Lighthouse performance budget on home/shop/product pages.
- **Process:** test-driven development throughout implementation (superpowers TDD skill).

## 11. Out of scope (v1) — deliberate

- Blog comments (community happens in events; revisit later)
- Automated RSVP/confirmation emails (CJ emails manually)
- Paid/ticketed events (free RSVP only; Square checkout path exists if needed later)
- User accounts of any kind
- Newsletter/email marketing integration
- Square webhooks (60s cache is fresh enough at this scale)

## 12. Open items (need CJ / owner input)

1. Square account: developer application + Sandbox and production access tokens, location ID.
2. Custom-piece pricing: fixed price per product (or per section).
3. Final descriptions/prices for all products; catalog completion per §6 checklist.
4. Sanity account for CJ (free) once Studio is deployed.
5. Real photos for: granny square beanie, cat-ear beanie, scrunchies, crochet flowers (anytime — placeholders until then).
6. About/policies text (drafts will be provided for CJ to edit).
7. Domain name choice + registration.
8. Who besides the developer needs AWS console access to view CloudWatch RUM analytics (CJ optional — sales analytics already in her Square dashboard).
