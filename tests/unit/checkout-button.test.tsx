import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import CheckoutButton, { _resetCheckoutInFlightForTests } from '@/components/checkout-button';
import { MAX_CART_LINES } from '@/lib/constants';
import { assignLocation, reloadLocation } from '@/lib/navigate';
import { makeLine, readCartLines, readStoredLines, renderWithCart } from '@/tests/helpers/cart-render';
import type { CartLine } from '@/lib/types';

// jsdom refuses to navigate, so the two navigations this component performs go
// through a one-line indirection that tests can replace wholesale.
vi.mock('@/lib/navigate', () => ({
  assignLocation: vi.fn(),
  reloadLocation: vi.fn(),
}));

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status });
}

function checkoutButton(): HTMLElement {
  return screen.getByRole('button', { name: /checkout/i });
}

/** Clicks and lets the in-flight fetch promise chain settle. */
async function clickCheckout() {
  await act(async () => {
    fireEvent.click(checkoutButton());
  });
}

beforeEach(() => {
  window.localStorage.clear();
  // The in-flight guard is module state by design (it has to outlive an
  // unmounted mini-cart), so it also outlives a test unless reset.
  _resetCheckoutInFlightForTests();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('CheckoutButton — empty and oversized carts', () => {
  test('is disabled when the cart is empty', () => {
    renderWithCart(<CheckoutButton />);

    expect(checkoutButton()).toBeDisabled();
  });

  test('a cart over the line limit says so and cannot be submitted', () => {
    const fetchMock = vi.spyOn(global, 'fetch');
    const lines: CartLine[] = Array.from({ length: MAX_CART_LINES + 1 }, (_, i) =>
      makeLine({ variationId: `var-${i}` }),
    );

    renderWithCart(<CheckoutButton />, lines);

    expect(screen.getByText(new RegExp(`${MAX_CART_LINES} different`, 'i'))).toBeInTheDocument();
    expect(checkoutButton()).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('CheckoutButton — happy path', () => {
  test('POSTs the cart lines and hands off to the Square url', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(json({ url: 'https://square.link/u/abc' }, 200));
    const lines = [makeLine({ quantity: 2 })];

    renderWithCart(<CheckoutButton />, lines);
    await clickCheckout();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/checkout');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ lines });
    expect(assignLocation).toHaveBeenCalledWith('https://square.link/u/abc');
  });

  test('does NOT clear the cart on handoff — Square-page abandonment keeps it', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(json({ url: 'https://square.link/u/abc' }, 200));

    renderWithCart(<CheckoutButton />, [makeLine()]);
    await clickCheckout();

    expect(readCartLines()).toHaveLength(1);
  });

  test('shows the pending label while the POST is in flight and stays disabled after handoff', async () => {
    let resolve: (value: Response) => void = () => {};
    vi.spyOn(global, 'fetch').mockReturnValue(
      new Promise<Response>((r) => {
        resolve = r;
      }),
    );

    renderWithCart(<CheckoutButton />, [makeLine()]);
    fireEvent.click(checkoutButton());

    expect(screen.getByRole('button', { name: /heading to checkout/i })).toBeDisabled();

    await act(async () => {
      resolve(json({ url: 'https://square.link/u/abc' }, 200));
    });

    // The browser is on its way to Square; re-enabling would invite a second order.
    expect(screen.getByRole('button', { name: /heading to checkout/i })).toBeDisabled();
  });

  test('a double-click only ever creates one checkout', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(json({ url: 'https://square.link/u/abc' }, 200));

    renderWithCart(<CheckoutButton />, [makeLine()]);

    // fireEvent dispatches straight at the element, bypassing the browser's
    // "no clicks on disabled buttons" rule — so this really exercises the
    // in-flight guard rather than the disabled attribute.
    await act(async () => {
      const button = checkoutButton();
      fireEvent.click(button);
      fireEvent.click(button);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(assignLocation).toHaveBeenCalledTimes(1);
  });

  test('coming back from Square via the bfcache re-arms the button', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(json({ url: 'https://square.link/u/abc' }, 200));

    renderWithCart(<CheckoutButton />, [makeLine()]);
    await clickCheckout();
    expect(checkoutButton()).toBeDisabled();

    // Firefox/Safari restore the page (and this component's state) intact when
    // the shopper hits Back; without this the cart they came back to would have
    // a checkout button stuck on "heading to checkout…" forever.
    await act(async () => {
      const pageshow = new Event('pageshow');
      Object.defineProperty(pageshow, 'persisted', { value: true });
      window.dispatchEvent(pageshow);
    });

    expect(screen.getByRole('button', { name: /^checkout$/i })).toBeEnabled();
  });

  test('an ordinary pageshow (fresh load) leaves the pending state alone', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(json({ url: 'https://square.link/u/abc' }, 200));

    renderWithCart(<CheckoutButton />, [makeLine()]);
    await clickCheckout();

    await act(async () => {
      window.dispatchEvent(new Event('pageshow'));
    });

    expect(checkoutButton()).toBeDisabled();
  });

  test('a 200 with no url is treated as a fault, not a handoff', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(json({}, 200));

    renderWithCart(<CheckoutButton />, [makeLine()]);
    await clickCheckout();

    expect(assignLocation).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/something looked off/i);
    expect(checkoutButton()).toBeEnabled();
  });
});

describe('CheckoutButton — 409 SOLD_OUT', () => {
  const soldOutBody = { error: 'SOLD_OUT', soldOutIds: ['var-gone'] };

  test('announces the sold-out line and reports the ids to the parent', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(json(soldOutBody, 409));
    const onSoldOutIds = vi.fn();

    renderWithCart(<CheckoutButton onSoldOutIds={onSoldOutIds} />, [makeLine({ variationId: 'var-gone' })]);
    await clickCheckout();

    expect(screen.getByRole('alert')).toHaveTextContent(/just sold out/i);
    expect(onSoldOutIds).toHaveBeenLastCalledWith(['var-gone']);
    expect(assignLocation).not.toHaveBeenCalled();
    // Nothing is removed until the shopper asks for it.
    expect(readCartLines()).toHaveLength(1);
  });

  test('"remove sold-out items" drops every line with a sold-out variation and nothing else', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(json(soldOutBody, 409));
    const onSoldOutIds = vi.fn();

    renderWithCart(<CheckoutButton onSoldOutIds={onSoldOutIds} />, [
      makeLine({ variationId: 'var-gone', name: 'Sold Out Beanie' }),
      makeLine({ variationId: 'var-gone', name: 'Custom: Sold Out Beanie', custom: { color: 'Red', comments: '' } }),
      makeLine({ variationId: 'var-ok', name: 'Flower Clip' }),
    ]);
    await clickCheckout();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /remove sold-out items/i }));
    });

    const lines = readCartLines();
    expect(lines).toHaveLength(1);
    expect(lines[0].name).toBe('Flower Clip');
    // Marks are cleared once the offending lines are gone.
    expect(onSoldOutIds).toHaveBeenLastCalledWith([]);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('a missing soldOutIds list degrades to a plain notice with nothing to remove', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(json({ error: 'SOLD_OUT' }, 409));

    renderWithCart(<CheckoutButton />, [makeLine()]);
    await clickCheckout();

    expect(screen.getByRole('alert')).toHaveTextContent(/just sold out/i);
    expect(screen.queryByRole('button', { name: /remove sold-out items/i })).not.toBeInTheDocument();
    expect(checkoutButton()).toBeEnabled();
  });

  test('starting a new attempt clears the previous sold-out marks', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(json(soldOutBody, 409))
      .mockResolvedValueOnce(json({ url: 'https://square.link/u/abc' }, 200));
    const onSoldOutIds = vi.fn();

    renderWithCart(<CheckoutButton onSoldOutIds={onSoldOutIds} />, [makeLine({ variationId: 'var-gone' })]);
    await clickCheckout();
    expect(onSoldOutIds).toHaveBeenLastCalledWith(['var-gone']);

    await clickCheckout();

    expect(onSoldOutIds).toHaveBeenCalledWith([]);
    expect(assignLocation).toHaveBeenCalledWith('https://square.link/u/abc');
  });
});

