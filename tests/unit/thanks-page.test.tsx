import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'vitest';

import ThanksPage from '@/app/thanks/page';
import { makeLine, readCartLines, readStoredLines, renderWithCart } from '@/tests/helpers/cart-render';

beforeEach(() => {
  window.localStorage.clear();
});

describe('/thanks', () => {
  test('empties a cart that the provider hydrated from storage', () => {
    renderWithCart(<ThanksPage />, [makeLine(), makeLine({ variationId: 'var-2', quantity: 3 })]);

    // The provider hydrates in its own mount effect, which runs *after* the
    // page's — so a naive one-shot clear would be undone by hydration.
    expect(readCartLines()).toEqual([]);
    expect(readStoredLines()).toEqual([]);
  });

  test('is happy to render with an already-empty cart', () => {
    renderWithCart(<ThanksPage />);

    expect(readCartLines()).toEqual([]);
  });

  test('says thank you and reminds about made-to-order timing', () => {
    renderWithCart(<ThanksPage />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/thank you/i);
    expect(screen.getByText(/custom/i)).toBeInTheDocument();
    expect(screen.getByText(/extra time/i)).toBeInTheDocument();
  });

  test('offers the way back into the shop and the community', () => {
    renderWithCart(<ThanksPage />);

    expect(screen.getByRole('link', { name: /hats/i })).toHaveAttribute('href', '/shop/hats');
    expect(screen.getByRole('link', { name: /accessories/i })).toHaveAttribute('href', '/shop/accessories');
    expect(screen.getByRole('link', { name: /community/i })).toHaveAttribute('href', '/community');
  });
});
