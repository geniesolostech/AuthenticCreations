'use client';

import { useState, type FormEvent } from 'react';

import ColorSwatchPicker from '@/components/color-swatch-picker';
import PlaceholderImage from '@/components/placeholder-image';
import RevealGrid from '@/components/reveal-grid';
import { useCart } from '@/lib/cart-context';
import { CUSTOM_COLORS_MAX, CUSTOM_COMMENTS_MAX } from '@/lib/constants';
import { formatMoney } from '@/lib/money';
import { quiltStyle } from '@/lib/quilt';
import type { CustomColor } from '@/lib/types';

/** One style of a product sold as styles — a custom rose as against a custom
 * tulip. Only styles Square can actually charge for reach this list; the page
 * drops any variant with no custom variation id. */
export interface CustomProductVariantOption {
  /** React list key, and the identity the picker's selection is held by. */
  key: string;
  label: string;
  customVariationId: string;
  /** `null` when Square couldn't be reached at render time, same as below. */
  priceCents: number | null;
}

export interface CustomProductOption {
  id: string;
  title: string;
  /** The Square variation id for this product's fixed custom price, or
   * `null` when this product has no custom SKU set up yet (pre-launch
   * catalog state can leave this empty for some/all of a section's products).
   * Always `null` on a product sold as styles — each style carries its own. */
  customVariationId: string | null;
  /** `null` when there's no variation id above, or Square couldn't be
   * reached at render time. Either way the card shows "Price at checkout"
   * and Add to Cart stays disabled for it. */
  priceCents: number | null;
  /** Absent or empty on a product that is ordered custom as one thing; a list
   * of styles to choose between otherwise. */
  variants?: CustomProductVariantOption[];
  imageUrl?: string;
}

export interface CustomOrderFormProps {
  products: CustomProductOption[];
}

/**
 * The "make it yours" form: pick a product, pick a style if the product is sold
 * in styles, pick one to `CUSTOM_COLORS_MAX` of the 8 yarn colors, describe what
 * you want, add to cart at the fixed custom price. Colors are combined, not
 * ranked — the price is the same however many are chosen. Custom items are
 * made-to-order (untracked in Square inventory), so there's no sold-out state
 * here — unlike the regular purchase panel, Add to Cart is only ever disabled
 * when the price itself is unknown (Square unreachable).
 */
