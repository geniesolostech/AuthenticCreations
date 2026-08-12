import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import CustomOrderForm, { type CustomProductOption } from '@/components/custom-order-form';
import {
  CUSTOM_COLOR_SWATCHES,
  CUSTOM_COLORS,
  CUSTOM_COLORS_MAX,
  CUSTOM_COMMENTS_MAX,
} from '@/lib/constants';
import { CartProvider, useCart } from '@/lib/cart-context';

function CartLinesProbe() {
  const { lines } = useCart();
  return <pre data-testid="lines">{JSON.stringify(lines)}</pre>;
}

function renderWithCart(ui: ReactNode) {
  return render(
    <CartProvider>
      <CartLinesProbe />
      {ui}
    </CartProvider>,
  );
}

function readLines(): unknown[] {
  return JSON.parse(screen.getByTestId('lines').textContent ?? '[]');
}

const products: CustomProductOption[] = [
  { id: 'p1', title: 'Custom Beanie', customVariationId: 'cust-beanie-1', priceCents: 4500 },
  { id: 'p2', title: 'Custom Scarf', customVariationId: 'cust-scarf-1', priceCents: 6000 },
  { id: 'p3', title: 'Custom Mittens', customVariationId: null, priceCents: null },
];

beforeEach(() => {
  window.localStorage.clear();
});

