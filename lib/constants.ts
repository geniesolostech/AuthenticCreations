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
export const CUSTOM_COMMENTS_MAX = 500;
/**
 * Most distinct lines one cart may hold. A real cart is a handful of items; the
 * ceiling exists so an anonymous caller cannot make the checkout endpoint do
 * unbounded work (a Square order caps out at 1000 line items regardless).
 */
export const MAX_CART_LINES = 50;
export const SECTIONS = ['hats', 'accessories'] as const;
