# Authentic Creations E-commerce Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Authentic Creations e-commerce site — Next.js on AWS Amplify, Sanity CMS for CJ's content, Square for prices/stock/payments — per the approved spec at `docs/superpowers/specs/2026-08-09-authentic-creations-site-design.md`.

**Architecture:** Server-rendered Next.js App Router site. Sanity owns presentation content (products' text/photos, blog, events, about/policies); Square owns money (prices, inventory, checkout). Three API routes (`/api/inventory`, `/api/checkout`, `/api/rsvp`) are the only server-side integration points. Cart is client-state; payment happens on a Square-hosted page.

**Tech Stack:** Next.js 15 (App Router, TypeScript strict), Tailwind CSS v4, Sanity v3 (embedded Studio + next-sanity), Square Node SDK, Vitest + React Testing Library, Playwright, AWS Amplify Hosting, CloudWatch RUM.

## Global Constraints

- **Money is always integer cents** (`number`), formatted for display only at the UI edge with `formatMoney()` from Task 2. Never floats.
- **All Square and Sanity-write calls are server-side only.** The browser never sees `SQUARE_ACCESS_TOKEN` or `SANITY_API_WRITE_TOKEN`. Only `NEXT_PUBLIC_*` vars reach the client.
- **Custom order colors — exactly these 8, in this order:** Black, White, Red, Orange, Yellow, Green, Blue, Purple.
- **Custom order comments:** max 500 characters, required color, text passed to Square order verbatim.
- **Inventory cache TTL: 60 seconds.** Page revalidation (ISR): 60 seconds.
- **Sections are exactly** `hats` and `accessories`.
- **Brand tokens (Task 1) are the only source of colors/fonts** — no ad-hoc hex values in components.
- **Copy tone:** cozy, warm, handmade — e.g., "this circle is full", "made just for you". Never corporate ("ERROR: capacity exceeded").
- Repo root is the app root (`package.json` at repo root). Existing `images/` and `docs/` directories stay untouched.
- Every commit message ends with `Co-Authored-By:` per harness rules; commit after each green test cycle.
- **Testing commands:** `npm test` (Vitest, watchless), `npm run test:e2e` (Playwright). A task is not done until its tests pass.

## Environment Variables (referenced across tasks)

| Var | Side | Purpose |
|---|---|---|
| `SQUARE_ACCESS_TOKEN` | server | Square API auth (Sandbox token until launch) |
| `SQUARE_ENVIRONMENT` | server | `sandbox` \| `production` |
| `SQUARE_LOCATION_ID` | server | CJ's Square location |
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | public | Sanity project |
| `NEXT_PUBLIC_SANITY_DATASET` | public | `production` dataset |
| `SANITY_API_WRITE_TOKEN` | server | RSVP writes + seed script |
| `NEXT_PUBLIC_SITE_URL` | public | Canonical URL for redirects/SEO |
| `NEXT_PUBLIC_RUM_APP_MONITOR_ID`, `NEXT_PUBLIC_RUM_IDENTITY_POOL_ID`, `NEXT_PUBLIC_RUM_REGION` | public | CloudWatch RUM (Task 12) |

Local dev uses `.env.local` (gitignored); Amplify uses its environment config.

---

### Task 1: Project scaffold + brand foundation

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `vitest.config.ts`, `vitest.setup.ts`, `.gitignore`, `.env.example`
- Create: `app/globals.css` (Tailwind v4 `@theme` brand tokens), `app/layout.tsx`, `app/page.tsx` (placeholder), `app/fonts.ts`
- Create: `components/site-header.tsx`, `components/site-footer.tsx`
- Test: `tests/unit/brand.test.tsx`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: root layout with `<SiteHeader/>`/`<SiteFooter/>`; CSS custom properties `--color-cream #F7F1E5`, `--color-linen #EFE6D4`, `--color-rust #C9622B`, `--color-rust-soft #E8894A`, `--color-charcoal #3A3734`, `--color-khaki #A98F68`, `--color-olive #6B7245`; fonts `--font-heading` (Fraunces), `--font-body` (Nunito Sans), `--font-script` (Caveat); Tailwind utilities `bg-cream`, `text-charcoal`, `text-rust`, `font-heading`, `font-body`, `font-script`, etc.

- [ ] **Step 1: Scaffold.** Run `npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*"` (accept defaults otherwise; repo root already has files — allow merge, keep existing `README.md`, `images/`, `docs/`). Add Vitest: `npm i -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event`. Add scripts: `"test": "vitest run", "test:watch": "vitest"`.
- [ ] **Step 2: Configure Vitest** (`vitest.config.ts`: react plugin, `environment: 'jsdom'`, `setupFiles: ['./vitest.setup.ts']` importing `@testing-library/jest-dom/vitest`).
- [ ] **Step 3: Write the failing test:**

```tsx
// tests/unit/brand.test.tsx
import { render, screen } from '@testing-library/react';
import SiteHeader from '@/components/site-header';
import SiteFooter from '@/components/site-footer';

test('header shows brand name and main nav', () => {
  render(<SiteHeader />);
  expect(screen.getByRole('link', { name: /authentic creations/i })).toHaveAttribute('href', '/');
  for (const [name, href] of [['Hats', '/shop/hats'], ['Accessories', '/shop/accessories'], ['About', '/about'], ['Blog', '/blog'], ['Community', '/community']] as const) {
    expect(screen.getByRole('link', { name })).toHaveAttribute('href', href);
  }
});

test('footer shows tagline and policies link', () => {
  render(<SiteFooter />);
  expect(screen.getByText(/find you in whatever you do/i)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /shipping & returns/i })).toHaveAttribute('href', '/policies');
});
```

- [ ] **Step 4: Run to verify failure.** `npm test` → FAIL (components don't exist).
- [ ] **Step 5: Implement.** `app/fonts.ts`: export Fraunces, Nunito Sans, Caveat via `next/font/google` with CSS variables. `app/globals.css`: Tailwind v4 `@theme` block mapping the seven brand colors + three font vars (exact hexes from Interfaces above). `SiteHeader`: cream background, logo text link in `font-heading`, nav links, cart button slot (renders `children` prop if given — Task 8 injects the mini-cart trigger). `SiteFooter`: charcoal background, script-font tagline, contact mailto, `/policies` link. `app/layout.tsx`: fonts on `<html>`, `bg-cream text-charcoal font-body` on body, header/footer wrap `{children}`.
- [ ] **Step 6: Run tests → PASS.** Also `npm run build` must succeed.
- [ ] **Step 7: Commit** `feat: scaffold Next.js app with Authentic Creations brand foundation`.

---

### Task 2: Domain constants + cart engine

**Files:**
- Create: `lib/constants.ts`, `lib/types.ts`, `lib/money.ts`, `lib/cart.ts`
- Test: `tests/unit/cart.test.ts`, `tests/unit/money.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces (exact — later tasks depend on these):

```ts
// lib/constants.ts
export const CUSTOM_COLORS = ['Black','White','Red','Orange','Yellow','Green','Blue','Purple'] as const;
export const CUSTOM_COMMENTS_MAX = 500;
export const SECTIONS = ['hats','accessories'] as const;

// lib/types.ts
export type CustomColor = (typeof CUSTOM_COLORS)[number];
export type Section = (typeof SECTIONS)[number];
export interface CartLine {
  lineId: string;            // crypto.randomUUID()
  variationId: string;       // Square catalog variation id
  name: string;              // display name, e.g. "Crochet Beanie" or "Custom — Crochet Beanie"
  unitAmount: number;        // cents at add-time (server re-checks at checkout)
  quantity: number;          // 1..10
  imageUrl?: string;
  custom?: { color: CustomColor; comments: string };
}

// lib/money.ts
export function formatMoney(cents: number): string;   // 4500 -> "$45.00"

// lib/cart.ts  (pure functions over CartLine[] — no React here)
export function addLine(lines: CartLine[], line: Omit<CartLine,'lineId'>): CartLine[]; // merges same variationId for non-custom; customs always separate lines
export function removeLine(lines: CartLine[], lineId: string): CartLine[];
export function setQuantity(lines: CartLine[], lineId: string, qty: number): CartLine[]; // clamps 1..10
export function subtotal(lines: CartLine[]): number;  // cents
export function itemCount(lines: CartLine[]): number;
```

- [ ] **Step 1: Write failing tests** covering: `formatMoney(4500)==='$45.00'`, `formatMoney(0)==='$0.00'`, `formatMoney(1234567)==='$12,345.67'`; addLine merges quantities for same non-custom variation; addLine keeps two custom lines separate even with identical variation/color; setQuantity clamps to 1..10; removeLine drops only the target line; subtotal multiplies correctly (`2×$45 + 1×$30 = 12000`); itemCount sums quantities.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** the four modules exactly per the signatures above (pure, no side effects; `Intl.NumberFormat('en-US',{style:'currency',currency:'USD'})`).
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Write failing tests for persistence hook** (`tests/unit/cart.test.ts` additions): `CartProvider` + `useCart()` — add then read from a fresh provider mount restores from localStorage (`ac-cart-v1` key); corrupt JSON in storage resets to empty.
- [ ] **Step 6: Implement** `CartProvider`/`useCart` in `lib/cart-context.tsx` (`'use client'`; state = `CartLine[]`; every mutation persists; hydrate lazily on mount to avoid SSR mismatch; expose `{lines, add, remove, setQty, clear, subtotal, itemCount}`). Wrap `{children}` with `<CartProvider>` in `app/layout.tsx`.
- [ ] **Step 7: Run all tests → PASS. Commit** `feat: cart engine with localStorage persistence`.

---

### Task 3: Sanity content layer

**Files:**
- Create: `sanity/schema/{product,post,event,rsvp,about-page,policies-page}.ts`, `sanity/schema/index.ts`, `sanity.config.ts`, `sanity.cli.ts`
- Create: `app/studio/[[...tool]]/page.tsx` (embedded Studio)
- Create: `lib/sanity/client.ts`, `lib/sanity/queries.ts`, `lib/sanity/image.ts`
- Create: `scripts/seed-sanity.ts` (+ `npm run seed`)
- Test: `tests/unit/queries.test.ts`

**Interfaces:**
- Consumes: `Section` from Task 2.
- Produces — schema fields (exact names):
  - `product`: `title`, `slug`, `section` (`'hats'|'accessories'`), `description` (text), `photos` (array of image), `squareVariationId` (string), `customSquareVariationId` (string, optional — the "Custom — X" Square item), `variants` (optional array of `{label, squareVariationId}` — used by crochet flowers), `displayOrder` (number), `featured` (boolean)
  - `post`: `title`, `slug`, `coverImage`, `excerpt`, `body` (Portable Text with inline images), `publishedAt`
  - `event`: `title`, `slug`, `startsAt` (datetime), `description` (text), `capacity` (number, optional)
  - `rsvp`: `event` (reference), `name`, `email`, `createdAt`
  - `aboutPage` (singleton): `heading`, `photo`, `body` (Portable Text)
  - `policiesPage` (singleton): `body` (Portable Text)
  - GROQ helpers in `lib/sanity/queries.ts` (all return typed results): `getProducts(section)`, `getProduct(slug)`, `getFeaturedProducts()`, `getPosts()`, `getPost(slug)`, `getUpcomingEvents(now)`, `getPastEvents(now)`, `getEventBySlug(slug)`, `getRsvpCount(eventId)`, `findRsvp(eventId, email)`, `getAboutPage()`, `getPoliciesPage()`
  - `lib/sanity/client.ts`: `sanityClient` (read, CDN) and `sanityWriteClient` (token, server-only import via `import 'server-only'`)
  - `lib/sanity/image.ts`: `urlFor(image).width(n)` builder re-export

- [ ] **Step 1: Install** `npm i sanity next-sanity @sanity/image-url` and `npm i -D tsx`. Create the Sanity project itself interactively **only if credentials absent** — otherwise scaffold config against env vars (`NEXT_PUBLIC_SANITY_PROJECT_ID` may be a placeholder until the human runs `npx sanity init`; all code must read from env, never hardcode).
- [ ] **Step 2: Write failing tests** for query strings: each helper's GROQ contains the right filters — e.g., `getProducts` filters `_type=="product" && section==$section` ordered by `displayOrder`; `getUpcomingEvents` filters `startsAt >= $now`; `findRsvp` filters `email == $email` case-insensitively (`lower(email) == lower($email)`). (Test the exported GROQ constants as strings — no network.)
- [ ] **Step 3: Run → FAIL. Implement** schemas + queries per Interfaces. Studio config: title "Authentic Creations", singleton pinning for `aboutPage`/`policiesPage`, `rsvp` documents read-only in Studio (CJ views, never edits) grouped under a "Community" section with `event`.
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Seed script** (`scripts/seed-sanity.ts`, run with `npx tsx`): idempotent (`createIfNotExists` with deterministic `_id`s like `product-crochet-ruffled-bucket-hat`). Creates all 10 products from the spec §5 with slugs, sections, empty `squareVariationId` (filled during launch), descriptions as friendly one-line drafts, and uploads photos from `images/full/` per this mapping: ruffled bucket hat → `Crochet ruffled bucket hat.jpg` + colorway shots (`...orange/yellow/green/khaki/ombré` files) on the one product's `photos[]`; granny stitch hat → `Granny stitch bucket hat.jpg`; bucket hat → `Crochet bucket hat ombré.jpg` + model shot; beanie → `Crochet beanie multicolor.jpg`; slouch bag → `Crochet slouch bag.jpg` + model + `(1)`; bottle holder → `Water bottle holder .jpeg`; aboutPage photo → `images/full/cj-portrait.jpg` **if present** (this file does not exist yet — the user must save CJ's portrait there before seeding, or CJ uploads it via Studio later; the seed script skips it gracefully when absent). Products with no photo (granny square beanie, cat-ear beanie, scrunchies, flowers) get **no** photos — UI placeholder covers them (Task 6).
- [ ] **Step 6: Verify seed** runs clean twice (idempotent) against the real dev dataset once credentials exist; until then `--dry-run` flag prints planned mutations (implement the flag).
- [ ] **Step 7: Commit** `feat: Sanity schemas, embedded studio, typed queries, seed script`.

---

### Task 4: Square service layer

**Files:**
- Create: `lib/square/gateway.ts` (SDK wrapper — the only file that imports `square`), `lib/square/service.ts`, `lib/square/errors.ts`
- Test: `tests/unit/square-service.test.ts`

**Interfaces:**
- Consumes: `CartLine` (Task 2).
- Produces:

```ts
// lib/square/gateway.ts — thin wrapper over the Square SDK; consult SDK docs for exact calls.
export interface VariationInfo { id: string; priceCents: number; trackInventory: boolean; }
export interface SquareGateway {
  getVariations(ids: string[]): Promise<Map<string, VariationInfo>>;   // Catalog BatchRetrieve + related inventory state
  getInventoryCounts(ids: string[]): Promise<Map<string, number>>;     // Inventory BatchRetrieveCounts; untracked ids omitted
  createPaymentLink(input: {
    lineItems: { variationId: string; quantity: number; note?: string }[];
    redirectUrl: string;
  }): Promise<{ url: string }>;                                        // Checkout API CreatePaymentLink with order-level location from env
}
export function realGateway(): SquareGateway;  // built from SQUARE_* env vars

// lib/square/service.ts
export function makeInventoryService(gw: SquareGateway, ttlMs?: number): {
  counts(ids: string[]): Promise<Record<string, number>>;              // 60s in-memory cache, per-id
};
export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: 'EMPTY_CART' | 'SOLD_OUT' | 'PRICE_CHANGED' | 'SQUARE_UNAVAILABLE'; soldOutIds?: string[] };
export function createCheckout(cart: CartLine[], gw: SquareGateway): Promise<CheckoutResult>;
```

`createCheckout` rules: empty cart → `EMPTY_CART`; any tracked line with current count < requested qty → `SOLD_OUT` listing ids; any line whose current `priceCents` ≠ cart `unitAmount` → `PRICE_CHANGED`; gateway throw → `SQUARE_UNAVAILABLE`; else build payment link — custom lines get `note` = `` `Custom order — Color: ${color}. ${comments}` `` (truncated to Square's note limit), redirect to `${NEXT_PUBLIC_SITE_URL}/thanks`.

- [ ] **Step 1: Write failing tests** with a hand-rolled `FakeGateway` (in-test class implementing `SquareGateway` over fixture maps): happy path returns url and passes correct line items + notes; each error path above; cache test — two `counts()` calls within TTL hit gateway once (spy), after `ttlMs` advance (fake timers) hits again; untracked (made-to-order) items never trigger `SOLD_OUT` even at count 0.
- [ ] **Step 2: Run → FAIL. Implement** `service.ts` + `errors.ts` (pure logic, no SDK). Then `gateway.ts` against the installed `square` SDK (`npm i square`) — keep it thin; SDK method names verified against the SDK's own TypeScript types at implementation time.
- [ ] **Step 3: Run → PASS. Commit** `feat: Square service layer with cached inventory and checkout validation`.

---

### Task 5: API routes — inventory + checkout

**Files:**
- Create: `app/api/inventory/route.ts`, `app/api/checkout/route.ts`, `lib/api-schemas.ts` (zod)
- Test: `tests/unit/api-inventory.test.ts`, `tests/unit/api-checkout.test.ts`

**Interfaces:**
- Consumes: Task 4 service layer (module-level singleton `makeInventoryService(realGateway())`, injectable for tests via exported `_setGatewayForTests`).
- Produces:
  - `GET /api/inventory?ids=id1,id2` → `200 {counts: Record<string, number>}` (missing/untracked ids omitted); `400` on absent/empty `ids` (max 50 ids).
  - `POST /api/checkout` body `{lines: CartLine[]}` (zod-validated: quantities 1–10, comments ≤ 500, color ∈ CUSTOM_COLORS) → `200 {url}` | `400` invalid body | `409 {error:'SOLD_OUT', soldOutIds}` | `409 {error:'PRICE_CHANGED'}` | `503 {error:'SQUARE_UNAVAILABLE'}`.

- [ ] **Step 1: Write failing route tests** (invoke route handlers directly with `new Request(...)`, fake gateway injected): every status path listed above, including zod rejection of an 11-quantity line and a 501-char comment.
- [ ] **Step 2: Run → FAIL. Implement** (`npm i zod`). Routes are thin: parse → call service → map result to status. `export const dynamic = 'force-dynamic'` on both.
- [ ] **Step 3: Run → PASS. Commit** `feat: inventory and checkout API routes`.

---

### Task 6: Shop pages

**Files:**
- Create: `app/shop/[section]/page.tsx` (grid), `app/shop/[section]/[slug]/page.tsx` (detail; the static `custom` segment from Task 7 takes precedence over this dynamic segment)
- Create: `components/product-card.tsx`, `components/product-gallery.tsx`, `components/add-to-cart.tsx`, `components/placeholder-image.tsx`, `components/sold-out-badge.tsx`, `components/variant-picker.tsx`
- Create: `lib/use-inventory.ts` (client hook polling `/api/inventory`)
- Test: `tests/unit/product-card.test.tsx`, `tests/unit/add-to-cart.test.tsx`, `tests/unit/variant-picker.test.tsx`

**Interfaces:**
- Consumes: `getProducts`/`getProduct` + `urlFor` (Task 3), `useCart` (Task 2), `/api/inventory` (Task 5). Product prices for display come from the server page fetching `gw.getVariations` (Task 4) at render (ISR 60s) and passing `priceCents` down as props — components never call Square.
- Produces: `<ProductCard product priceCents soldOut/>` (image or `<PlaceholderImage title/>`, name, `formatMoney` price, `<SoldOutBadge/>` overlay when sold out); `<AddToCart variationId name priceCents disabled imageUrl?/>` (button; on click `add()`s a line and opens mini-cart via `cart:open` CustomEvent on `window`); `<VariantPicker variants onSelect/>` (radio group; selection switches the variationId/price passed to AddToCart); `<PlaceholderImage title/>` (inline SVG: linen background, olive yarn-ball motif, product title in heading font, `role="img"` + aria-label "photo coming soon").
- `generateStaticParams` for both sections; `notFound()` for unknown section/slug. Grid: responsive 2-col mobile / 3-col desktop, custom-order banner card at the end linking to `/shop/[section]/custom` ("Want it in *your* colors? Make it custom →").

- [ ] **Step 1: Write failing component tests:** ProductCard shows formatted price and image alt text; shows placeholder SVG when no photo; SoldOutBadge shown + AddToCart disabled with accessible name /sold out/i when `soldOut`; AddToCart click adds correct CartLine to a test CartProvider and fires `cart:open`; VariantPicker renders three radios for rose/tulip/lavender fixture and reports selection.
- [ ] **Step 2: Run → FAIL. Implement** components, then pages (server components fetching Sanity + Square price/stock, `revalidate = 60`; product page also mounts `use-inventory` to live-refresh the sold-out state client-side).
- [ ] **Step 3: Run → PASS.** Manual smoke with `npm run dev` against seeded Sanity data (Square price fetch returns empty map gracefully when env unset — page renders with "price at checkout" fallback text so dev without Square creds still works).
- [ ] **Step 4: Commit** `feat: shop grid and product detail pages`.

---

### Task 7: Custom order pages

**Files:**
- Create: `app/shop/[section]/custom/page.tsx`, `components/custom-order-form.tsx`, `components/color-swatch-picker.tsx`
- Test: `tests/unit/custom-order-form.test.tsx`

**Interfaces:**
- Consumes: `getProducts(section)` (only products with `customSquareVariationId`), `CUSTOM_COLORS`/`CUSTOM_COMMENTS_MAX` (Task 2), `useCart`.
- Produces: `<CustomOrderForm products/>` — (1) product `<select>` (updates shown price), (2) `<ColorSwatchPicker/>` — 8 labeled swatch buttons (`aria-pressed`), hexes: Black `#1A1A1A`, White `#FAFAF7`, Red `#B3372F`, Orange `#D97829`, Yellow `#E3B341`, Green `#5F7D45`, Blue `#3E6B8C`, Purple `#6D5382`, (3) comments `<textarea>` with live `n/500` counter, (4) Add to Cart. Validation: color required (inline "pick a color for your piece" message), comments hard-capped at 500. Added line: `variationId = customSquareVariationId`, `name = "Custom — " + product.title`, `custom: {color, comments}`. Page shows the made-to-order note: "Custom pieces are made just for you — please allow extra time before your order ships."

- [ ] **Step 1: Write failing tests:** submit without color shows validation message and adds nothing; with color + comments adds line with exact custom fields; counter shows remaining chars; 500-char cap enforced (typing char 501 is ignored); changing product select changes displayed price.
- [ ] **Step 2: Run → FAIL. Implement.**
- [ ] **Step 3: Run → PASS. Commit** `feat: custom order flow with 8-color picker`.

---

### Task 8: Cart UI + checkout handoff + thanks page

**Files:**
- Create: `components/mini-cart.tsx`, `app/cart/page.tsx`, `components/cart-line-row.tsx`, `components/checkout-button.tsx`, `app/thanks/page.tsx`
- Modify: `components/site-header.tsx` (cart trigger with `itemCount` bubble), `app/layout.tsx` (mount `<MiniCart/>`)
- Test: `tests/unit/mini-cart.test.tsx`, `tests/unit/checkout-button.test.tsx`

**Interfaces:**
- Consumes: `useCart`, `/api/checkout` (Task 5), `formatMoney`.
- Produces: `<MiniCart/>` — slide-over (opens on `cart:open` event or header trigger; focus-trapped, Esc closes); `<CartLineRow line/>` — thumb, name, custom color/comments preview, qty stepper (1–10), remove; `<CheckoutButton/>` — POSTs `{lines}` to `/api/checkout`; on `{url}` → `window.location.assign(url)` (cart NOT cleared — Square page abandonment preserves it; `/thanks` clears); on 409 SOLD_OUT → toast "…just sold out" + marks lines by `soldOutIds` with a "remove sold-out items" button; on 409 PRICE_CHANGED → toast "prices were updated — please review" + `location.reload()`; on 503 → "Square's having a moment — try again shortly". `/thanks`: warm confirmation copy, custom-order extra-time reminder, `clear()`s the cart on mount, links back to `/shop/hats`, `/community`.

- [ ] **Step 1: Write failing tests:** header bubble reflects itemCount; MiniCart lists lines incl. "Color: Purple" for a custom line; qty stepper calls `setQty` clamped; CheckoutButton happy path calls `location.assign` with returned url (mock fetch + `window.location`); SOLD_OUT path renders the remove-sold-out affordance and removes exactly those lines; empty-cart renders "your cart is empty — go find something cozy" with shop links and disabled checkout.
- [ ] **Step 2: Run → FAIL. Implement.**
- [ ] **Step 3: Run → PASS. Commit** `feat: cart UI and Square checkout handoff`.

---

### Task 9: Blog, About, Policies pages

**Files:**
- Create: `app/blog/page.tsx`, `app/blog/[slug]/page.tsx`, `app/about/page.tsx`, `app/policies/page.tsx`, `components/portable-text.tsx`, `components/post-card.tsx`
- Test: `tests/unit/portable-text.test.tsx`

**Interfaces:**
- Consumes: `getPosts/getPost/getAboutPage/getPoliciesPage`, `urlFor`.
- Produces: `<RichText value/>` — Portable Text renderer (headings in `font-heading`, inline images via Sanity CDN with alt text, links rust-colored). Blog index: cover-image cards, date, excerpt; empty state "stories are on their way — check back soon". Post page: cover, title, date, body; `generateMetadata` from title/excerpt. About: CJ's photo + CMS body (seed draft covers: artist/musician/therapist/creative; handmade meaning of the name; find-your-authentic-self mission). Policies: CMS body + the static analytics-cookie sentence (Task 12 constraint): "We use a small analytics cookie to understand visits — nothing is sold or shared."

- [ ] **Step 1: Write failing test:** `<RichText>` renders h2 blocks with heading font class, renders a link mark with `text-rust` class and correct href, renders inline image with alt.
- [ ] **Step 2: Run → FAIL. Implement** all four pages (`revalidate = 60`).
- [ ] **Step 3: Run → PASS. Commit** `feat: blog, about, and policies pages`.

---

### Task 10: Community — RSVP API + events UI

**Files:**
- Create: `app/api/rsvp/route.ts`, `lib/rsvp-service.ts`, `app/community/page.tsx`, `app/community/[slug]/page.tsx`, `components/event-card.tsx`, `components/rsvp-form.tsx`
- Test: `tests/unit/rsvp-service.test.ts`, `tests/unit/rsvp-form.test.tsx`

**Interfaces:**
- Consumes: Task 3 queries (`getEventBySlug`, `getRsvpCount`, `findRsvp`) + `sanityWriteClient`.
- Produces:

```ts
// lib/rsvp-service.ts  (deps injected for tests)
export type RsvpResult = 'CREATED' | 'DUPLICATE' | 'FULL' | 'PAST' | 'NOT_FOUND' | 'INVALID';
export function submitRsvp(input: {eventSlug: string; name: string; email: string}, deps: {
  getEvent(slug: string): Promise<{_id: string; startsAt: string; capacity?: number} | null>;
  countRsvps(eventId: string): Promise<number>;
  emailExists(eventId: string, email: string): Promise<boolean>;
  create(doc: {eventId: string; name: string; email: string}): Promise<void>;
  now(): Date;
}): Promise<RsvpResult>;
```

  - Validation: name 1–100 chars, email RFC-basic regex, else `INVALID`. Order of checks: NOT_FOUND → PAST → DUPLICATE → FULL → create.
  - `POST /api/rsvp` maps: CREATED→201, DUPLICATE→409, FULL→403, PAST→410, NOT_FOUND→404, INVALID→400.
  - `/community`: upcoming events (date, time shown in event's local wording, description, spots-left when capacity set) + past events list; empty state "no circles on the calendar right now — follow the blog for the next one". `<RsvpForm eventSlug/>` states: form → success ("You're in! CJ will email you the call link before we start.") / DUPLICATE ("you're already signed up — see you there!") / FULL ("this circle is full 💛 — check back for the next one") / error retry.

- [ ] **Step 1: Write failing service tests:** each result path incl. capacity boundary (count == capacity → FULL; capacity undefined → never FULL) and case-insensitive duplicate email.
- [ ] **Step 2: Run → FAIL. Implement service + route** (route builds deps from Sanity clients).
- [ ] **Step 3: Write failing form tests:** submit success renders the "You're in!" copy; 403 renders full copy; 409 renders duplicate copy.
- [ ] **Step 4: Run → FAIL → implement → PASS.**
- [ ] **Step 5: Commit** `feat: community events with RSVP`.

---

### Task 11: Home page + SEO

**Files:**
- Create: `app/(home)` content in `app/page.tsx` (replace placeholder), `components/hero.tsx`, `app/sitemap.ts`, `app/robots.ts`, `app/opengraph-image.tsx`
- Modify: `app/layout.tsx` (root `metadata`)
- Test: `tests/unit/home.test.tsx`

**Interfaces:**
- Consumes: `getFeaturedProducts`, `getUpcomingEvents`, `getPosts` (first 2), `<ProductCard/>`.
- Produces: Home sections in order — Hero (copy `images/full/logo AC.jpg` → `public/logo.jpg` in this task; hero shows the logo, headline + script-font tagline, and "Shop Hats"/"Shop Accessories" CTAs on linen texture), Featured pieces (up to 4 `ProductCard`s), "Meet CJ" teaser (photo + two sentences + About link), Next event card (or none), Latest posts (2 cards). Root metadata: title template `%s · Authentic Creations`, description "Handmade crochet hats & accessories by CJ Lavender. Find you in whatever you do."; `opengraph-image.tsx` renders brand-colored card. `sitemap.ts` enumerates static routes + product/post/event slugs from Sanity.

- [ ] **Step 1: Write failing test:** home renders hero tagline, both shop CTAs with correct hrefs, and section headings (Featured/Meet CJ/latest posts) given mocked query returns.
- [ ] **Step 2: Run → FAIL. Implement.**
- [ ] **Step 3: Run → PASS.** `npm run build` clean. **Commit** `feat: home page and SEO foundation`.

---

### Task 12: Analytics, deploy config, E2E suite, launch runbook

**Files:**
- Create: `components/rum.tsx`, `amplify.yml`, `playwright.config.ts`, `tests/e2e/shop.spec.ts`, `tests/e2e/rsvp.spec.ts`, `docs/launch-runbook.md`, `docs/square-catalog-checklist.md`
- Modify: `app/layout.tsx` (mount `<Rum/>`), `package.json` (`"test:e2e"`)

**Interfaces:**
- Consumes: everything prior.
- Produces:
  - `<Rum/>`: client component injecting the CloudWatch RUM web client (`aws-rum-web`) configured from the three `NEXT_PUBLIC_RUM_*` vars; **renders nothing and no-ops when vars are unset** (dev/test safe). `allowCookies: true`, `sessionSampleRate: 1`, telemetries `['performance','errors','http']`.
  - `amplify.yml`: install → `npm ci`, build → `npm run build`, cache `node_modules` + `.next/cache`; env passthrough documented inline.
  - Playwright (against `npm run dev` with fake gateway env `SQUARE_FAKE=1` — Task 4's `realGateway()` returns an env-fixture fake when set, added here): `shop.spec.ts` — grid → product → add to cart → mini-cart shows item → cart page → checkout click lands on fake link route asserting order contents; custom flow adds colored line; sold-out product shows badge and disabled button. `rsvp.spec.ts` — RSVP success + full-event message (fixture events).
  - `docs/square-catalog-checklist.md`: spec §6 checklist expanded into stepwise Square Dashboard instructions for CJ (each standard item + "Custom — X" items, flowers variations, shipping/tax config, where variation IDs are found, where they get pasted into Sanity).
  - `docs/launch-runbook.md`: ordered launch steps — create Sanity project + `npm run seed`; Square Sandbox → real token swap; Amplify app creation + repo connect + env vars; CloudWatch RUM app monitor + Cognito guest identity pool (console steps); register **authenticcreationsco.com** (Route 53) + Amplify domain attach; paste real Square variation IDs into Sanity products; smoke-test checklist.

- [ ] **Step 1: Implement `<Rum/>`** (`npm i aws-rum-web`) with a unit test: renders null and does not throw when env unset.
- [ ] **Step 2: Add `SQUARE_FAKE` fixture gateway** behind `realGateway()` (fixture catalog matching the seed products; one product marked sold out) — unit test that `SQUARE_FAKE=1` returns fixture data.
- [ ] **Step 3: Write the two Playwright specs → run `npm run test:e2e` → iterate to green.**
- [ ] **Step 4: Sandbox integration test.** Create `tests/integration/square-sandbox.test.ts`: `describe.skipIf(!process.env.SQUARE_ACCESS_TOKEN)` — against the real Sandbox: `realGateway().createPaymentLink` with one fixture line returns a `https://sandbox.square.link/...` url; `getVariations`/`getInventoryCounts` round-trip a known sandbox item. Runbook records how to run it (`npm test -- tests/integration`) once sandbox credentials exist.
- [ ] **Step 5: Write both docs** (no placeholders — every step actionable).
- [ ] **Step 6: Full gate:** `npm test` + `npm run test:e2e` + `npm run build` all green. **Commit** `feat: analytics, deploy config, e2e suite, launch docs`.

---

## Definition of Done (whole plan)

- All unit + E2E tests green; production build clean.
- Site runs locally end-to-end with `SQUARE_FAKE=1` and a seeded Sanity dataset — browse, custom order, cart, checkout handoff, blog, about, community RSVP.
- Launch runbook + Square catalog checklist complete enough that launch day needs no code changes, only credentials/configuration.
- Mobile + accessibility pass on home/shop/product/cart/community (keyboard-through, focus states, contrast at brand colors, alt text everywhere).