describe('CUSTOM_COLOR_SWATCHES', () => {
  test('has exactly the 8 CUSTOM_COLORS as keys, each a hex string', () => {
    expect(Object.keys(CUSTOM_COLOR_SWATCHES).sort()).toEqual([...CUSTOM_COLORS].sort());
    for (const color of CUSTOM_COLORS) {
      expect(CUSTOM_COLOR_SWATCHES[color]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  test('matches the exact hexes from the brief', () => {
    expect(CUSTOM_COLOR_SWATCHES.Black).toBe('#1A1A1A');
    expect(CUSTOM_COLOR_SWATCHES.White).toBe('#FAFAF7');
    expect(CUSTOM_COLOR_SWATCHES.Red).toBe('#B3372F');
    expect(CUSTOM_COLOR_SWATCHES.Orange).toBe('#D97829');
    expect(CUSTOM_COLOR_SWATCHES.Yellow).toBe('#E3B341');
    expect(CUSTOM_COLOR_SWATCHES.Green).toBe('#5F7D45');
    expect(CUSTOM_COLOR_SWATCHES.Blue).toBe('#3E6B8C');
    expect(CUSTOM_COLOR_SWATCHES.Purple).toBe('#6D5382');
  });
});

describe('CustomOrderForm', () => {
  test('submitting without a color shows a validation message and adds nothing', async () => {
    const user = userEvent.setup();
    renderWithCart(<CustomOrderForm products={products} />);

    await user.click(screen.getByRole('button', { name: /add to cart/i }));

    expect(screen.getByText('pick a color for your piece')).toBeInTheDocument();
    expect(readLines()).toHaveLength(0);
  });

  test('adds a line with the exact custom fields once a color and comments are given', async () => {
    const user = userEvent.setup();
    renderWithCart(<CustomOrderForm products={products} />);

    await user.click(screen.getByRole('button', { name: 'Red' }));
    await user.type(screen.getByLabelText(/tell us what you have in mind/i), 'Extra fringe please');
    await user.click(screen.getByRole('button', { name: /add to cart/i }));

    const lines = readLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      variationId: 'cust-beanie-1',
      name: 'Custom: Custom Beanie',
      unitAmount: 4500,
      quantity: 1,
      custom: { colors: ['Red'], comments: 'Extra fringe please' },
    });
    // Validation message clears once the order actually goes through.
    expect(screen.queryByText('pick a color for your piece')).not.toBeInTheDocument();
  });

  test('adds the three chosen colors in pick order, at the same price as one', async () => {
    const user = userEvent.setup();
    renderWithCart(<CustomOrderForm products={products} />);

    // Picked back to front through the swatch row, so a line that came back in
    // CUSTOM_COLORS order would be the wrong one.
    await user.click(screen.getByRole('button', { name: 'Purple' }));
    await user.click(screen.getByRole('button', { name: 'Green' }));
    await user.click(screen.getByRole('button', { name: 'Black' }));
    await user.click(screen.getByRole('button', { name: /add to cart/i }));

    expect(readLines()[0]).toMatchObject({
      unitAmount: 4500,
      custom: { colors: ['Purple', 'Green', 'Black'], comments: '' },
    });
  });

  test('the comments counter shows characters typed over the 500 max', async () => {
    const user = userEvent.setup();
    renderWithCart(<CustomOrderForm products={products} />);

    expect(screen.getByText(`0/${CUSTOM_COMMENTS_MAX}`)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/tell us what you have in mind/i), 'Hello');

    expect(screen.getByText(`5/${CUSTOM_COMMENTS_MAX}`)).toBeInTheDocument();
  });

  test(
    'typing past 500 characters is capped — the 501st character is ignored',
    async () => {
      const user = userEvent.setup({ delay: null });
      renderWithCart(<CustomOrderForm products={products} />);

      const longText = 'a'.repeat(CUSTOM_COMMENTS_MAX + 1);
      const textarea = screen.getByLabelText(/tell us what you have in mind/i) as HTMLTextAreaElement;
      await user.type(textarea, longText);

      expect(textarea.value).toHaveLength(CUSTOM_COMMENTS_MAX);
      expect(screen.getByText(`${CUSTOM_COMMENTS_MAX}/${CUSTOM_COMMENTS_MAX}`)).toBeInTheDocument();
    },
    15000,
  );

  test('the product picker is a labelled group of cards, one per product', () => {
    renderWithCart(<CustomOrderForm products={products} />);

    const group = screen.getByRole('group', { name: /choose a piece/i });
    expect(group).toHaveAccessibleName(/choose a piece/i);

    // Native <button>s (aria-pressed, not role="radio") — same pattern as
    // ColorSwatchPicker, so Tab/Enter/Space work for free with no roving
    // tabindex or arrow-key handling to reimplement.
    const cards = within(group).getAllByRole('button');
    expect(cards).toHaveLength(3);
    expect(screen.getByRole('button', { name: /custom beanie/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /custom scarf/i })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /custom mittens/i })).toHaveAttribute('aria-pressed', 'false');
  });

  test('clicking a product card selects it and switches the displayed price', async () => {
    const user = userEvent.setup();
    renderWithCart(<CustomOrderForm products={products} />);

    // The big price display below the grid is the <p>; per-card prices are <span>s.
    expect(screen.getByText('$45.00', { selector: 'p' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /custom scarf/i }));

    expect(screen.getByText('$60.00', { selector: 'p' })).toBeInTheDocument();
    expect(screen.queryByText('$45.00', { selector: 'p' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /custom scarf/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /custom beanie/i })).toHaveAttribute('aria-pressed', 'false');
  });

  test('a product card can be selected via the keyboard', async () => {
    const user = userEvent.setup();
    renderWithCart(<CustomOrderForm products={products} />);

    const scarfCard = screen.getByRole('button', { name: /custom scarf/i });
    scarfCard.focus();
    await user.keyboard('{Enter}');

    expect(scarfCard).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('$60.00', { selector: 'p' })).toBeInTheDocument();
  });

  test('selecting a product with no custom SKU shows "Price at checkout" and disables Add to Cart', async () => {
    const user = userEvent.setup();
    renderWithCart(<CustomOrderForm products={products} />);

    await user.click(screen.getByRole('button', { name: /custom mittens/i }));

    expect(screen.getAllByText('Price at checkout').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /add to cart/i })).toBeDisabled();

    // Color and comments stay usable even though the piece has no price yet.
    await user.click(screen.getByRole('button', { name: 'Red' }));
    expect(screen.getByRole('button', { name: 'Red' })).toHaveAttribute('aria-pressed', 'true');
    await user.type(screen.getByLabelText(/tell us what you have in mind/i), 'Mittens please');
    expect(screen.getByLabelText(/tell us what you have in mind/i)).toHaveValue('Mittens please');
  });

  test('a product with a custom SKU adds the exact cart line once selected via its card', async () => {
    const user = userEvent.setup();
    renderWithCart(<CustomOrderForm products={products} />);

    await user.click(screen.getByRole('button', { name: /custom scarf/i }));
    await user.click(screen.getByRole('button', { name: 'Green' }));
    await user.click(screen.getByRole('button', { name: /add to cart/i }));

    const lines = readLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      variationId: 'cust-scarf-1',
      name: 'Custom: Custom Scarf',
      unitAmount: 6000,
      quantity: 1,
      custom: { colors: ['Green'], comments: '' },
    });
  });

  test('fires cart:open on successful add', async () => {
    const user = userEvent.setup();
    const openSpy = vi.fn();
    window.addEventListener('cart:open', openSpy);

    renderWithCart(<CustomOrderForm products={products} />);
    await user.click(screen.getByRole('button', { name: 'Blue' }));
    await user.click(screen.getByRole('button', { name: /add to cart/i }));

    expect(openSpy).toHaveBeenCalledTimes(1);
    window.removeEventListener('cart:open', openSpy);
  });

  test('a second color joins the first rather than replacing it', async () => {
    const user = userEvent.setup();
    renderWithCart(<CustomOrderForm products={products} />);

    const green = screen.getByRole('button', { name: 'Green' });
    const purple = screen.getByRole('button', { name: 'Purple' });
    expect(green).toHaveAttribute('aria-pressed', 'false');
    expect(purple).toHaveAttribute('aria-pressed', 'false');

    await user.click(green);
    expect(green).toHaveAttribute('aria-pressed', 'true');
    expect(purple).toHaveAttribute('aria-pressed', 'false');

    await user.click(purple);
    expect(green).toHaveAttribute('aria-pressed', 'true');
    expect(purple).toHaveAttribute('aria-pressed', 'true');
  });

  test('clicking a chosen swatch again drops that color', async () => {
    const user = userEvent.setup();
    renderWithCart(<CustomOrderForm products={products} />);

    const green = screen.getByRole('button', { name: 'Green' });
    await user.click(green);
    await user.click(green);

    expect(green).toHaveAttribute('aria-pressed', 'false');
    await user.click(screen.getByRole('button', { name: /add to cart/i }));
    expect(screen.getByRole('alert')).toHaveTextContent('pick a color for your piece');
    expect(readLines()).toHaveLength(0);
  });

  test('dropping a color keeps the others, and the order they were picked in', async () => {
    const user = userEvent.setup();
    renderWithCart(<CustomOrderForm products={products} />);

    await user.click(screen.getByRole('button', { name: 'Red' }));
    await user.click(screen.getByRole('button', { name: 'Blue' }));
    await user.click(screen.getByRole('button', { name: 'Green' }));
    await user.click(screen.getByRole('button', { name: 'Blue' }));
    await user.click(screen.getByRole('button', { name: /add to cart/i }));

    expect(readLines()[0]).toMatchObject({ custom: { colors: ['Red', 'Green'], comments: '' } });
  });

  test('a re-picked color goes to the back of the list, not back to where it was', async () => {
    const user = userEvent.setup();
    renderWithCart(<CustomOrderForm products={products} />);

    await user.click(screen.getByRole('button', { name: 'Red' }));
    await user.click(screen.getByRole('button', { name: 'Blue' }));
    await user.click(screen.getByRole('button', { name: 'Red' }));
    await user.click(screen.getByRole('button', { name: 'Red' }));
    await user.click(screen.getByRole('button', { name: /add to cart/i }));

    expect(readLines()[0]).toMatchObject({ custom: { colors: ['Blue', 'Red'], comments: '' } });
  });

  test('the swatches left over go flat at three, and the chosen ones stay live', async () => {
    const user = userEvent.setup();
    renderWithCart(<CustomOrderForm products={products} />);

    await user.click(screen.getByRole('button', { name: 'Red' }));
    await user.click(screen.getByRole('button', { name: 'Blue' }));
    expect(screen.getByRole('button', { name: 'Green' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Green' }));

    // Every swatch that was not chosen, and only those.
    for (const color of CUSTOM_COLORS) {
      const swatch = screen.getByRole('button', { name: color });
      if (['Red', 'Blue', 'Green'].includes(color)) {
        expect(swatch).toBeEnabled();
      } else {
        expect(swatch).toBeDisabled();
      }
    }
  });

  test('a fourth color is ignored, and offered again as soon as one is dropped', async () => {
    const user = userEvent.setup();
    renderWithCart(<CustomOrderForm products={products} />);

    await user.click(screen.getByRole('button', { name: 'Red' }));
    await user.click(screen.getByRole('button', { name: 'Blue' }));
    await user.click(screen.getByRole('button', { name: 'Green' }));
    await user.click(screen.getByRole('button', { name: 'Purple' }));

    expect(screen.getByRole('button', { name: 'Purple' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText(`${CUSTOM_COLORS_MAX}/${CUSTOM_COLORS_MAX}`)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Blue' }));
    await user.click(screen.getByRole('button', { name: 'Purple' }));
    await user.click(screen.getByRole('button', { name: /add to cart/i }));

    expect(readLines()[0]).toMatchObject({
      custom: { colors: ['Red', 'Green', 'Purple'], comments: '' },
    });
  });

  test('the counter shows how many of the three colors are spoken for', async () => {
    const user = userEvent.setup();
    renderWithCart(<CustomOrderForm products={products} />);

    expect(screen.getByText(`0/${CUSTOM_COLORS_MAX}`)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Red' }));
    expect(screen.getByText(`1/${CUSTOM_COLORS_MAX}`)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Blue' }));
    expect(screen.getByText(`2/${CUSTOM_COLORS_MAX}`)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Red' }));
    expect(screen.getByText(`1/${CUSTOM_COLORS_MAX}`)).toBeInTheDocument();
  });

  test('a color can be selected via the keyboard', async () => {
    const user = userEvent.setup();
    renderWithCart(<CustomOrderForm products={products} />);

    const yellow = screen.getByRole('button', { name: 'Yellow' });
    yellow.focus();
    await user.keyboard('{Enter}');

    expect(yellow).toHaveAttribute('aria-pressed', 'true');
  });

  test('renders all 8 swatch buttons with visible color names', () => {
    renderWithCart(<CustomOrderForm products={products} />);

    for (const color of CUSTOM_COLORS) {
      expect(screen.getByRole('button', { name: color })).toBeInTheDocument();
    }
  });

  test('unselected product-picker cards wear the quilt rotation frame and fill (Woven spec §3)', () => {
    renderWithCart(<CustomOrderForm products={products} />);

    // Custom Beanie (index 0) is selected by default, so index 1/2 are the
    // unselected ones to check against QUILT_ROTATION.
    expect(screen.getByRole('button', { name: /custom scarf/i })).toHaveClass(
      'border-rose',
      'bg-rose-tint',
    );
    expect(screen.getByRole('button', { name: /custom mittens/i })).toHaveClass(
      'border-sage',
      'bg-sage-tint',
    );
  });

  test('the selected product-picker card keeps the rust selection style, not a quilt frame', () => {
    renderWithCart(<CustomOrderForm products={products} />);

    const beanieCard = screen.getByRole('button', { name: /custom beanie/i });
    expect(beanieCard).toHaveClass('border-rust');
    expect(beanieCard).not.toHaveClass('border-mustard');
  });

  test('the picker grid is wrapped for the entrance stagger (Woven spec §5)', () => {
    renderWithCart(<CustomOrderForm products={products} />);

    const group = screen.getByRole('group', { name: /choose a piece/i });
    expect(group.querySelector('.reveal-grid')).not.toBeNull();
    // role/labelling stay on the outer group wrapper — RevealGrid only owns
    // the reveal-grid class and grid layout, not the a11y semantics.
    expect(group).not.toHaveClass('reveal-grid');
  });

  test('a product ordered custom as one thing shows no style picker', () => {
    renderWithCart(<CustomOrderForm products={products} />);

    expect(screen.queryByRole('group', { name: /pick a style/i })).not.toBeInTheDocument();
  });
});

/**
 * Products sold in styles — crochet flowers, where a custom rose and a custom
 * tulip are two Square variations of one "Custom crochet flowers" item. The
 * product's own `customVariationId` is null throughout: the ids live on the
 * styles, which is what makes the "no style chosen" state worth guarding.
 */
const flowerStyles: CustomProductOption = {
  id: 'p-flowers',
  title: 'Crochet flowers',
  customVariationId: null,
  priceCents: 800,
  variants: [
    { key: 'variant-rose', label: 'Rose', customVariationId: 'cust-flower-rose', priceCents: 800 },
    { key: 'variant-tulip', label: 'Tulip', customVariationId: 'cust-flower-tulip', priceCents: 900 },
  ],
};

const styleProducts: CustomProductOption[] = [flowerStyles, products[0]];

describe('CustomOrderForm — products sold in styles', () => {
  test('renders one style button per style, none of them pressed to begin with', () => {
    renderWithCart(<CustomOrderForm products={styleProducts} />);

    const group = screen.getByRole('group', { name: /pick a style/i });
    const styles = within(group).getAllByRole('button');
    expect(styles.map((button) => button.textContent)).toEqual(['Rose', 'Tulip']);
    for (const style of styles) {
      expect(style).toHaveAttribute('aria-pressed', 'false');
    }
  });

  test('a style with no custom SKU in Square is left off the picker entirely', () => {
    // The page drops it before it gets here (lavender, until CJ builds one),
    // so the picker only ever offers styles that can actually be charged for.
    renderWithCart(<CustomOrderForm products={styleProducts} />);

    const group = screen.getByRole('group', { name: /pick a style/i });
    expect(within(group).queryByRole('button', { name: 'Lavender' })).not.toBeInTheDocument();
  });

  test('submitting without a style asks for one and adds nothing', async () => {
    const user = userEvent.setup();
    renderWithCart(<CustomOrderForm products={styleProducts} />);

    await user.click(screen.getByRole('button', { name: 'Red' }));
    await user.click(screen.getByRole('button', { name: /add to cart/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('pick a style for your piece');
    expect(readLines()).toHaveLength(0);
  });

  test('the ask clears as soon as a style is picked', async () => {
    const user = userEvent.setup();
    renderWithCart(<CustomOrderForm products={styleProducts} />);

    await user.click(screen.getByRole('button', { name: /add to cart/i }));
    expect(screen.getByText('pick a style for your piece')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Rose' }));

    expect(screen.queryByText('pick a style for your piece')).not.toBeInTheDocument();
  });

  test('the chosen style prices the order and names the cart line', async () => {
    const user = userEvent.setup();
    renderWithCart(<CustomOrderForm products={styleProducts} />);

    await user.click(screen.getByRole('button', { name: 'Tulip' }));
    await user.click(screen.getByRole('button', { name: 'Green' }));
    await user.type(screen.getByLabelText(/tell us what you have in mind/i), 'two of them please');
    await user.click(screen.getByRole('button', { name: /add to cart/i }));

    const lines = readLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      variationId: 'cust-flower-tulip',
      name: 'Custom: Crochet flowers — Tulip',
      unitAmount: 900,
      quantity: 1,
      custom: { colors: ['Green'], comments: 'two of them please' },
    });
  });

  test('a styled piece carries all three colors too, in pick order and at the style price', async () => {
    const user = userEvent.setup();
    renderWithCart(<CustomOrderForm products={styleProducts} />);

    await user.click(screen.getByRole('button', { name: 'Rose' }));
    await user.click(screen.getByRole('button', { name: 'Red' }));
    await user.click(screen.getByRole('button', { name: 'White' }));
    await user.click(screen.getByRole('button', { name: 'Yellow' }));
    await user.click(screen.getByRole('button', { name: /add to cart/i }));

    const lines = readLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      variationId: 'cust-flower-rose',
      name: 'Custom: Crochet flowers — Rose',
      // Three colors cost what one does; the style is what prices the order.
      unitAmount: 800,
      custom: { colors: ['Red', 'White', 'Yellow'], comments: '' },
    });
  });

  test('a styled piece with no color chosen is refused the same way', async () => {
    const user = userEvent.setup();
    renderWithCart(<CustomOrderForm products={styleProducts} />);

    await user.click(screen.getByRole('button', { name: 'Tulip' }));
    await user.click(screen.getByRole('button', { name: /add to cart/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('pick a color for your piece');
    expect(readLines()).toHaveLength(0);
  });

  test('the displayed price follows the chosen style, and the first one until then', async () => {
    const user = userEvent.setup();
    renderWithCart(<CustomOrderForm products={styleProducts} />);

    // The card price the page sourced from the first style stands in while no
    // style is chosen — the form never shows a range.
    expect(screen.getByTestId('custom-price')).toHaveTextContent('$8.00');

    await user.click(screen.getByRole('button', { name: 'Tulip' }));
    expect(screen.getByTestId('custom-price')).toHaveTextContent('$9.00');

    await user.click(screen.getByRole('button', { name: 'Rose' }));
    expect(screen.getByTestId('custom-price')).toHaveTextContent('$8.00');
  });

  test('aria-pressed moves with the selection, one style at a time', async () => {
    const user = userEvent.setup();
    renderWithCart(<CustomOrderForm products={styleProducts} />);

    const rose = screen.getByRole('button', { name: 'Rose' });
    const tulip = screen.getByRole('button', { name: 'Tulip' });

    await user.click(rose);
    expect(rose).toHaveAttribute('aria-pressed', 'true');
    expect(tulip).toHaveAttribute('aria-pressed', 'false');

    await user.click(tulip);
    expect(rose).toHaveAttribute('aria-pressed', 'false');
    expect(tulip).toHaveAttribute('aria-pressed', 'true');
  });

  test('the selected style wears the rust voice and the rest stay khaki', async () => {
    const user = userEvent.setup();
    renderWithCart(<CustomOrderForm products={styleProducts} />);

    const rose = screen.getByRole('button', { name: 'Rose' });
    expect(rose).toHaveClass('border-khaki');

    await user.click(rose);

    expect(rose).toHaveClass('border-rust');
    expect(screen.getByRole('button', { name: 'Tulip' })).toHaveClass('border-khaki');
  });

  test('a style can be chosen from the keyboard', async () => {
    const user = userEvent.setup();
    renderWithCart(<CustomOrderForm products={styleProducts} />);

    const tulip = screen.getByRole('button', { name: 'Tulip' });
    tulip.focus();
    await user.keyboard('{Enter}');

    expect(tulip).toHaveAttribute('aria-pressed', 'true');
  });

  test('switching products drops the chosen style and hides the picker', async () => {
    const user = userEvent.setup();
    renderWithCart(<CustomOrderForm products={styleProducts} />);

    await user.click(screen.getByRole('button', { name: 'Tulip' }));
    await user.click(screen.getByRole('button', { name: /custom beanie/i }));

    // No styles on the beanie, so no picker — and the order it adds is the
    // plain one, proving the tulip did not survive the switch.
    expect(screen.queryByRole('group', { name: /pick a style/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Blue' }));
    await user.click(screen.getByRole('button', { name: /add to cart/i }));

    expect(readLines()[0]).toMatchObject({
      variationId: 'cust-beanie-1',
      name: 'Custom: Custom Beanie',
      unitAmount: 4500,
    });
  });

  test('coming back to the styled product asks for a style again', async () => {
    const user = userEvent.setup();
    renderWithCart(<CustomOrderForm products={styleProducts} />);

    await user.click(screen.getByRole('button', { name: 'Rose' }));
    await user.click(screen.getByRole('button', { name: /custom beanie/i }));
    await user.click(screen.getByRole('button', { name: /crochet flowers/i }));

    expect(screen.getByRole('button', { name: 'Rose' })).toHaveAttribute('aria-pressed', 'false');

    await user.click(screen.getByRole('button', { name: 'Purple' }));
    await user.click(screen.getByRole('button', { name: /add to cart/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('pick a style for your piece');
    expect(readLines()).toHaveLength(0);
  });

  test('a style Square could not price disables Add to Cart', async () => {
    const user = userEvent.setup();
    const unpriced: CustomProductOption[] = [
      {
        ...flowerStyles,
        variants: [
          flowerStyles.variants![0],
          { key: 'variant-tulip', label: 'Tulip', customVariationId: 'cust-flower-tulip', priceCents: null },
        ],
      },
    ];
    renderWithCart(<CustomOrderForm products={unpriced} />);

    await user.click(screen.getByRole('button', { name: 'Tulip' }));

    expect(screen.getByTestId('custom-price')).toHaveTextContent('Price at checkout');
    expect(screen.getByRole('button', { name: /add to cart/i })).toBeDisabled();
  });
});
