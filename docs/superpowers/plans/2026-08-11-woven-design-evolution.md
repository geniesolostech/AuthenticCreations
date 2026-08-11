# Woven Design Evolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin the Authentic Creations site per the approved "Woven" spec — two-tier color extension, quilt card frames, granny-square motifs, yarn underlines, soft shadows, entrance stagger — with zero behavioral change.

**Architecture:** Everything flows from new `@theme` tokens in `app/globals.css`. Two presentational SVG components and one deterministic rotation util carry the decoration; a small IntersectionObserver hook carries motion. Existing components change classes only.

**Tech Stack:** Existing stack only (Next 16, Tailwind v4, Vitest, Playwright). **No new dependencies.**

## Global Constraints

- Spec is binding: `docs/superpowers/specs/2026-08-11-woven-design-evolution.md`. Exact hexes from spec §2; hard contrast rules (charcoal-on-light for body text ≥4.5:1; white text only on terracotta/olive-deep/plum/charcoal; rust remains the only interactive color).
- Accent-tier colors (rose, plum, sage, golden) NEVER cover full section backgrounds.
- Zero behavioral change: no copy, route, layout-structure, money-path, or schema edits. Decorative components are `aria-hidden="true"`.
- All animation respects `prefers-reduced-motion: reduce` (final state, no transition) and must not flake Playwright.
- Brand tokens only — every new color/shadow is a token in `app/globals.css`; no ad-hoc hex in components (SVG components read tokens via CSS vars or Tailwind classes).
- Suite stays green: 537 unit + 16 E2E; update pinned assertions in lockstep. Commit after each green cycle, trailer `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- Quilt/underline rotation is deterministic by index — no randomness, no Date (SSR-identical).

---

### Task 1: Token foundation (colors + shadows)

**Files:**
- Modify: `app/globals.css` (`@theme` block)
- Test: `tests/unit/brand.test.tsx` (extend)

**Interfaces:**
- Consumes: existing `@theme` tokens.
- Produces (later tasks use these exact utility names): colors `terracotta`, `mustard`, `olive-deep`, `clay`, `sand`, `sand-deep`, `sage-band`, `rose`, `plum`, `sage`, `golden`, tints `rose-tint`, `plum-tint`, `sage-tint`, `golden-tint`, `mustard-tint`, `clay-tint`; shadows `shadow-card`, `shadow-card-hover` (usable as Tailwind `shadow-card` / `hover:shadow-card-hover`).

- [ ] **Step 1: Add tokens** to the `@theme` block (hexes verbatim from spec §2; tints: `--color-mustard-tint: #F7EED8`, `--color-clay-tint: #F3E6DB`, others per spec; shadows verbatim from spec §5). Comment each accent-tier token `/* accent tier — small doses only */`.
- [ ] **Step 2: Contrast table.** Add a comment block in globals.css listing every text/background pair the spec introduces with its computed ratio (charcoal #3A3734 on: sand 9.4+, sage-band, each tint; white on: terracotta, olive-deep, plum — compute each with a WCAG relative-luminance calc; any pair <4.5:1 for body text gets its background darkened and the new hex noted). This table is the reviewable contrast evidence.
- [ ] **Step 3: Extend `tests/unit/brand.test.tsx`** — render a probe element with `className="bg-sand text-charcoal shadow-card"` etc. is not verifiable in jsdom (no compiled CSS); instead assert the tokens exist in the source: read `app/globals.css` in the test (Vitest can `import ... ?raw` or use `readFileSync`) and assert every token name from the Produces list appears. Failing first (tokens absent), then pass after Step 1 (order the commit accordingly: write test, see RED, add tokens, GREEN).
- [ ] **Step 4: `npm test` + `npm run build` green. Commit** `feat(woven): extend palette with structure + accent tiers and card shadows`.

### Task 2: Signature components

**Files:**
- Create: `components/granny-corner-motif.tsx`, `components/yarn-underline.tsx`
- Test: `tests/unit/decorations.test.tsx`

**Interfaces:**
- Consumes: Task 1 tokens.
- Produces:

```tsx
// components/granny-corner-motif.tsx
export default function GrannyCornerMotif({ size = 'sm', className = '' }: { size?: 'sm' | 'md'; className?: string });
// Inline SVG, 3x3 rounded squares (rx=2), 9 fills in fixed order:
// terracotta, mustard, olive-deep, sage, rose, plum, golden, clay, terracotta
// via Tailwind fill classes (fill-terracotta etc.). sm => width/height 36, md => 56.
// Root svg: aria-hidden="true", focusable="false", className merged.

// components/yarn-underline.tsx
export type YarnColor = 'rose' | 'mustard' | 'sage' | 'plum' | 'golden';
export default function YarnUnderline({ color = 'rose', className = '' }: { color?: YarnColor; className?: string });
// Inline SVG width 100% of parent (viewBox "0 0 150 10", preserveAspectRatio "none"),
// path d="M2 5 Q 12 0, 22 5 T 42 5 T 62 5 T 82 5 T 102 5 T 122 5 T 142 5",
// strokeWidth 2.5, strokeLinecap round, fill none, stroke via stroke-{color} Tailwind class.
// aria-hidden="true", focusable="false". Rendered as block, marginTop 2px.
// BOTH components: data-testid="granny-motif" / data-testid="yarn-underline" on the svg root
// (Task 5's page tests count them).
```

- [ ] **Step 1: Write failing tests:** motif renders svg with `aria-hidden="true"` and 9 `rect`s; sm/md control width (36/56); underline renders path with the exact `d`, `stroke-rose` class by default, `stroke-plum` when `color="plum"`; both merge a passed `className`.
- [ ] **Step 2: RED → implement per Produces → GREEN.**
- [ ] **Step 3: Commit** `feat(woven): granny-square motif and yarn underline components`.

### Task 3: Quilt rotation util + card treatment

**Files:**
- Create: `lib/quilt.ts`
- Modify: `components/product-card.tsx`, `components/event-card.tsx`, `components/post-card.tsx`, `components/sold-out-badge.tsx`, the custom-picker card styles in `components/custom-order-form.tsx`, custom-banner card in `app/shop/[section]/page.tsx`
- Test: `tests/unit/quilt.test.ts` + extend the touched components' tests

**Interfaces:**
- Consumes: Task 1 tokens.
- Produces:

```ts
// lib/quilt.ts — deterministic quilt rotation
export interface QuiltStyle { frame: string; fill: string; }
export const QUILT_ROTATION: QuiltStyle[] = [
  { frame: 'border-mustard', fill: 'bg-mustard-tint' },
  { frame: 'border-rose',    fill: 'bg-rose-tint' },
  { frame: 'border-sage',    fill: 'bg-sage-tint' },
  { frame: 'border-plum',    fill: 'bg-plum-tint' },
  { frame: 'border-clay',    fill: 'bg-clay-tint' },
  { frame: 'border-golden',  fill: 'bg-golden-tint' },
];
export function quiltStyle(index: number): QuiltStyle; // QUILT_ROTATION[index % 6]; negative/NaN => index 0
```

- Cards accept an optional `quiltIndex?: number` prop; when provided render `border-2 ${frame} ${fill} shadow-card hover:shadow-card-hover transition-shadow duration-200`; when absent, current appearance plus `shadow-card` (so non-grid usages get depth without frames). Grids pass the item's map index (Task 5 wires pages not already passing it).
- `SoldOutBadge`: `bg-charcoal` → `bg-olive-deep` (text stays white). Custom-banner card dashed border → `border-rose`.
- Cart surfaces (spec §3): the `/cart` order-summary container and the mini-cart panel get `shadow-card` only — no frames, no tints, nothing else in cart/checkout changes.

- [ ] **Step 1: Failing tests:** `quiltStyle(0/5/6/13)` returns expected entries (6→index 0, 13→index 1); `quiltStyle(-1)`/`quiltStyle(NaN)` → index 0; ProductCard with `quiltIndex={1}` has `border-rose` + `bg-rose-tint` + `shadow-card`; without prop has `shadow-card` and NO `border-rose`; SoldOutBadge has `bg-olive-deep`; update any test pinning the old badge/banner classes.
- [ ] **Step 2: RED → implement → GREEN** (run the touched component suites, then full suite).
- [ ] **Step 3: Commit** `feat(woven): quilt card frames, tinted fills, and soft shadows`.

### Task 4: Entrance stagger

**Files:**
- Create: `lib/use-reveal.ts`, `components/reveal-grid.tsx`
- Modify: `app/globals.css` (reveal CSS)
- Test: `tests/unit/reveal.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces:

```tsx
// lib/use-reveal.ts
export function useReveal(): { ref: (node: HTMLElement | null) => void; revealed: boolean };
// IntersectionObserver on the node; revealed=true once intersecting (threshold 0.1), observer disconnects after firing.
// If window.matchMedia('(prefers-reduced-motion: reduce)').matches OR IntersectionObserver undefined => revealed starts true.

// components/reveal-grid.tsx — client component
export default function RevealGrid({ children, className = '' }: { children: React.ReactNode; className?: string });
// Wraps children in a div ref'd by useReveal; sets data-revealed={revealed}; children get CSS-driven
// per-child stagger via globals.css:
//   .reveal-grid > * { opacity: 0; transform: translateY(12px); transition: opacity .4s ease, transform .4s ease; }
//   .reveal-grid[data-revealed="true"] > * { opacity: 1; transform: none; }
//   .reveal-grid[data-revealed="true"] > *:nth-child(n) { transition-delay: calc((n-1) * 60ms) } — implement as
//   explicit nth-child(1..12) delay rules (0,60,...,660ms; beyond 12 shares 660ms).
//   @media (prefers-reduced-motion: reduce) { .reveal-grid > * { opacity: 1 !important; transform: none !important; transition: none !important; } }
// className always includes 'reveal-grid'.
```

- [ ] **Step 1: Failing tests** (mock `IntersectionObserver` + `matchMedia`): initial `data-revealed="false"`; simulated intersection → `"true"`; observer disconnected after reveal; reduced-motion → starts `"true"`; missing IntersectionObserver → starts `"true"` (SSR/E2E safety).
- [ ] **Step 2: RED → implement → GREEN.**
- [ ] **Step 3: Commit** `feat(woven): entrance reveal stagger with reduced-motion safety`.

### Task 5: Page application — bands, motifs, underlines, grids

**Files:**
- Modify: `app/page.tsx`, `components/hero.tsx`, `app/shop/[section]/page.tsx`, `app/shop/[section]/custom/page.tsx`, `app/blog/page.tsx`, `app/community/page.tsx`, `app/community/[slug]/page.tsx` (spots-left color only), `app/about/page.tsx`, `app/policies/page.tsx`, `components/site-footer.tsx`
- Test: extend `tests/unit/home.test.tsx` + touched page tests

**Interfaces:**
- Consumes: Tasks 1-4 (`GrannyCornerMotif`, `YarnUnderline`, `quiltStyle`, `RevealGrid`, band tokens).
- Produces: final page composition. Exact placements:
  - Hero: wrapper `bg-linen` → `bg-linear-135 from-sand to-sand-deep` (Tailwind v4 arbitrary gradient ok: `bg-[linear-gradient(135deg,var(--color-sand),var(--color-sand-deep))]`).
  - Home section order/underline colors (fixed): Featured=rose, Meet CJ=mustard, Next event=sage, Latest posts=plum. Motif `sm` beside each heading, alternating left/right starting left (Featured left, Meet CJ right, …); heading + motif share a flex row (`gap-3 items-center`), motif order swapped via `order-first`/`order-last`.
  - Bands: Meet CJ section `bg-sage-band`; Next event `bg-sand`; Featured + Latest posts stay `bg-cream`.
  - Page titles (Shop sections, Custom, Blog, Community): `YarnUnderline` under the h1 (rose on shop, mustard on custom, sage on blog, plum on community) + `sm` motif beside; About: underline (golden) + ONE `sm` motif beside the "Meet CJ" heading (spec §3); Policies: underline only (golden), no motif; both keep cream ground, no band.
  - `spots-left` note text class → `text-plum` (community page + event page).
  - Footer: `md` motif above the tagline, `aria-hidden` (already), charcoal unchanged.
  - Grids wrapped in `RevealGrid`: home Featured, shop grid, custom picker card grid, blog index grid, community upcoming list.
  - Quilt indices wired: every mapped card list passes `quiltIndex={i}`.
- [ ] **Step 1: Failing tests:** home renders 4 section motifs + footer motif (count `svg[aria-hidden]` via test-ids added to components — give motif/underline `data-testid="granny-motif"`/`"yarn-underline"` in Task 2 to make these assertions clean; if not added there, add now with tests); Meet CJ section has `bg-sage-band`; Featured grid wrapper has class `reveal-grid`; ProductCards receive rotating frames (assert first three cards have `border-mustard`/`border-rose`/`border-sage`); spots-left element has `text-plum`; about page has one underline and exactly one motif; policies page has underline and zero motifs.
- [ ] **Step 2: RED → implement → GREEN** (full suite — many page tests will need class-pin updates; update them in the same commit).
- [ ] **Step 3: Commit** `feat(woven): section bands, crochet signatures, and quilt grids across pages`.

### Task 6: Verification pass — E2E, screenshots, contrast confirmation

**Files:**
- Modify (only if E2E needs it): `tests/e2e/helpers.ts` (nothing else)
- Create: screenshots in scratchpad (not committed)

- [ ] **Step 1: Full gates:** `npm test`, `npm run test:e2e` (16/16 — the stagger must not flake: if any E2E flakes, fix by forcing reduced-motion in Playwright via `contextOptions: { reducedMotion: 'reduce' }` in the config projects, a one-line addition, and note it), `npm run build`, `npm run lint`.
- [ ] **Step 2: Screenshot pass** (Playwright script in scratchpad): full-page desktop (1280px) + mobile (390px) of: home, /shop/hats, one product page, /shop/hats/custom, /community, the sample event, /blog, the sample post, /about, /cart. Save to scratchpad for the controller's before/after presentation.
- [ ] **Step 3: Contrast confirmation:** run a small script (scratchpad) computing WCAG ratios for every pair in the globals.css contrast table; paste output in the report; any failure = fix tokens (darken) + re-run + update table.
- [ ] **Step 4: Commit** anything modified (config one-liner only) `test(woven): verification pass`.

---

## Definition of Done

All 6 tasks committed; full suite + E2E + build + lint green; contrast table verified by computation; screenshot set delivered to the controller for user presentation; zero changes outside the files listed (plus test-pin updates); no new dependencies.
