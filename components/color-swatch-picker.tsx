'use client';

import { CUSTOM_COLORS, CUSTOM_COLORS_MAX, CUSTOM_COLOR_SWATCHES } from '@/lib/constants';
import type { CustomColor } from '@/lib/types';

export interface ColorSwatchPickerProps {
  /** The colors chosen so far, in pick order. */
  selected: CustomColor[];
  /** Adds a color, or drops it when it is already chosen. */
  onToggle: (color: CustomColor) => void;
}

/**
 * The 8-swatch yarn color picker for the custom-order form: one toggle per
 * swatch, up to `CUSTOM_COLORS_MAX` of them at once. Native `<button>`
 * elements so keyboard operability (Tab + Enter/Space) is free; each carries
 * `aria-pressed` for its selected state and its own visible name, so the
 * color itself never has to be inferred from the swatch alone.
 *
 * At the cap the unchosen swatches disable themselves rather than swallowing
 * a click in silence — the same reasoning as the cart's quantity stepper,
 * which states its bounds instead of leaving them to a quiet clamp.
 */
export default function ColorSwatchPicker({ selected, onToggle }: ColorSwatchPickerProps) {
  const atCap = selected.length >= CUSTOM_COLORS_MAX;
  return (
    <div role="group" aria-label="Yarn colors" className="flex flex-wrap gap-2">
      {CUSTOM_COLORS.map((color) => {
        const pressed = selected.includes(color);
        return (
          <button
            key={color}
            type="button"
            aria-pressed={pressed}
            disabled={atCap && !pressed}
            onClick={() => onToggle(color)}
            className={`flex items-center gap-2 rounded-full border px-3 py-2 font-body text-sm transition disabled:cursor-not-allowed disabled:border-linen disabled:text-khaki disabled:hover:border-linen ${
              pressed
                ? 'border-rust bg-linen text-charcoal'
                : 'border-khaki bg-cream text-charcoal hover:border-rust'
            }`}
          >
            <span
              aria-hidden="true"
              className="h-5 w-5 rounded-full border border-charcoal/20"
              style={{ backgroundColor: CUSTOM_COLOR_SWATCHES[color] }}
            />
            {color}
          </button>
        );
      })}
    </div>
  );
}
