export const CUSTOM_COLORS = ['Black', 'White', 'Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple'] as const;
export const CUSTOM_COMMENTS_MAX = 500;
/**
 * Most distinct lines one cart may hold. A real cart is a handful of items; the
 * ceiling exists so an anonymous caller cannot make the checkout endpoint do
 * unbounded work (a Square order caps out at 1000 line items regardless).
 */
export const MAX_CART_LINES = 50;
export const SECTIONS = ['hats', 'accessories'] as const;