describe('CheckoutButton — 409 PRICE_CHANGED', () => {
  const priceChanged = (prices: Record<string, number>) => ({ error: 'PRICE_CHANGED', prices });

  test('re-prices the cart from the server and says so, without reloading', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(json(priceChanged({ 'var-1': 5000 }), 409));

    renderWithCart(<CheckoutButton />, [makeLine({ variationId: 'var-1', unitAmount: 4500 })]);
    await clickCheckout();

    expect(screen.getByRole('alert')).toHaveTextContent(
      /prices changed: the cart's been updated, take a look/i,
    );
    expect(readCartLines()[0].unitAmount).toBe(5000);
    // A reload was the old remedy and it never worked: the stale price lives in
    // localStorage, so the reloaded page restored it and asked again.
    expect(reloadLocation).not.toHaveBeenCalled();
    expect(checkoutButton()).toBeEnabled();
  });

  test('the corrected price survives a reload, because it is persisted', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(json(priceChanged({ 'var-1': 5000 }), 409));

    renderWithCart(<CheckoutButton />, [makeLine({ variationId: 'var-1', unitAmount: 4500 })]);
    await clickCheckout();

    expect(readStoredLines()[0].unitAmount).toBe(5000);
  });

  test('a retry after the re-price gets through', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(json(priceChanged({ 'var-1': 5000 }), 409))
      .mockResolvedValueOnce(json({ url: 'https://square.link/u/abc' }, 200));

    renderWithCart(<CheckoutButton />, [makeLine({ variationId: 'var-1', unitAmount: 4500 })]);
    await clickCheckout();
    await clickCheckout();

    // The second attempt carries the price the server just quoted, which is the
    // whole point — this loop used to be unbreakable.
    const secondBody = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string) as {
      lines: CartLine[];
    };
    expect(secondBody.lines[0].unitAmount).toBe(5000);
    expect(assignLocation).toHaveBeenCalledWith('https://square.link/u/abc');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('re-prices only the variations the server named', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(json(priceChanged({ 'var-1': 5000 }), 409));

    renderWithCart(<CheckoutButton />, [
      makeLine({ variationId: 'var-1', unitAmount: 4500 }),
      makeLine({ variationId: 'var-2', unitAmount: 3000 }),
    ]);
    await clickCheckout();

    expect(readCartLines().map((l) => l.unitAmount)).toEqual([5000, 3000]);
  });

  test('a 409 with no usable prices still explains itself and leaves the cart intact', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      json({ error: 'PRICE_CHANGED', prices: { 'var-1': 'free' } }, 409),
    );

    renderWithCart(<CheckoutButton />, [makeLine({ variationId: 'var-1', unitAmount: 4500 })]);
    await clickCheckout();

    expect(screen.getByRole('alert')).toHaveTextContent(/prices changed/i);
    expect(readCartLines()[0].unitAmount).toBe(4500);
    expect(checkoutButton()).toBeEnabled();
  });
});

