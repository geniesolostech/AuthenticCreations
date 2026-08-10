/**
 * The buying journey, end to end: grid → product → cart → handoff to Square.
 *
 * Everything here runs against a real `next dev` server with `SQUARE_FAKE=1`
 * and `SANITY_FAKE=1` (see playwright.config.ts). The fixture gateway is a
 * `SquareGateway` like any other, so the order these specs watch leave the
 * browser has been through the same price and stock re-validation a real one
 * would — the fixtures replace Square's *data*, not the app's rules.
 *
 * No `waitForTimeout` anywhere: every assertion below is a Playwright
 * web-first one, which retries until it passes or the expect timeout is up.
 */
import { expect, test, type Page, type Request } from '@playwright/test';

import { gotoHydrated } from './helpers';

/** Where the fixture gateway's payment link points (lib/square/fixtures.ts). */
const FAKE_CHECKOUT = 'https://sandbox.square.link/u/fake-checkout';

const RUFFLED_HAT = {
  name: 'Crochet ruffled bucket hat',
  href: '/shop/hats/crochet-ruffled-bucket-hat',
  price: '$45.00',
  variationId: 'FAKEVAR-RUFFLED-BUCKET-HAT',
  customVariationId: 'FAKEVAR-CUSTOM-RUFFLED-BUCKET-HAT',
  customPrice: '$55.00',
};

const BEANIE = {
  name: 'Crochet beanie',
  href: '/shop/hats/crochet-beanie',
};

/**
 * Swallows the navigation to Square.
 *
 * The fixture link is a real absolute URL on Square's sandbox host, so without
 * this the browser would actually try to leave the machine. Fulfilling it
 * locally keeps the suite offline while still proving the app performed a
 * top-level navigation to exactly that address.
 */
async function interceptSquare(page: Page): Promise<void> {
  await page.route(`${FAKE_CHECKOUT}*`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<html><body><h1>Square checkout (fixture)</h1></body></html>',
    }),
  );
}

/** The cart the browser POSTed, captured from the wire rather than inferred. */
function captureCheckoutRequest(page: Page): Promise<Request> {
  return page.waitForRequest(
    (request) => request.url().includes('/api/checkout') && request.method() === 'POST',
  );
}

/** The slide-over cart, by its dialog role rather than a CSS hook. */
function miniCart(page: Page) {
  return page.getByRole('dialog', { name: 'Your cart' });
}