export default function CustomOrderForm({ products }: CustomOrderFormProps) {
  const { add } = useCart();

  const [productId, setProductId] = useState(products[0]?.id ?? '');
  const [variantKey, setVariantKey] = useState<string | null>(null);
  const [colors, setColors] = useState<CustomColor[]>([]);
  const [comments, setComments] = useState('');
  const [showVariantError, setShowVariantError] = useState(false);
  const [showColorError, setShowColorError] = useState(false);

  if (products.length === 0) return null;

  const selected = products.find((product) => product.id === productId) ?? products[0];
  const variants = selected.variants ?? [];
  const variant = variants.find((option) => option.key === variantKey) ?? null;
  // The chosen style prices the order once there is one; until then the
  // product's own card price stands in, which the page sources from the first
  // style. Not `??`: a style whose price Square couldn't answer for must read
  // as unknown, not fall back to the product's.
  const priceCents = variant === null ? selected.priceCents : variant.priceCents;
  const priceUnknown = priceCents === null;

  function handleProductSelect(id: string) {
    setProductId(id);
    // Styles belong to one product, so a rose cannot survive a switch to a
    // product that has no styles at all.
    setVariantKey(null);
    setShowVariantError(false);
  }

  function handleVariantSelect(key: string) {
    setVariantKey(key);
    setShowVariantError(false);
  }

  // Adds a color, or drops one already chosen; a pick past the cap is ignored.
  // The picker disables those swatches, so the guard here is unreachable
  // through the UI — but this list is what reaches the cart and the order note,
  // so the ceiling is enforced where the colors are actually held.
  function handleColorToggle(next: CustomColor) {
    setColors((prev) => {
      if (prev.includes(next)) return prev.filter((color) => color !== next);
      return prev.length >= CUSTOM_COLORS_MAX ? prev : [...prev, next];
    });
    setShowColorError(false);
  }

  function handleCommentsChange(value: string) {
    setComments(value.length > CUSTOM_COMMENTS_MAX ? value.slice(0, CUSTOM_COMMENTS_MAX) : value);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (priceUnknown) return;
    // Asked for before the variation id is resolved below, not after: a product
    // sold in styles carries no top-level custom id, so an id-first guard would
    // bail out in silence instead of asking which style.
    if (variants.length > 0 && variant === null) {
      setShowVariantError(true);
      return;
    }
    if (colors.length === 0) {
      setShowColorError(true);
      return;
    }
    const variationId = variant === null ? selected.customVariationId : variant.customVariationId;
    if (variationId === null) return;

    add({
      variationId,
      name: variant === null ? `Custom: ${selected.title}` : `Custom: ${selected.title} — ${variant.label}`,
      unitAmount: priceCents as number,
      quantity: 1,
      imageUrl: selected.imageUrl,
      custom: { colors, comments },
    });
    window.dispatchEvent(new CustomEvent('cart:open'));
    setShowColorError(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p id="custom-product-heading" className="font-body text-sm font-semibold text-charcoal">
          Choose a piece
        </p>
        {/* role/aria-labelledby stay on this outer wrapper — RevealGrid only
            owns the reveal-grid class + grid layout, not the a11y group
            semantics (Woven spec §5: custom picker card grid is one of the
            four grids wrapped for the entrance stagger). */}
        <div role="group" aria-labelledby="custom-product-heading">
          <RevealGrid className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {products.map((product, index) => {
              const isSelected = product.id === productId;
              const cardPriceUnknown = product.priceCents === null;
              // "custom pickers" get the same quilt card treatment as shop
              // grids (Woven spec §3) — unselected cards rotate through the
              // frame/fill tokens; the selected card keeps the rust voice
              // interactive elements always use.
              const { frame, fill } = quiltStyle(index);
              return (
                <button
                  key={product.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => handleProductSelect(product.id)}
                  className={`flex flex-col overflow-hidden rounded-xl border-2 text-left shadow-card transition hover:shadow-card-hover ${
                    isSelected
                      ? 'border-rust bg-cream ring-2 ring-rust/40'
                      : `${frame} ${fill} hover:border-rust`
                  }`}
                >
                  <div className="aspect-square w-full overflow-hidden bg-linen">
                    {product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- see components/product-card.tsx
                      <img
                        src={product.imageUrl}
                        alt={product.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <PlaceholderImage title={product.title} />
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5 px-2 py-2">
                    <span className="font-body text-sm font-semibold text-charcoal">{product.title}</span>
                    <span className="font-body text-sm text-khaki">
                      {cardPriceUnknown ? 'Price at checkout' : formatMoney(product.priceCents as number)}
                    </span>
                  </div>
                </button>
              );
            })}
          </RevealGrid>
        </div>
        <p data-testid="custom-price" className="font-heading text-xl text-charcoal">
          {priceUnknown ? 'Price at checkout' : formatMoney(priceCents as number)}
        </p>
      </div>

      {variants.length > 0 && (
        <div className="flex flex-col gap-2">
          <p id="custom-style-heading" className="font-body text-sm font-semibold text-charcoal">
            Pick a style
          </p>
          {/* Pills, not cards: a style is a word, not a photo. Same
              aria-pressed/rust-selected contract as the swatches next to
              them, so keyboard operability comes free from the native
              <button>. */}
          <div role="group" aria-labelledby="custom-style-heading" className="flex flex-wrap gap-2">
            {variants.map((option) => {
              const pressed = option.key === variantKey;
              return (
                <button
                  key={option.key}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => handleVariantSelect(option.key)}
                  className={`rounded-full border px-3 py-2 font-body text-sm transition ${
                    pressed
                      ? 'border-rust bg-linen text-charcoal'
                      : 'border-khaki bg-cream text-charcoal hover:border-rust'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          {showVariantError && (
            <p role="alert" className="font-body text-sm text-rust">
              pick a style for your piece
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="font-body text-sm font-semibold text-charcoal">Pick your yarn colors</span>
        <ColorSwatchPicker selected={colors} onToggle={handleColorToggle} />
        {/* Same counter idiom as the comments box below: the cap is worth
            reading before the unchosen swatches go flat at three. */}
        <p className="self-end font-body text-xs text-khaki">
          {colors.length}/{CUSTOM_COLORS_MAX}
        </p>
        {showColorError && (
          <p role="alert" className="font-body text-sm text-rust">
            pick a color for your piece
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="custom-comments" className="font-body text-sm font-semibold text-charcoal">
          Tell us what you have in mind
        </label>
        <textarea
          id="custom-comments"
          value={comments}
          maxLength={CUSTOM_COMMENTS_MAX}
          onChange={(event) => handleCommentsChange(event.target.value)}
          rows={4}
          className="rounded-lg border border-khaki bg-cream px-3 py-2 font-body text-charcoal"
        />
        <p className="self-end font-body text-xs text-khaki">
          {comments.length}/{CUSTOM_COMMENTS_MAX}
        </p>
      </div>

      <button
        type="submit"
        disabled={priceUnknown}
        className="self-start rounded-full bg-rust px-6 py-3 font-body text-sm font-semibold text-cream transition hover:bg-rust-soft disabled:cursor-not-allowed disabled:bg-khaki disabled:hover:bg-khaki"
      >
        Add to Cart
      </button>
    </form>
  );
}
