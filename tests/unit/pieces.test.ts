/**
 * `lib/shop/pieces.ts` — where a product's photos become the one-of-a-kind
 * pieces a shopper picks between.
 *
 * Most of what matters here is about the fields that are *absent*. Every photo
 * uploaded before this pilot existed carries neither `pieceLabel` nor `sold`,
 * and reading either absence as anything but "unnamed, still for sale" would
 * either hide stock or invent it.
 */
import { describe, expect, test } from 'vitest';

import { PIECE_LABEL_MAX } from '@/lib/constants';
import type { SanityImage } from '@/lib/sanity/queries';
import { firstAvailablePiece, pieceName, piecesOf } from '@/lib/shop/pieces';

const asset = { _ref: 'image-abc123-2000x2000-jpg', _type: 'reference' } as const;

const photos: SanityImage[] = [
  { _key: 'a', asset, pieceLabel: 'Sunset' },
  { _key: 'b', asset },
  { _key: 'c', asset, sold: true },
];

describe('piecesOf', () => {
  test('answers with nothing for a product that is not sold by piece', () => {
    expect(piecesOf({ photos })).toEqual([]);
    expect(piecesOf({ sellByPiece: false, photos })).toEqual([]);
  });

  test('answers with nothing for a sell-by-piece product whose photos are not up yet', () => {
    expect(piecesOf({ sellByPiece: true })).toEqual([]);
    expect(piecesOf({ sellByPiece: true, photos: [] })).toEqual([]);
  });

  test('numbers pieces from 1 by photo order', () => {
    expect(piecesOf({ sellByPiece: true, photos }).map((piece) => piece.number)).toEqual([1, 2, 3]);
  });

  test('reads an absent label and an absent sold mark as an unnamed piece still for sale', () => {
    const [, second] = piecesOf({ sellByPiece: true, photos });

    expect(second.label).toBeUndefined();
    expect(second.sold).toBe(false);
  });

  test('treats a whitespace-only label as no label at all, and trims the rest', () => {
    const [blank] = piecesOf({ sellByPiece: true, photos: [{ _key: 'a', pieceLabel: '   ' }] });
    expect(blank.label).toBeUndefined();
    expect(pieceName(blank)).toBe('Piece 1');

    const [padded] = piecesOf({ sellByPiece: true, photos: [{ _key: 'a', pieceLabel: '  Sunset ' }] });
    expect(padded.label).toBe('Sunset');
  });

  test('bounds a label to what the checkout endpoint will accept', () => {
    // The Studio does not cap this field, and a label over the limit is a 400
    // for the whole cart — a long name must read oddly, never break the buy
    // button.
    const [long] = piecesOf({
      sellByPiece: true,
      photos: [{ _key: 'a', pieceLabel: 'x'.repeat(PIECE_LABEL_MAX + 40) }],
    });

    expect(long.label).toHaveLength(PIECE_LABEL_MAX);
  });

  test('never cuts a label through the middle of a surrogate pair', () => {
    // Emoji are two UTF-16 code units each, so a naive slice lands mid-pair and
    // sends Square a lone surrogate.
    const [emoji] = piecesOf({
      sellByPiece: true,
      photos: [{ _key: 'a', pieceLabel: '🧶'.repeat(PIECE_LABEL_MAX) }],
    });

    expect(emoji.label!.length).toBeLessThanOrEqual(PIECE_LABEL_MAX);
    expect(
      [...emoji.label!].filter((char) => {
        const code = char.codePointAt(0)!;
        return code >= 0xd800 && code <= 0xdfff;
      }),
    ).toEqual([]);
  });

  test('ignores a label that is not a string at all', () => {
    // `SanityImage` is index-signature typed, so a stray dataset value reaches
    // here as `unknown` rather than being caught by the compiler.
    const [odd] = piecesOf({ sellByPiece: true, photos: [{ _key: 'a', pieceLabel: 42 as unknown as string }] });

    expect(odd.label).toBeUndefined();
  });

  test('keeps a photo that has no asset, so the numbering matches the Studio', () => {
    // A piece whose photo has not been uploaded yet still exists and still has
    // a position; dropping it would renumber every piece after it, and those
    // numbers are what the maker reads off the order.
    const pieces = piecesOf({ sellByPiece: true, photos: [{ _key: 'a' }, { _key: 'b', asset }] });

    expect(pieces).toHaveLength(2);
    expect(pieces[1].number).toBe(2);
  });

  test('carries the photo through for the picker to render', () => {
    expect(piecesOf({ sellByPiece: true, photos })[0].photo).toBe(photos[0]);
  });
});

describe('pieceName', () => {
  test('prefers the seller’s name', () => {
    expect(pieceName({ number: 3, label: 'Sunset' })).toBe('Sunset');
  });

  test('falls back to the position', () => {
    expect(pieceName({ number: 3 })).toBe('Piece 3');
  });
});

describe('firstAvailablePiece', () => {
  test('is the first piece not marked sold', () => {
    const pieces = piecesOf({
      sellByPiece: true,
      photos: [{ _key: 'a', sold: true }, { _key: 'b', pieceLabel: 'Sunset' }, { _key: 'c' }],
    });

    expect(firstAvailablePiece(pieces)?.number).toBe(2);
  });

  test('is null once every piece is marked sold', () => {
    // Not "nothing chosen yet" — the product itself is unbuyable, whatever
    // Square still counts on hand.
    const pieces = piecesOf({
      sellByPiece: true,
      photos: [{ _key: 'a', sold: true }, { _key: 'b', sold: true }],
    });

    expect(firstAvailablePiece(pieces)).toBeNull();
  });
});
