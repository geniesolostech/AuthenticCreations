'use client';

import { useState, type FormEvent } from 'react';

import ColorSwatchPicker from '@/components/color-swatch-picker';
import PlaceholderImage from '@/components/placeholder-image';
import { useCart } from '@/lib/cart-context';
import { CUSTOM_COMMENTS_MAX } from '@/lib/constants';
import { formatMoney } from '@/lib/money';
import type { CustomColor } from '@/lib/types';

export interface CustomProductOption {
  id: string;
  title: string;
  /** The Square variation id for this product's fixed custom price, or
   * `null` when this product has no custom SKU set up yet (pre-launch
   * catalog state can leave this empty for some/all of a section's products). */
  customVariationId: string | null;
  /** `null` when there's no variation id above, or Square couldn't be
   * reached at render time. Either way the card shows "Price at checkout"
   * and Add to Cart stays disabled for it. */
  priceCents: number | null;
  imageUrl?: string;
}

export interface CustomOrderFormProps {
  products: CustomProductOption[];
}

/**
 * The "make it yours" form: pick a product, pick one of the 8 yarn colors,
 * describe what you want, add to cart at the product's fixed custom price.
 * Custom items are made-to-order (untracked in Square inventory), so there's
 * no sold-out state here — unlike the regular purchase panel, Add to Cart is
 * only ever disabled when the price itself is unknown (Square unreachable).
 */
export default function CustomOrderForm({ products }: CustomOrderFormProps) {
  const { add } = useCart();

  const [productId, setProductId] = useState(products[0]?.id ?? '');
  const [color, setColor] = useState<CustomColor | null>(null);
  const [comments, setComments] = useState('');
  const [showColorError, setShowColorError] = useState(false);

  if (products.length === 0) return null;

  const selected = products.find((product) => product.id === productId) ?? products[0];
  const priceUnknown = selected.priceCents === null;

  function handleColorSelect(next: CustomColor) {
    setColor(next);
    setShowColorError(false);
  }

  function handleCommentsChange(value: string) {
    setComments(value.length > CUSTOM_COMMENTS_MAX ? value.slice(0, CUSTOM_COMMENTS_MAX) : value);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (priceUnknown || selected.customVariationId === null) return;
    if (color === null) {
      setShowColorError(true);
      return;
    }

    add({
      variationId: selected.customVariationId,
      name: `Custom — ${selected.title}`,
      unitAmount: selected.priceCents as number,
      quantity: 1,
      imageUrl: selected.imageUrl,
      custom: { color, comments },
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
        <div
          role="radiogroup"
          aria-labelledby="custom-product-heading"
          className="grid grid-cols-2 gap-3 sm:grid-cols-3"
        >
          {products.map((product) => {
            const isSelected = product.id === productId;
            const cardPriceUnknown = product.priceCents === null;
            return (
              <button
                key={product.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setProductId(product.id)}
                className={`flex flex-col overflow-hidden rounded-xl border-2 bg-cream text-left transition ${
                  isSelected ? 'border-rust ring-2 ring-rust/40' : 'border-khaki hover:border-rust'
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
        </div>
        <p data-testid="custom-price" className="font-heading text-xl text-charcoal">
          {priceUnknown ? 'Price at checkout' : formatMoney(selected.priceCents as number)}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="font-body text-sm font-semibold text-charcoal">Pick your yarn color</span>
        <ColorSwatchPicker selected={color} onSelect={handleColorSelect} />
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
