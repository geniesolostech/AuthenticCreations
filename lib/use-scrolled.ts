'use client';

import { useEffect, useState } from 'react';

/**
 * `true` while the page sits anywhere but the very top — the sticky header's
 * cue to lift off the content with a shadow (components/header-band.tsx).
 *
 * A scroll listener rather than the IntersectionObserver sentinel idiom of
 * lib/use-reveal.ts: the question here is literally "is the window scrolled",
 * which the window answers directly, and the sentinel that would ask it
 * indirectly is a zero-height node — the one shape IntersectionObserver
 * reports inconsistently across engines.
 *
 * The state starts `false` on the server render and on the client's first
 * (hydration) render, so there is nothing for React to reconcile a mismatch
 * on. The effect then reads the real position on mount, which is what a
 * browser restoring a mid-page scroll (reload, back navigation) needs — a
 * listener alone would leave the header flat until the visitor scrolled again.
 *
 * `passive` because this handler never calls `preventDefault`, and saying so
 * keeps it off the browser's critical scrolling path.
 */
export function useScrolled(): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function update() {
      setScrolled(window.scrollY > 0);
    }

    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  return scrolled;
}