describe('CheckoutButton — 503, 400 and network faults', () => {
  test('503 keeps the cart, apologizes warmly, and re-enables the button', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(json({ error: 'SQUARE_UNAVAILABLE' }, 503));

    renderWithCart(<CheckoutButton />, [makeLine()]);
    await clickCheckout();

    expect(screen.getByRole('alert')).toHaveTextContent(/square's having a moment, try again shortly/i);
    expect(readCartLines()).toHaveLength(1);
    expect(checkoutButton()).toBeEnabled();
    expect(assignLocation).not.toHaveBeenCalled();
  });

  test('a retry after a 503 can still succeed', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(json({ error: 'SQUARE_UNAVAILABLE' }, 503))
      .mockResolvedValueOnce(json({ url: 'https://square.link/u/abc' }, 200));

    renderWithCart(<CheckoutButton />, [makeLine()]);
    await clickCheckout();
    await clickCheckout();

    expect(assignLocation).toHaveBeenCalledWith('https://square.link/u/abc');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('400 is a generic "something looked off", cart intact', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(json({ error: 'INVALID_REQUEST' }, 400));

    renderWithCart(<CheckoutButton />, [makeLine()]);
    await clickCheckout();

    expect(screen.getByRole('alert')).toHaveTextContent(/something looked off; please refresh and try again/i);
    expect(readCartLines()).toHaveLength(1);
    expect(checkoutButton()).toBeEnabled();
  });

  test('an unexpected 500 lands in the same generic bucket', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(json({ error: 'BOOM' }, 500));

    renderWithCart(<CheckoutButton />, [makeLine()]);
    await clickCheckout();

    expect(screen.getByRole('alert')).toHaveTextContent(/something looked off/i);
    expect(checkoutButton()).toBeEnabled();
  });

  test('a dropped connection says so and keeps the cart', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));

    renderWithCart(<CheckoutButton />, [makeLine()]);
    await clickCheckout();

    expect(screen.getByRole('alert')).toHaveTextContent(/couldn't reach checkout/i);
    expect(readCartLines()).toHaveLength(1);
    expect(checkoutButton()).toBeEnabled();
  });

  test('an unreadable error body still fails softly', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('not json', { status: 409 }));

    renderWithCart(<CheckoutButton />, [makeLine()]);
    await clickCheckout();

    expect(screen.getByRole('alert')).toHaveTextContent(/something looked off/i);
    expect(checkoutButton()).toBeEnabled();
  });
});
