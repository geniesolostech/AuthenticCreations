'use client';

import { useState, type ReactNode } from 'react';

import ProductGallery from '@/components/product-gallery';
import ProductPurchasePanel, { type PurchaseOption } from '@/components/product-purchase-panel';
import { urlFor } from '@/lib/sanity/image';
import { firstAvailablePiece, type Piece } from '@/lib/shop/pieces';

export interface PiecePurchaseProps {
  title: string;
  /** Never empty — the product page renders the ordinary gallery/panel pair
   * instead when a product has no pieces. */
  pieces: Piece[];
  options: PurchaseOption[];
  /** The product's own hero image, used for the cart line when the chosen
   * piece has no photo uploaded yet. */
  imageUrl?: string;
  /** The product's heading block (title + description), rendered on the server
   * and passed straight through, so owning the selection here costs no
   * duplicated page prose. */
  children: ReactNode;
}

/**
 * Holds the "which piece?" answer for a product sold by piece.
 *
 * It exists because the two halves of that question sit in different columns of
 * the product page — the shopper picks a piece in the gallery and buys it from
 * the panel — and the page itself is a Server Component, so the state has to
 * live in a client component that renders both. It returns the two columns as a
 * fragment, leaving the page's grid exactly as it is.
 */
export default function PiecePurchase({
  title,
  pieces,
  options,
  imageUrl,
  children,
}: PiecePurchaseProps) {
  const [selectedNumber, setSelectedNumber] = useState<number | null>(
    () => firstAvailablePiece(pieces)?.number ?? null,
  );

  // Re-checked against `sold` rather than trusted from state: the picker never
  // offers a sold piece, and this is what makes that a rule instead of a habit.
  const selected = pieces.find((piece) => piece.number === selectedNumber && !piece.sold) ?? null;
  const allPiecesSold = pieces.every((piece) => piece.sold);

  // The cart row should show the piece the shopper actually chose, since two
  // lines of the same product differ by nothing else.
  const lineImageUrl = selected?.photo.asset
    ? urlFor(selected.photo).width(300).height(300).fit('crop').auto('format').url()
    : imageUrl;

  return (
    <>
      <ProductGallery
        title={title}
        pieces={pieces}
        selectedPiece={selected?.number ?? null}
        onSelectPiece={setSelectedNumber}
      />
      <div className="flex flex-col gap-6">
        {children}
        <ProductPurchasePanel
          productName={title}
          options={options}
          imageUrl={lineImageUrl}
          piece={selected === null ? undefined : { number: selected.number, label: selected.label }}
          allPiecesSold={allPiecesSold}
        />
      </div>
    </>
  );
}
