/**
 * Saving a seat in a crochet circle, end to end.
 *
 * Runs against `next dev` with `SANITY_FAKE=1` (see playwright.config.ts), so
 * the two circles below are the same two every run: one with room, one already
 * at capacity. The RSVP rules themselves are the real ones — `submitRsvp`
 * decides, exactly as it does against Sanity.
 */
import { expect, test } from '@playwright/test';

import { gotoHydrated } from './helpers';

const OPEN_CIRCLE = {
  slug: 'cozy-crochet-circle',
  title: 'Cozy crochet circle',
};

const FULL_CIRCLE = {
  slug: 'sold-out-stitching-circle',
  title: 'Sold-out stitching circle',
};

const FULL_MESSAGE = 'this circle is full 💛 — check back for the next one';

/**
 * A fresh address per run.
 *
 * The fixture RSVP list lives in the dev server's memory for as long as the
 * server is up, so a fixed address would be a duplicate on the second run (and
 * on a Playwright retry) and this spec would fail for a reason that has nothing
 * to do with what it is testing.
 */
function newGuestEmail(): string {
  return `guest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

test.describe('community RSVP', () => {
  test('lists both circles, saying which one is full', async ({ page }) => {
    await gotoHydrated(page, '/community');

    await expect(page.getByRole('heading', { level: 1, name: 'Community' })).toBeVisible();

    const openCard = page.locator(`a[href="/community/${OPEN_CIRCLE.slug}"]`);
    const fullCard = page.locator(`a[href="/community/${FULL_CIRCLE.slug}"]`);
    await expect(openCard).toContainText(OPEN_CIRCLE.title);
    await expect(fullCard).toContainText(FULL_MESSAGE);
  });

  test('saves a seat and says so', async ({ page }) => {
    await gotoHydrated(page, `/community/${OPEN_CIRCLE.slug}`);
    await expect(page.getByRole('heading', { level: 1, name: OPEN_CIRCLE.title })).toBeVisible();

    await page.getByLabel('Your name').fill('Marisol Vega');
    await page.getByLabel('Email').fill(newGuestEmail());
    await page.getByRole('button', { name: 'Save my seat' }).click();

    // The form is replaced, not merely annotated — there is nothing left to
    // type, and leaving the fields up invites a second submission.
    await expect(page.getByRole('status')).toContainText("You're in!");
    await expect(page.getByRole('button', { name: 'Save my seat' })).toHaveCount(0);
  });

  test('turns away a second attempt from the same address', async ({ page }) => {
    const email = newGuestEmail();

    await gotoHydrated(page, `/community/${OPEN_CIRCLE.slug}`);
    await page.getByLabel('Your name').fill('Marisol Vega');
    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: 'Save my seat' }).click();
    await expect(page.getByRole('status')).toContainText("You're in!");

    await gotoHydrated(page, `/community/${OPEN_CIRCLE.slug}`);
    await page.getByLabel('Your name').fill('Marisol Vega');
    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: 'Save my seat' }).click();

    await expect(page.getByRole('status')).toContainText("you're already signed up");
  });

  test('a full circle shows the message instead of the form', async ({ page }) => {
    await gotoHydrated(page, `/community/${FULL_CIRCLE.slug}`);

    await expect(page.getByRole('heading', { level: 1, name: FULL_CIRCLE.title })).toBeVisible();
    await expect(page.getByText(FULL_MESSAGE)).toBeVisible();
    // Closed server-side, so there is no form to submit at all — not a form
    // that fails on submit.
    await expect(page.getByRole('button', { name: 'Save my seat' })).toHaveCount(0);
    await expect(page.getByLabel('Email')).toHaveCount(0);
  });
});
