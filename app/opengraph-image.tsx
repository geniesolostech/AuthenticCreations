import { ImageResponse } from 'next/og';

/**
 * The default social-share card for the whole site (any page without its own
 * `opengraph-image` inherits this one). Deliberately static — no Sanity or
 * Square reads — so it always renders, even with zero backing services.
 *
 * `ImageResponse` renders through Satori in its own isolated context, not
 * through Tailwind/PostCSS, so the app's brand Tailwind utilities
 * (bg-cream, text-charcoal, ...) don't reach it. Per this task's binding
 * resolution, the brand hex values from `app/globals.css`'s `@theme` block
 * are repeated here as literals — the one file in the app exempt from the
 * "brand tokens only" rule, for exactly this reason.
 */
const CREAM = '#f7f1e5';
const CHARCOAL = '#3a3734';
const RUST = '#c9622b';

export const alt = 'Authentic Creations — Find you in whatever you do.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 28,
          backgroundColor: CREAM,
        }}
      >
        <div
          style={{
            display: 'flex',
            width: 160,
            height: 160,
            borderRadius: '50%',
            backgroundColor: CHARCOAL,
          }}
        />
        <div
          style={{
            display: 'flex',
            fontFamily: 'serif',
            fontSize: 72,
            color: CHARCOAL,
          }}
        >
          Authentic Creations
        </div>
        <div
          style={{
            display: 'flex',
            fontFamily: 'serif',
            fontStyle: 'italic',
            fontSize: 34,
            color: RUST,
          }}
        >
          Find you in whatever you do.
        </div>
      </div>
    ),
    { ...size },
  );
}
