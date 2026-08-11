'use client';

import type { ReactNode } from 'react';

import { useReveal } from '@/lib/use-reveal';

/**
 * Wraps a set of grid items (product/event/post cards, etc.) so they fade
 * and rise into place — staggered per child — the first time the grid
 * scrolls into view. All of the actual animation is CSS (`.reveal-grid` in
 * app/globals.css, including the `prefers-reduced-motion` escape hatch);
 * this component only owns the `data-revealed` flag that CSS keys off of.
 *
 * `className` always keeps `reveal-grid` — callers add layout classes
 * (`grid grid-cols-3`, etc.) alongside it, never in place of it.
 */
export default function RevealGrid({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const { ref, revealed } = useReveal();

  return (
    <div
      ref={ref}
      data-revealed={revealed}
      className={`reveal-grid${className ? ` ${className}` : ''}`}
    >
      {children}
    </div>
  );
}
