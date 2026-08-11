/** Crochet-signature heading underline: a single wavy "yarn" strand rendered
 * as an inline SVG path. Purely decorative — aria-hidden, no logic beyond
 * color selection. Color rotates through the accent tier per section (see
 * docs/superpowers/specs/2026-08-11-woven-design-evolution.md §4). */

export type YarnColor = 'rose' | 'mustard' | 'sage' | 'plum' | 'golden';

// Literal class names (not a template string) so Tailwind's static scanner
// can find them — `stroke-${color}` would be invisible to it.
const STROKES: Record<YarnColor, string> = {
  rose: 'stroke-rose',
  mustard: 'stroke-mustard',
  sage: 'stroke-sage',
  plum: 'stroke-plum',
  golden: 'stroke-golden',
};

export default function YarnUnderline({
  color = 'rose',
  className = '',
}: {
  color?: YarnColor;
  className?: string;
}) {
  return (
    <svg
      data-testid="yarn-underline"
      aria-hidden="true"
      focusable="false"
      width="100%"
      height="10"
      viewBox="0 0 150 10"
      preserveAspectRatio="none"
      className={className}
      style={{ display: 'block', marginTop: '2px' }}
    >
      <path
        d="M2 5 Q 12 0, 22 5 T 42 5 T 62 5 T 82 5 T 102 5 T 122 5 T 142 5"
        strokeWidth={2.5}
        strokeLinecap="round"
        fill="none"
        className={STROKES[color]}
      />
    </svg>
  );
}
