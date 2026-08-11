/** Deterministic "quilt" card rotation (Woven spec §3): shop grids, home
 * Featured, custom pickers, community, and blog cards each pick up a 2px
 * frame plus a matching tinted fill, rotating through the six accent/warm
 * tokens by the item's position in the grid — stable across renders and
 * visits, no randomness, SSR-safe. */

export interface QuiltStyle {
  frame: string;
  fill: string;
}

// Literal class names (not template strings) so Tailwind's static scanner
// can find them — `border-${color}` would be invisible to it (same
// discipline as components/yarn-underline.tsx's STROKES lookup).
export const QUILT_ROTATION: QuiltStyle[] = [
  { frame: 'border-mustard', fill: 'bg-mustard-tint' },
  { frame: 'border-rose', fill: 'bg-rose-tint' },
  { frame: 'border-sage', fill: 'bg-sage-tint' },
  { frame: 'border-plum', fill: 'bg-plum-tint' },
  { frame: 'border-clay', fill: 'bg-clay-tint' },
  { frame: 'border-golden', fill: 'bg-golden-tint' },
];

/** `QUILT_ROTATION[index % QUILT_ROTATION.length]`; a negative or
 * non-finite index (e.g. `NaN`) falls back to index 0 rather than
 * producing a negative modulus or an undefined lookup. */
export function quiltStyle(index: number): QuiltStyle {
  if (!Number.isFinite(index) || index < 0) return QUILT_ROTATION[0];
  return QUILT_ROTATION[index % QUILT_ROTATION.length];
}
