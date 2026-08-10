import type { Product } from '@/lib/sanity/queries';

/**
 * The variation id used to price/stock a product tile: its own base
 * variation, or — for a product that only sells as named variants (e.g.
 * crochet flowers) — its first variant, just to give the tile *some* price.
 * The full variant picker lives on the product detail page. Empty when
 * Sanity has no id yet (pre-launch catalog state); those tiles show "Price
 * at checkout".
 *
 * Shared by every page that renders a priced product tile
 * (`app/shop/[section]/page.tsx`'s grid, `app/page.tsx`'s featured-pieces
 * section) — extracted per a Task 11 self-review finding, after this was
 * duplicated verbatim a second time.
 */
export function primaryVariationId(product: Product): string {
  return product.squareVariationId || product.variants?.[0]?.squareVariationId || '';
}
