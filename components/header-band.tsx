'use client';

import type { ReactNode } from 'react';

import { useScrolled } from '@/lib/use-scrolled';

/**
 * The masthead band: the hero's warm gradient (components/hero.tsx), pinned
 * to the top of every page, lifting off the content with the shared card
 * shadow once the page has left the top.
 *
 * `z-30` is deliberately under the mini-cart's scrim (`z-40`) and panel
 * (`z-50`) in components/mini-cart.tsx — the slide-over has to cover the
 * header, not slide beneath it.
 *
 * Only the shadow changes between the two states: no padding, no border, no
 * height, so nothing on the page moves when the band starts sticking. The
 * shadow eases in over the same 200ms the cards use; that is depth, not
 * movement, but `motion-reduce` drops even that for anyone who asked for
 * less.
 */
export default function HeaderBand({ children }: { children: ReactNode }) {
  const scrolled = useScrolled();

  return (
    <header
      data-scrolled={scrolled}
      className={`sticky top-0 z-30 bg-[linear-gradient(135deg,var(--color-sand),var(--color-sand-deep))] transition-shadow duration-200 motion-reduce:transition-none ${
        scrolled ? 'shadow-card' : 'shadow-none'
      }`}
    >
      {children}
    </header>
  );
}
