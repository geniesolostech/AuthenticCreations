/**
 * Request validation for the public API routes.
 *
 * Every limit the routes enforce lives here, in one place, expressed in zod.
 * The routes themselves only ask "did this parse?" — they never re-check a
 * field. Business rules (stock, price, notes) belong to `lib/square/service.ts`
 * and are deliberately absent from this file.
 *
 * `z.object` strips unknown keys, so nothing a client invents can reach the
 * Square layer: the parsed value is exactly the shape declared below.
 */
import { z } from 'zod';

import { CUSTOM_COLORS, CUSTOM_COMMENTS_MAX, MAX_CART_LINES } from '@/lib/constants';

/** Upper bound on ids per inventory request — one storefront page's worth. */
export const MAX_INVENTORY_IDS = 50;

/** Per-line purchase cap, matching the quantity stepper in the cart UI. */
export const MAX_LINE_QUANTITY = 10;

/**
 * A single cart line as it arrives over the wire. Structurally a `CartLine`
 * (`lib/types.ts`); the route hands the parsed value straight to
 * `createCheckout`, so TypeScript checks the two stay in step.
 *
 * `unitAmount` is validated for *shape* only (non-negative integer cents). It is
 * never trusted as a price: the service re-reads the real price from the Square
 * catalog and only ever compares this value against it.
 */
export const cartLineSchema = z.object({
  lineId: z.string().min(1),
  variationId: z.string().min(1),
  name: z.string().min(1),
  unitAmount: z.number().int().nonnegative(),
  quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY),
  imageUrl: z.string().optional(),
  custom: z
    .object({
      color: z.enum(CUSTOM_COLORS),
      comments: z.string().max(CUSTOM_COMMENTS_MAX),
    })
    .optional(),
});

/**
 * Body of `POST /api/checkout`. An empty cart is not a checkout, and a cart
 * bigger than `MAX_CART_LINES` is not a cart — the ceiling keeps an anonymous
 * caller from choosing how much work this endpoint does.
 */
export const checkoutBodySchema = z.object({
  lines: z.array(cartLineSchema).min(1).max(MAX_CART_LINES),
});

export type CheckoutBody = z.infer<typeof checkoutBodySchema>;

/** The `ids` query parameter of `GET /api/inventory`, after splitting. */
export const inventoryIdsSchema = z.array(z.string().min(1)).min(1).max(MAX_INVENTORY_IDS);

/**
 * Parses `?ids=a,b,c` into a list of variation ids, or `null` when the parameter
 * is absent, blank, or over the limit — every one of which is a 400.
 *
 * Blank segments are dropped before counting, so `a,,b` is two ids and a string
 * of separators is no ids at all (and therefore invalid).
 */
export function parseInventoryIds(raw: string | null): string[] | null {
  if (raw === null) return null;

  const candidates = raw
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  const parsed = inventoryIdsSchema.safeParse(candidates);
  return parsed.success ? parsed.data : null;
}
