import { PIECE_LABEL_MAX } from '@/lib/constants';
import type { Product, SanityImage } from '@/lib/sanity/queries';

/**
 * One physical, one-of-a-kind piece of a `sellByPiece` product.
 *
 * A piece *is* a photo: CJ uploads one photo per hat she has actually made, and
 * the shopper picks the one they want. Square knows only that the product has
 * N of these in stock, so the piece a shopper chose reaches her in the order
 * note rather than as a variation of its own.
 */
export interface Piece {
  /** 1-based position in the product's photo array. Shown to the shopper, and
   * the number written on the Square order. */
  number: number;
  /** The seller's name for this piece, when she gave it one. */
  label?: string;
  /** Marked sold in the Studio. Still shown, never buyable. */
  sold: boolean;
  photo: SanityImage;
}

/**
 * The pieces a product is sold as — empty for every product that is not sold by
 * piece, which is what makes the whole feature opt-in: callers branch on
 * `length`, so a product without the flag takes exactly the path it always did.
 *
 * Numbering is by array position and not by `_key`, so it survives a photo with
 * no key at all (the seed script writes some) and reads the same way in the
 * Studio, on the page, and on the order.
 */
export function piecesOf(product: Pick<Product, 'sellByPiece' | 'photos'>): Piece[] {
  if (product.sellByPiece !== true) return [];
  return (product.photos ?? []).map((photo, index) => ({
    number: index + 1,
    label: readLabel(photo.pieceLabel),
    // Absent on every photo authored before the field existed; absent means
    // still for sale, never "unknown".
    sold: photo.sold === true,
    photo,
  }));
}

/**
 * A piece's name, or nothing at all when the seller left the field blank.
 *
 * Bounded here, at the one place a Sanity label becomes a piece, because the
 * label rides all the way to `/api/checkout` — where a string over
 * `PIECE_LABEL_MAX` is a 400 for the *whole cart*. The Studio deliberately does
 * not cap the field (an over-long name is a typo, not an unpublishable
 * product), so trimming it here is what keeps a long name from breaking the buy
 * button instead of just reading oddly. Cut by code point, so the cut can never
 * leave half a surrogate pair behind.
 */
function readLabel(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (trimmed === '') return undefined;
  if (trimmed.length <= PIECE_LABEL_MAX) return trimmed;
  let out = '';
  for (const char of trimmed) {
    if (out.length + char.length > PIECE_LABEL_MAX) break;
    out += char;
  }
  return out;
}

/** What a piece is called on the page, in the cart, and on the order. */
export function pieceName(piece: Pick<Piece, 'number' | 'label'>): string {
  return piece.label ?? `Piece ${piece.number}`;
}

/**
 * The piece a shopper starts on: the first one still for sale, or `null` when
 * the seller has marked every one of them sold. `null` is not "nothing
 * selected yet" — it is the whole product being unbuyable.
 */
export function firstAvailablePiece(pieces: Piece[]): Piece | null {
  return pieces.find((piece) => !piece.sold) ?? null;
}
