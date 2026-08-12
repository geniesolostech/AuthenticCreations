import { CUSTOM_COLORS, SECTIONS } from '@/lib/constants';

export type CustomColor = (typeof CUSTOM_COLORS)[number];
export type Section = (typeof SECTIONS)[number];

export interface CartLine {
  lineId: string; // crypto.randomUUID()
  variationId: string; // Square catalog variation id
  name: string; // display name, e.g. "Crochet Beanie" or "Custom: Crochet Beanie"
  unitAmount: number; // cents at add-time (server re-checks at checkout)
  quantity: number; // 1..10 — always exactly 1 on a `piece` line
  imageUrl?: string;
  /**
   * A custom order's chosen yarn colors — at least one, at most
   * `CUSTOM_COLORS_MAX`, in the order they were picked.
   *
   * The colors carry no roles (no "main" or "trim"), so pick order is the only
   * thing that tells them apart, and it is preserved from the picker all the
   * way to the maker's order note.
   */
  custom?: { colors: CustomColor[]; comments: string };
  /**
   * Which one-of-a-kind piece of a `sellByPiece` product this line is, numbered
   * from 1 by the product's photo order.
   *
   * Every piece of a product shares one Square variation (Square counts the
   * pieces, it does not name them), so this is display data the client asserts
   * — it rides to the maker in the order note and nowhere near the price or the
   * stock check. It is also part of the line's identity: without it two
   * different pieces would merge into one cart line, since their variation ids
   * match.
   */
  piece?: { number: number; label?: string };
}
