/**
 * On-brand stand-in for a product photo that hasn't been uploaded yet
 * (pre-launch catalog state — see Task 3's product schema). Inline SVG so it
 * needs no network request and never shows a broken-image icon.
 *
 * The whole graphic is exposed to assistive tech as one image (`role="img"`)
 * with a warm, honest label — never "image not found" — so its decorative
 * children (`aria-hidden`) don't get announced twice.
 */
export interface PlaceholderImageProps {
  title: string;
  className?: string;
  /** Drops the caption (not the accessible label) for thumbnail-sized uses,
   * like a cart line, where the title would render as an illegible smudge. */
  hideTitle?: boolean;
}

export default function PlaceholderImage({ title, className, hideTitle = false }: PlaceholderImageProps) {
  return (
    <svg
      viewBox="0 0 400 400"
      role="img"
      aria-label={`${title} — photo coming soon`}
      className={`h-full w-full max-w-full${className ? ` ${className}` : ''}`}
    >
      <rect width="400" height="400" className="fill-linen" />
      <g aria-hidden="true">
        {/* Yarn ball: a soft olive circle with a few looping strands. */}
        <circle cx="200" cy="165" r="88" className="fill-olive" opacity="0.9" />
        <path
          d="M115 165 Q200 95 285 165"
          className="fill-none stroke-linen"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M120 135 Q200 205 280 135"
          className="fill-none stroke-linen"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M124 195 Q200 255 276 195"
          className="fill-none stroke-linen"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <circle cx="200" cy="165" r="88" className="fill-none stroke-khaki" strokeWidth="3" />
      </g>
      {!hideTitle && (
        <foreignObject x="20" y="278" width="360" height="100" aria-hidden="true">
          <div className="flex h-full w-full items-center justify-center px-2 text-center">
            <span className="line-clamp-2 font-heading text-lg text-charcoal">{title}</span>
          </div>
        </foreignObject>
      )}
    </svg>
  );
}
