/** Crochet-signature corner motif: a 3x3 cluster of rounded "granny squares"
 * in a fixed palette order. Purely decorative — aria-hidden, no logic beyond
 * size selection. Placed beside major section headings and page titles (see
 * docs/superpowers/specs/2026-08-11-woven-design-evolution.md §4). */

const CELL = 12;
const GAP = 1;
const STEP = CELL + GAP;

// Fixed fill order per the approved sample: terracotta, mustard, olive-deep,
// sage, rose, plum, golden, clay, terracotta (row-major, top-left to
// bottom-right).
const FILLS = [
  'fill-terracotta',
  'fill-mustard',
  'fill-olive-deep',
  'fill-sage',
  'fill-rose',
  'fill-plum',
  'fill-golden',
  'fill-clay',
  'fill-terracotta',
] as const;

const SIZES = { sm: 36, md: 56 } as const;

export default function GrannyCornerMotif({
  size = 'sm',
  className = '',
}: {
  size?: 'sm' | 'md';
  className?: string;
}) {
  const dimension = SIZES[size];

  return (
    <svg
      data-testid="granny-motif"
      aria-hidden="true"
      focusable="false"
      width={dimension}
      height={dimension}
      viewBox="0 0 39 39"
      className={className}
    >
      {FILLS.map((fill, index) => {
        const row = Math.floor(index / 3);
        const col = index % 3;
        return (
          <rect
            key={index}
            x={col * STEP}
            y={row * STEP}
            width={CELL}
            height={CELL}
            rx={2}
            className={fill}
          />
        );
      })}
    </svg>
  );
}
