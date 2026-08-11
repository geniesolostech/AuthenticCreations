# "Woven" Design Evolution — Authentic Creations

**Date:** 2026-08-11
**Status:** Approved by user (pending written-spec review)
**Scope:** Visual re-skin only — color system, decorative components, depth, motion. Zero behavioral, structural, copy, or route changes.

## 1. Intent

Keep the site cozy and earthy; make it more colorful and attention-grabbing **within the existing palette family**. Chosen through a visual A/B/C comparison: direction **C — "Woven"** (deeper-earth structure + yarn-color accents), with two crochet signatures (granny-square corner motifs, yarn-loop heading underlines) and gentle depth + motion.

User-selected color surfaces: **section backgrounds, cards & frames, decorative accents** (interactive elements keep their current single rust voice).

## 2. Token system

All existing tokens remain. New tokens join `app/globals.css` `@theme` in two tiers.

**Structure tier** (may cover large areas):

| Token | Hex | Role |
|---|---|---|
| `--color-terracotta` | `#A94E1F` | deep call-to-attention structure (badges on light, hero gradient end) |
| `--color-mustard` | `#C9921B` | warm frame color, decorative |
| `--color-olive-deep` | `#5C6B3C` | sold-out badge bg, dark structure accents |
| `--color-clay` | `#B8764A` | warm frame color |
| `--color-sand` | `#EFE0C3` | hero/section band base |
| `--color-sand-deep` | `#E9CFA3` | hero gradient end |
| `--color-sage-band` | `#E4EAD8` | tinted section band (Meet CJ) |

**Accent tier** (yarn colors — small doses only: frames, badges, underlines, motifs; NEVER full section backgrounds):

| Token | Hex | Role |
|---|---|---|
| `--color-rose` | `#C4788A` | frames, custom-card dashed border, underline rotation |
| `--color-plum` | `#6D5382` | spots-left text, frames, underline rotation |
| `--color-sage` | `#96A97C` | frames, underline rotation |
| `--color-golden` | `#E3B341` | frames, underline rotation |

Tinted card fills: 8–12% mixes of the accent over cream (e.g. rose-tint `#F5E6EA`, plum-tint `#EBE4F1`, sage-tint `#EAF0E2`, golden-tint `#F7EED8`) — defined as tokens, not ad-hoc.

**Contrast rules (hard):** body text on any band/fill pairs charcoal-on-light only, ≥ 4.5:1 verified. White text allowed only on terracotta, olive-deep, plum, charcoal (all ≥ 4.5:1 for the sizes used). Rust remains the only interactive/action color. Any pair failing WCAG AA gets darkened at implementation time and the final hex recorded in globals.css comments.

## 3. Surface application, page by page

- **Home:** hero on `linear-gradient(135deg, sand, sand-deep)`; Featured on cream; Meet CJ on sage-band; Next event on sand; Latest posts on cream; footer charcoal (unchanged).
- **Shop grids (+ home Featured, custom pickers):** "quilt" card treatment — each card gets a 2px frame + matching tinted fill, rotating through `[mustard, rose, sage, plum, clay, golden]` **deterministically by grid index** (stable across renders/visits; SSR-safe — no randomness). Sold-out badge: white on olive-deep. Custom-order banner card: dashed border switches to rose.
- **Product detail:** gallery/panel unchanged except card shadow; buy button stays rust.
- **Community:** event cards on tinted fills (rotation), "N spots left" text plum, RSVP form unchanged.
- **Blog:** post cards framed + tinted like the shop quilt.
- **About & Policies:** calm by design — cream ground kept; only the heading underline + one corner motif.
- **Cart / mini-cart / checkout surfaces:** unchanged except card shadows — no color play near money decisions.

## 4. Crochet signature components

- **`<GrannyCornerMotif/>`** — inline SVG 3×3 rounded-square cluster using 9 palette tokens; `aria-hidden="true"`; sizes sm (~36px, used beside headings and page titles) / md (~56px, footer only). Placement: beside major section headings on home (Featured, Meet CJ, Next event, Latest posts — alternating sides), page titles of Shop/Community/Blog, and one in the footer. Nowhere else (restraint is the design).
- **`<YarnUnderline color/>`** — inline SVG wavy strand (the approved sample geometry), width fits heading, stroke 2.5, `aria-hidden`; color rotates per section through the accent tier in fixed order `[rose, mustard, sage, plum]` by section index. Applied under every section heading that gets a motif, plus page titles.

Both are pure presentational components with unit tests for rendering + aria-hidden.

## 5. Depth & motion

- **Shadow tokens:** `--shadow-card: 0 2px 8px rgb(58 55 52 / 0.10), 0 1px 3px rgb(58 55 52 / 0.08)` and `--shadow-card-hover: 0 6px 20px rgb(58 55 52 / 0.14), 0 2px 6px rgb(58 55 52 / 0.10)` (charcoal-tinted, never gray-blue). Applied to product/event/post/custom cards; hover transition 200ms ease.
- **Entrance stagger:** grid items fade-and-rise (opacity 0→1, translateY 12px→0, ~400ms) with ~60ms per-item delay ripple, triggered on first viewport entry via a small `IntersectionObserver` hook + CSS classes. **No animation library.** Fully inert under `prefers-reduced-motion: reduce` (items render in final state) and during E2E (deterministic completion — animations must not flake Playwright; use CSS transitions that Playwright auto-waits through, and add the reduced-motion escape hatch).
- Applied to: shop grids, home Featured, blog index, community lists, custom pickers. Never to cart lines, checkout controls, or form feedback.

## 6. Explicit non-changes

Layout/DOM structure (beyond decorative insertions), typography stack, logo, all copy, routes, header/footer structure, charcoal footer, all money paths, cart/checkout behavior, RSVP behavior, Sanity schemas/content, Square integration, env/config. The 537-test suite stays green with only assertion updates where specific classes/styles are pinned.

## 7. Verification

1. Contrast: scripted check (tiny script or documented manual table in the plan) of every text/background pair introduced; results recorded in the spec-review section of the plan.
2. Unit: existing suites + new tests for `GrannyCornerMotif`, `YarnUnderline`, stagger hook (reduced-motion path pinned), quilt rotation determinism (same index → same frame color).
3. E2E: full suite (desktop + mobile) unchanged and green — proves zero behavioral drift.
4. Visual: before/after full-page screenshots (home, shop grid, product, custom, community, event, blog, post, about, cart) at desktop + mobile widths, presented to the user before merge.
5. `npm run build` + lint clean.

## 8. Out of scope

Dark mode; GSAP or any animation dependency; re-photography; copy changes; layout experiments (bento grids etc.); scalloped edges and stitch dividers (explicitly not selected); any new color outside §2.
