'use client';

import { useState } from 'react';

import { urlFor } from '@/lib/sanity/image';
import type { SanityImage } from '@/lib/sanity/queries';
import { pieceName, type Piece } from '@/lib/shop/pieces';

import PlaceholderImage from './placeholder-image';
import SoldOutBadge from './sold-out-badge';

export interface ProductGalleryProps {
  title: string;
  photos?: SanityImage[];
  /**
   * Piece-picker mode: the one-of-a-kind pieces this product's photos stand
   * for. Empty (the default, and every product that is not sold by piece)
   * keeps the plain hero + thumbnail-strip gallery untouched.
   */
  pieces?: Piece[];
  /** Controlled selection, by piece number. `null` when every piece is sold —
   * there is nothing to select, not merely nothing selected yet. */
  selectedPiece?: number | null;
  onSelectPiece?: (pieceNumber: number) => void;
}

/** Product-detail hero image with a thumbnail strip. Falls back to the
 * on-brand placeholder when the product has no photos yet. */
export default function ProductGallery({
  title,
  photos,
  pieces = [],
  selectedPiece = null,
  onSelectPiece,
}: ProductGalleryProps) {
  const usable = (photos ?? []).filter((photo) => photo.asset);
  const [selected, setSelected] = useState(0);

  if (pieces.length > 0) {
    return (
      <PiecePicker
        title={title}
        pieces={pieces}
        selectedPiece={selectedPiece}
        onSelectPiece={onSelectPiece}
      />
    );
  }

  if (usable.length === 0) {
    return (
      <div className="aspect-square w-full max-w-full overflow-hidden rounded-2xl bg-linen">
        <PlaceholderImage title={title} />
      </div>
    );
  }

  const activeIndex = Math.min(selected, usable.length - 1);
  const mainUrl = urlFor(usable[activeIndex]).width(1200).height(1200).fit('crop').auto('format').url();

  return (
    <div className="flex flex-col gap-3">
      <div className="aspect-square w-full max-w-full overflow-hidden rounded-2xl bg-linen">
        {/* eslint-disable-next-line @next/next/no-img-element -- see product-card.tsx */}
        <img src={mainUrl} alt={title} className="h-full w-full max-w-full object-cover" />
      </div>
      {usable.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {usable.map((photo, index) => {
            const thumbUrl = urlFor(photo).width(160).height(160).fit('crop').auto('format').url();
            return (
              <button
                key={index}
                type="button"
                aria-label={`Photo ${index + 1}`}
                aria-pressed={index === activeIndex}
                onClick={() => setSelected(index)}
                className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                  index === activeIndex ? 'border-rust' : 'border-transparent hover:border-khaki'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- see product-card.tsx */}
                <img src={thumbUrl} alt="" className="h-full w-full max-w-full object-cover" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * The same gallery, read as a shelf: every photo is a different physical piece,
 * and choosing one *is* choosing what to buy. Controlled, because the buy
 * button lives in the other column of the product page and has to know which
 * piece the shopper is looking at.
 *
 * Sold pieces stay on the shelf — greyed, badged, and unclickable. Hiding them
 * would renumber everything after them, and the numbers are what the maker
 * reads off the order.
 */
function PiecePicker({
  title,
  pieces,
  selectedPiece,
  onSelectPiece,
}: {
  title: string;
  pieces: Piece[];
  selectedPiece: number | null;
  onSelectPiece?: (pieceNumber: number) => void;
}) {
  // With every piece sold there is no selection to show, so the first one
  // stands in for the product — the shopper still gets to see what it is.
  const shown = pieces.find((piece) => piece.number === selectedPiece) ?? pieces[0];
  const shownName = `${title}: ${pieceName(shown)}`;
  const heroUrl = shown.photo.asset
    ? urlFor(shown.photo).width(1200).height(1200).fit('crop').auto('format').url()
    : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="aspect-square w-full max-w-full overflow-hidden rounded-2xl bg-linen">
        {heroUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- see product-card.tsx
          <img src={heroUrl} alt={shownName} className="h-full w-full max-w-full object-cover" />
        ) : (
          <PlaceholderImage title={shownName} />
        )}
      </div>

      <p id="piece-picker-heading" className="font-body text-sm font-semibold text-charcoal">
        Pick your piece
      </p>
      <div
        role="group"
        aria-labelledby="piece-picker-heading"
        className="grid grid-cols-3 gap-2 sm:grid-cols-4"
      >
        {pieces.map((piece) => {
          const name = pieceName(piece);
          const isSelected = piece.number === selectedPiece;
          const thumbUrl = piece.photo.asset
            ? urlFor(piece.photo).width(300).height(300).fit('crop').auto('format').url()
            : undefined;
          return (
            <button
              key={piece.photo._key ?? piece.number}
              type="button"
              // Spelled out rather than left to the tile's contents, so the
              // name a screen reader reads is the piece's name and its state —
              // not the placeholder graphic's label stitched onto both.
              aria-label={piece.sold ? `${name} (sold)` : name}
              aria-pressed={isSelected}
              disabled={piece.sold}
              onClick={() => onSelectPiece?.(piece.number)}
              // Sold is checked before selected, and not merely appended to it:
              // a sold tile must not also carry `hover:border-rust`, since two
              // hover border-colors in one class string are settled by CSS
              // source order rather than by the order written here.
              className={`flex flex-col overflow-hidden rounded-xl border-2 text-left transition ${
                piece.sold
                  ? 'cursor-not-allowed border-khaki'
                  : isSelected
                    ? 'border-rust bg-cream ring-2 ring-rust/40'
                    : 'border-khaki hover:border-rust'
              }`}
            >
              <div className="relative aspect-square w-full overflow-hidden bg-linen">
                {/* The photo greys out, the badge does not: the badge is the
                    one thing on a sold tile that has to stay legible. */}
                <div className={`h-full w-full${piece.sold ? ' opacity-50 grayscale' : ''}`}>
                  {thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- see product-card.tsx
                    <img src={thumbUrl} alt="" className="h-full w-full max-w-full object-cover" />
                  ) : (
                    <PlaceholderImage title={name} hideTitle />
                  )}
                </div>
                {piece.sold && (
                  <div className="absolute right-1 top-1">
                    <SoldOutBadge label="Sold" />
                  </div>
                )}
              </div>
              <span
                className={`truncate px-2 py-1 font-body text-xs ${
                  piece.sold ? 'text-khaki' : 'text-charcoal'
                }`}
              >
                {name}
              </span>
            </button>
          );
        })}
      </div>
      <p className="font-body text-xs text-khaki">
        Every photo is a different piece, made one at a time. The one you pick is the one that ships.
      </p>
    </div>
  );
}
