'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Drives the entrance-stagger effect: `revealed` flips from `false` to
 * `true` the first time the ref'd node crosses 10% into the viewport, then
 * the observer disconnects — it only ever needs to fire once.
 *
 * The `revealed` state itself always starts `false`, on both the server
 * render and the client's first (hydration) render, so there is nothing for
 * React to reconcile a mismatch on. Feature detection (reduced motion, no
 * `IntersectionObserver`) only happens client-side, inside the ref callback,
 * which never runs during SSR. For a browser that supports
 * IntersectionObserver and has no reduced-motion preference — the common
 * case — this means zero hydration-time flips: the item simply stays in its
 * CSS-hidden starting state until it is actually scrolled into view.
 *
 * The reduced-motion / missing-`IntersectionObserver` escape hatches instead
 * resolve on mount, before any scrolling: if the visitor prefers reduced
 * motion, or the environment has no `IntersectionObserver` (SSR, jsdom,
 * some E2E setups), `revealed` is set `true` immediately and no observer is
 * created — there is nothing to watch for.
 */
export function useReveal(): { ref: (node: HTMLElement | null) => void; revealed: boolean } {
  const [revealed, setRevealed] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const ref = useCallback((node: HTMLElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;

    if (!node) return;

    const reducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (typeof IntersectionObserver === 'undefined' || reducedMotion) {
      setRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(node);
    observerRef.current = observer;
  }, []);

  return { ref, revealed };
}
