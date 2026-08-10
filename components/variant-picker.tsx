'use client';

export interface VariantOption {
  label: string;
  squareVariationId: string;
}

export interface VariantPickerProps {
  variants: VariantOption[];
  selectedId: string;
  onSelect: (variant: VariantOption) => void;
  /** Radio group name; give each picker on a page its own group. */
  name?: string;
}

/** Radio group for products sold as named variants (e.g. crochet flowers:
 * rose/tulip/lavender). Controlled — the parent owns `selectedId` so it can
 * switch the price/variationId fed to `<AddToCart>` on selection. */
export default function VariantPicker({
  variants,
  selectedId,
  onSelect,
  name = 'variant',
}: VariantPickerProps) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="font-body text-sm font-semibold text-charcoal">Choose a style</legend>
      <div className="flex flex-wrap gap-2">
        {variants.map((variant) => {
          const checked = variant.squareVariationId === selectedId;
          return (
            <label
              key={variant.squareVariationId}
              className={`cursor-pointer rounded-full border px-4 py-2 font-body text-sm transition ${
                checked ? 'border-rust bg-rust text-cream' : 'border-khaki bg-cream text-charcoal hover:border-rust'
              }`}
            >
              <input
                type="radio"
                name={name}
                value={variant.squareVariationId}
                checked={checked}
                onChange={() => onSelect(variant)}
                className="sr-only"
              />
              {variant.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