test.describe('shop', () => {
  test('grid → product → cart → checkout hands Square the right order', async ({ page }) => {
    await interceptSquare(page);

    // --- the grid ---------------------------------------------------------
    await gotoHydrated(page, '/shop/hats');
    await expect(page.getByRole('heading', { level: 1, name: 'Hats' })).toBeVisible();

    const hatCard = page.locator(`a[href="${RUFFLED_HAT.href}"]`);
    await expect(hatCard).toBeVisible();
    // The price on the tile comes from Square, not Sanity — proof the grid's
    // catalog read happened at all.
    await expect(hatCard).toContainText(RUFFLED_HAT.price);

    // --- the product page -------------------------------------------------
    await hatCard.click();
    await expect(page).toHaveURL(new RegExp(`${RUFFLED_HAT.href}$`));
    await expect(page.getByRole('heading', { level: 1, name: RUFFLED_HAT.name })).toBeVisible();
    await expect(page.getByText(RUFFLED_HAT.price)).toBeVisible();

    const addToCart = page.getByRole('button', { name: 'Add to Cart' });
    await expect(addToCart).toBeEnabled();
    await addToCart.click();

    // --- the mini-cart ----------------------------------------------------
    const panel = miniCart(page);
    await expect(panel).toBeVisible();
    await expect(panel.getByText(RUFFLED_HAT.name)).toBeVisible();
    await expect(panel.getByTestId('cart-subtotal')).toHaveText(RUFFLED_HAT.price);

    // --- the cart page ----------------------------------------------------
    await panel.getByRole('link', { name: 'View cart' }).click();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Your cart' })).toBeVisible();
    await expect(page.getByTestId('cart-subtotal')).toHaveText(RUFFLED_HAT.price);

    // --- the handoff ------------------------------------------------------
    const checkoutRequest = captureCheckoutRequest(page);
    await page.getByRole('button', { name: 'Checkout' }).click();

    // What the browser actually sent: the variation id and quantity, and a
    // price it does not get to choose (the server re-reads that from Square).
    const body = (await checkoutRequest).postDataJSON() as {
      lines: { variationId: string; quantity: number; unitAmount: number }[];
    };
    expect(body.lines).toHaveLength(1);
    expect(body.lines[0]).toMatchObject({
      variationId: RUFFLED_HAT.variationId,
      quantity: 1,
      unitAmount: 4500,
    });

    // And where it went: the payment link the gateway built, spelling out the
    // order Square was asked to charge for.
    await page.waitForURL(`${FAKE_CHECKOUT}*`);
    const handoff = new URL(page.url());
    expect(handoff.searchParams.get('items')).toBe(`${RUFFLED_HAT.variationId}:1`);
    expect(handoff.searchParams.get('redirect')).toMatch(/\/thanks$/);
  });

  test('a custom order carries its colour and comments into the cart and the order', async ({
    page,
  }) => {
    await interceptSquare(page);
    await gotoHydrated(page, '/shop/hats/custom');

    await expect(page.getByRole('heading', { level: 1, name: 'Custom Hats' })).toBeVisible();
    await expect(page.getByText(RUFFLED_HAT.customPrice)).toBeVisible();

    const comments = 'a wide brim please, and a little slouch';
    await page.getByRole('button', { name: 'Blue' }).click();
    await page.locator('#custom-comments').fill(comments);
    await page.getByRole('button', { name: 'Add to Cart' }).click();

    // The cart line says who it is for and what was asked for.
    const panel = miniCart(page);
    await expect(panel).toBeVisible();
    await expect(panel.getByText(`Custom — ${RUFFLED_HAT.name}`)).toBeVisible();
    await expect(panel.getByText('Color: Blue')).toBeVisible();
    await expect(panel.getByText(comments)).toBeVisible();
    await expect(panel.getByTestId('cart-subtotal')).toHaveText(RUFFLED_HAT.customPrice);

    // And so does the order: the note is the only way the maker learns the
    // colour, so it has to survive all the way to Square.
    const checkoutRequest = captureCheckoutRequest(page);
    await panel.getByRole('button', { name: 'Checkout' }).click();
    const body = (await checkoutRequest).postDataJSON() as {
      lines: { variationId: string; custom?: { color: string; comments: string } }[];
    };
    expect(body.lines[0].variationId).toBe(RUFFLED_HAT.customVariationId);
    expect(body.lines[0].custom).toEqual({ color: 'Blue', comments });

    await page.waitForURL(`${FAKE_CHECKOUT}*`);
    const handoff = new URL(page.url());
    expect(handoff.searchParams.get('items')).toBe(`${RUFFLED_HAT.customVariationId}:1`);
    expect(handoff.searchParams.get('notes')).toBe(
      `Custom order — Color: Blue. ${comments}`,
    );
  });

  test('a sold-out piece is badged on the grid and unbuyable on its page', async ({ page }) => {
    await gotoHydrated(page, '/shop/hats');

    const beanieCard = page.locator(`a[href="${BEANIE.href}"]`);
    await expect(beanieCard).toBeVisible();
    await expect(beanieCard.getByText('Sold out')).toBeVisible();

    await beanieCard.click();
    await expect(page.getByRole('heading', { level: 1, name: BEANIE.name })).toBeVisible();

    // The button is the thing that matters: badged but clickable would be a
    // shopper paying for a hat that does not exist.
    const button = page.getByRole('button', { name: 'Sold out' });
    await expect(button).toBeVisible();
    await expect(button).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Add to Cart' })).toHaveCount(0);
  });

  test('a variant product prices and sells the variant that was chosen', async ({ page }) => {
    await gotoHydrated(page, '/shop/accessories/crochet-flowers');

    await expect(page.getByRole('heading', { level: 1, name: 'Crochet flowers' })).toBeVisible();
    await expect(page.getByText('Choose a style')).toBeVisible();

    // The radio inputs are visually hidden behind their labels, which is what
    // a real shopper clicks.
    await page.locator('label').filter({ hasText: 'Tulip' }).click();
    await page.getByRole('button', { name: 'Add to Cart' }).click();

    const panel = miniCart(page);
    await expect(panel).toBeVisible();
    await expect(panel.getByText('Crochet flowers — Tulip')).toBeVisible();
    await expect(panel.getByTestId('cart-subtotal')).toHaveText('$9.00');
  });
});
