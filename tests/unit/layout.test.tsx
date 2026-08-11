import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test, vi } from 'vitest';

// next/font/google relies on Next's own SWC/webpack loader to resolve real
// font data; outside that pipeline (Vitest/Vite) the imports aren't callable
// the same way. No other test imports app/layout.tsx (or anything that
// transitively pulls in app/fonts.ts), so this is the first place that needs
// the mock — mirrors what Next's own build-time transform would substitute.
// `vi.mock` factories are hoisted above imports by Vitest, so this still
// applies before the `@/app/layout` import below resolves `app/fonts.ts`.
vi.mock('next/font/google', () => ({
  Fraunces: () => ({ variable: '--font-fraunces' }),
  Nunito_Sans: () => ({ variable: '--font-nunito-sans' }),
  Caveat: () => ({ variable: '--font-caveat' }),
}));

import RootLayout from '@/app/layout';

/**
 * Carried finding from Task 4's review: `.reveal-grid > *` starts every
 * grid item at `opacity: 0` client-side-only (see lib/use-reveal.ts) — a
 * visitor with JS disabled never gets the IntersectionObserver callback
 * that would flip it back to visible. This `<noscript>` style override is
 * the fallback so those visitors still see the content.
 */
describe('RootLayout — no-JS fallback for entrance-stagger grids', () => {
  test('renders a noscript style forcing .reveal-grid children visible without JS', () => {
    const html = renderToStaticMarkup(
      RootLayout({ children: <div>content</div>, params: Promise.resolve({}) }),
    );

    expect(html).toContain('<noscript>');
    expect(html).toContain('.reveal-grid > *{opacity:1!important;transform:none!important}');
  });
});
