export const CUSTOM_COLORS = ['Black', 'White', 'Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple'] as const;
/**
 * The 8 yarn swatch hexes shown by `<ColorSwatchPicker>` — product DATA (real
 * yarn colors), not UI styling, so this is exempt from the "brand tokens
 * only" rule and rendered via inline `style` rather than a Tailwind class.
 */
export const CUSTOM_COLOR_SWATCHES: Record<(typeof CUSTOM_COLORS)[number], string> = {
  Black: '#1A1A1A',
  White: '#FAFAF7',
  Red: '#B3372F',
  Orange: '#D97829',
  Yellow: '#E3B341',
  Green: '#5F7D45',
  Blue: '#3E6B8C',
  Purple: '#6D5382',
};
/**
 * Most yarn colors one custom piece may combine. One source of truth for the
 * swatch picker's cap and the checkout schema, so the picker can never offer a
 * fourth color the API would refuse.
 */
export const CUSTOM_COLORS_MAX = 3;
export const CUSTOM_COMMENTS_MAX = 500;
/**
 * Longest piece name a checkout line may carry.
 *
 * Like the custom comments, a piece name is display data the client asserts:
 * it travels to the maker in the Square order note and touches neither price
 * nor stock. The cap exists so nobody gets to choose how much text this
 * endpoint carries, and sits far above the names a piece actually gets.
 */
export const PIECE_LABEL_MAX = 80;
/**
 * Most distinct lines one cart may hold. A real cart is a handful of items; the
 * ceiling exists so an anonymous caller cannot make the checkout endpoint do
 * unbounded work (a Square order caps out at 1000 line items regardless).
 */
export const MAX_CART_LINES = 50;
/**
 * Per-line purchase bounds. One source of truth for the cart engine's clamp
 * (`lib/cart.ts`), the request schema (`lib/api-schemas.ts`), and the quantity
 * stepper in the cart UI — a stepper that offered a quantity the API rejects,
 * or clamped one silently, would be a lie either way.
 */
export const MIN_LINE_QUANTITY = 1;
export const MAX_LINE_QUANTITY = 10;
export const SECTIONS = ['hats', 'accessories'] as const;
