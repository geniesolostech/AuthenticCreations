'use client';

import { CUSTOM_COLORS, CUSTOM_COLOR_SWATCHES } from '@/lib/constants';
import type { CustomColor } from '@/lib/types';

export interface ColorSwatchPickerProps {
  selected: CustomColor | null;
  onSelect: (color: CustomColor) => void;
}

/**
 * The 8-swatch yarn color picker for the custom-order form. Native `<button>`
 * elements so keyboard operability (Tab + Enter/Space) is free; each carries
 * `aria-pressed` for its selected state and its own visible name, so the
 * color itself never has to be inferred from the swatch alone.
 */
export default function ColorSwatchPicker({ selected, onSelect }: ColorSwatchPickerProps) {
  return (
    <div role="group" aria-label="Yarn color" className="flex flex-wrap gap-2">
      {CUSTOM_COLORS.map((color) => {
        const pressed = selected === color;
        return (
          <button
            key={color}
            type="button"
            aria-pressed={pressed}
            onClick={() => onSelect(color)}
            className={`flex items-center gap-2 rounded-full border px-3 py-2 font-body text-sm transition ${
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
