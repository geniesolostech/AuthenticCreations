'use client';

import { useMemo, useState } from 'react';

import { isSoldOut } from '@/lib/inventory-status';
import { formatMoney } from '@/lib/money';
import { useInventory } from '@/lib/use-inventory';

import AddToCart from './add-to-cart';
import SoldOutBadge from './sold-out-badge';
import VariantPicker, { type VariantOption } from './variant-picker';

export interface PurchaseOption {
  label: string;
  variationId: string;
  /** `null` when Square couldn't be reached at render time. */
  priceCents: number | null;
  trackInventory: boolean;
  /** Server-rendered count at page-render time, for tracked options. */
  initialCount?: number;
}

export interface ProductPurchasePanelProps {
  productName: string;
  /** One entry for a simple product; several for a product sold as named
   * variants (e.g. crochet flowers: rose/tulip/lavender). */
  options: PurchaseOption[];
  imageUrl?: string;
}

/**
 * Client-side purchase panel for the product detail page: wires the variant
 * picker's selection to the price display and `<AddToCart>`, and keeps the
 * sold-out state live via `useInventory`. The server page does all the
 * pricing/stock fetching (Task 4's gateway) and hands it down as `options` —
 * this component never talks to Square itself.
 */
export default function ProductPurchasePanel({ productName, options, imageUrl }: ProductPurchasePanelProps) {
  const [selectedId, setSelectedId] = useState(options[0]?.variationId ?? '');

  const trackedIds = useMemo(
    () => options.filter((option) => option.trackInventory).map((option) => option.variationId),
    [options],
  );
  const initialCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const option of options) {
      if (option.trackInventory && option.initialCount !== undefined) {
        out[option.variationId] = option.initialCount;
      }
    }
    return out;
  }, [options]);
  const liveCounts = useInventory(trackedIds, initialCounts);

  const selected = options.find((option) => option.variationId === selectedId) ?? options[0];
  const soldOut = selected ? isSoldOut(selected.trackInventory, liveCounts[selected.variationId]) : false;
  const variants: VariantOption[] = options.map((option) => ({
    label: option.label,
    squareVariationId: option.variationId,
  }));

  return (
    <div className="flex flex-col gap-4">
      {options.length > 1 && (
        <VariantPicker
          variants={variants}
          selectedId={selectedId}
          onSelect={(variant) => setSelectedId(variant.squareVariationId)}
        />
      )}
      <p className="font-heading text-2xl text-charcoal">
        {selected == null || selected.priceCents === null ? 'Price at checkout' : formatMoney(selected.priceCents)}
      </p>
      {soldOut && <SoldOutBadge />}
      <AddToCart
        variationId={selected?.variationId ?? ''}
        name={options.length > 1 && selected ? `${productName}: ${selected.label}` : productName}
        priceCents={selected?.priceCents ?? null}
        soldOut={soldOut}
        imageUrl={imageUrl}
      />
    </div>
  );
}
