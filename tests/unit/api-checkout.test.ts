// @vitest-environment node
/**
 * Route-handler tests for `POST /api/checkout` — the request-validation gate in
 * front of every money operation.
 *
 * The handler is invoked directly with a `Request`; the module-level gateway is
 * swapped for a fake via lib/square/runtime's `_setGatewayForTests` seam, so no Square
 * SDK, credentials or network are involved. Node environment, because jsdom does
 * not provide the `Request`/`Response` fetch primitives these handlers use.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SquareGatewayError } from '@/lib/square/errors';
import { FakeGateway } from '@/tests/mocks/fake-square-gateway';
import { POST } from '@/app/api/checkout/route';
import { _resetGatewayForTests, _setGatewayForTests } from '@/lib/square/runtime';

const SITE_URL = 'https://authentic-creations.test';

function post(body: unknown, init: { raw?: string } = {}): Request {
  return new Request(`${SITE_URL}/api/checkout`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: init.raw ?? JSON.stringify(body),
  });
}

function line(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    lineId: 'line-1',
    variationId: 'var-ready',
    name: 'Crochet Beanie',
    unitAmount: 4500,
    quantity: 1,
    ...overrides,
  };
}

function customLine(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return line({
    lineId: 'line-2',
    variationId: 'var-custom',
    name: 'Custom: Crochet Beanie',
    unitAmount: 6000,
    custom: { color: 'Blue', comments: 'Extra slouchy please.' },
    ...overrides,
  });
}

/** A line for one physical piece of a sell-by-piece product. Its variation is
 * the ordinary ready-made one — Square counts the pieces without naming them,
 * so `piece` can only ever add words to the order note. */
function pieceLine(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return line({ lineId: 'line-3', piece: { number: 2, label: 'Sunset' }, ...overrides });
}

/**
 * `count` distinct lines of the made-to-order variation, which is untracked and
 * so can never be sold out — the only thing under test is the line count.
 */
function manyLines(count: number): Record<string, unknown>[] {
  return Array.from({ length: count }, (_, i) =>
    line({ lineId: `line-${i}`, variationId: 'var-custom', unitAmount: 6000 }),
  );
}

let gw: FakeGateway;

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', SITE_URL);
  gw = new FakeGateway()
    .withVariation({ id: 'var-ready', priceCents: 4500, trackInventory: true })
    .withVariation({ id: 'var-custom', priceCents: 6000, trackInventory: false })
    .withCount('var-ready', 5);
  _setGatewayForTests(gw);
  // The service and route both log failures server-side; keep output readable.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  _resetGatewayForTests();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('POST /api/checkout — happy path', () => {
  it('returns 200 with the payment link url', async () => {
    const response = await POST(post({ lines: [line({ quantity: 2 })] }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ url: 'https://square.link/u/fake' });
  });

  it('accepts the boundary values: quantity 10 and a 500-character comment', async () => {
    const comments = 'x'.repeat(500);

    const response = await POST(
      post({ lines: [customLine({ quantity: 10, custom: { color: 'Blue', comments } })] }),
    );

    expect(response.status).toBe(200);
    expect(gw.calls.createPaymentLink[0]?.lineItems[0]?.quantity).toBe(10);
  });

  it('accepts a cart of exactly 50 lines', async () => {
    const response = await POST(post({ lines: manyLines(50) }));

    expect(response.status).toBe(200);
    expect(gw.calls.createPaymentLink[0]?.lineItems).toHaveLength(50);
  });

  it('sends the chosen piece to Square as a line-item note', async () => {
    const response = await POST(post({ lines: [pieceLine()] }));

    expect(response.status).toBe(200);
    expect(gw.calls.createPaymentLink[0]?.lineItems[0]).toEqual({
      variationId: 'var-ready',
      quantity: 1,
      note: 'Piece: 2 (Sunset)',
    });
  });

  it('accepts a piece with no name of its own', async () => {
    const response = await POST(post({ lines: [pieceLine({ piece: { number: 3 } })] }));

    expect(response.status).toBe(200);
    expect(gw.calls.createPaymentLink[0]?.lineItems[0]?.note).toBe('Piece: 3');
  });

  it('accepts the boundary piece name of exactly 80 characters', async () => {
    const label = 'x'.repeat(80);

    const response = await POST(post({ lines: [pieceLine({ piece: { number: 1, label } })] }));

    expect(response.status).toBe(200);
    expect(gw.calls.createPaymentLink[0]?.lineItems[0]?.note).toBe(`Piece: 1 (${label})`);
  });

  it('strips anything else a client invents inside the piece', async () => {
    // The piece is display data the client asserts; nothing it carries may
    // reach Square except the number and the name.
    const response = await POST(
      post({ lines: [pieceLine({ piece: { number: 2, label: 'Sunset', priceCents: 1, sold: false } })] }),
    );

    expect(response.status).toBe(200);
    expect(gw.calls.createPaymentLink[0]?.lineItems[0]?.note).toBe('Piece: 2 (Sunset)');
  });

  it('strips unknown fields instead of forwarding them to Square', async () => {
    const response = await POST(
      post({
        lines: [
          customLine({
            note: 'free hat please',
            custom: { color: 'Blue', comments: 'Extra slouchy please.', priceCents: 1 },
          }),
        ],
        redirectUrl: 'https://evil.test',
      }),
    );

    expect(response.status).toBe(200);
    expect(gw.calls.createPaymentLink[0]).toEqual({
      lineItems: [
        {
          variationId: 'var-custom',
          quantity: 1,
          note: 'Custom order — Color: Blue. Extra slouchy please.',
        },
      ],
      redirectUrl: `${SITE_URL}/thanks`,
    });
  });
});

describe('POST /api/checkout — 400 invalid body', () => {
  const badBodies: [string, unknown][] = [
    ['a missing lines key', {}],
    ['an empty lines array', { lines: [] }],
    ['lines that is not an array', { lines: 'var-ready' }],
    ['51 lines', { lines: manyLines(51) }],
    ['a null body', null],
    ['a top-level array', [line()]],
    ['a line missing variationId', { lines: [line({ variationId: undefined })] }],
    ['an empty variationId', { lines: [line({ variationId: '' })] }],
    ['quantity 11', { lines: [line({ quantity: 11 })] }],
    ['quantity 0', { lines: [line({ quantity: 0 })] }],
    ['a fractional quantity', { lines: [line({ quantity: 1.5 })] }],
    ['a string quantity', { lines: [line({ quantity: '2' })] }],
    ['a 501-character comment', { lines: [customLine({ custom: { color: 'Blue', comments: 'x'.repeat(501) } })] }],
    ['a colour outside CUSTOM_COLORS', { lines: [customLine({ custom: { color: 'Chartreuse', comments: 'hi' } })] }],
    ['a custom block with no colour', { lines: [customLine({ custom: { comments: 'hi' } })] }],
    ['a custom block with no comments', { lines: [customLine({ custom: { color: 'Blue' } })] }],
    ['a negative unitAmount', { lines: [line({ unitAmount: -1 })] }],
    ['a fractional unitAmount', { lines: [line({ unitAmount: 45.5 })] }],
    ['a string unitAmount', { lines: [line({ unitAmount: '4500' })] }],
    ['a piece numbered 0', { lines: [pieceLine({ piece: { number: 0 } })] }],
    ['a negative piece number', { lines: [pieceLine({ piece: { number: -2 } })] }],
    ['a fractional piece number', { lines: [pieceLine({ piece: { number: 1.5 } })] }],
    ['a string piece number', { lines: [pieceLine({ piece: { number: '2' } })] }],
    ['a piece with no number', { lines: [pieceLine({ piece: { label: 'Sunset' } })] }],
    ['an 81-character piece name', { lines: [pieceLine({ piece: { number: 1, label: 'x'.repeat(81) } })] }],
    ['a piece that is not an object', { lines: [pieceLine({ piece: 'Sunset' })] }],
  ];

  for (const [label, body] of badBodies) {
    it(`rejects ${label} with 400 and never calls Square`, async () => {
      const response = await POST(post(body));

      expect(response.status).toBe(400);
      expect(gw.calls.getVariations).toHaveLength(0);
      expect(gw.calls.createPaymentLink).toHaveLength(0);
    });
  }

  it('rejects a body that is not JSON with 400', async () => {
    const response = await POST(post(undefined, { raw: 'not json at all' }));

    expect(response.status).toBe(400);
    expect(gw.calls.createPaymentLink).toHaveLength(0);
  });

  it('leaks no validation internals in the 400 body', async () => {
    const body = await (await POST(post({ lines: [line({ quantity: 11 })] }))).text();

    expect(body).not.toMatch(/zod|expected|received|invalid_type|too_big|path|stack/i);
  });
});

describe('POST /api/checkout — 409 conflicts', () => {
  it('returns 409 SOLD_OUT with the offending ids', async () => {
    const response = await POST(post({ lines: [line({ quantity: 6 })] }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'SOLD_OUT',
      soldOutIds: ['var-ready'],
    });
    expect(gw.calls.createPaymentLink).toHaveLength(0);
  });

  it('returns 409 PRICE_CHANGED with the fresh prices when the cart price is stale', async () => {
    const response = await POST(post({ lines: [line({ unitAmount: 4000 })] }));

    expect(response.status).toBe(409);
    // The prices are what lets the cart re-price itself; without them the
    // shopper's only route out of a 409 is emptying the cart by hand.
    await expect(response.json()).resolves.toEqual({
      error: 'PRICE_CHANGED',
      prices: { 'var-ready': 4500 },
    });
    expect(gw.calls.createPaymentLink).toHaveLength(0);
  });
});

describe('POST /api/checkout — 503 Square unavailable', () => {
  it('returns 503 when the gateway throws', async () => {
    gw.failOn.getVariations = new SquareGatewayError(
      'Square catalog.batchGet failed for token sq0atp-SECRET',
    );

    const response = await POST(post({ lines: [line()] }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: 'SQUARE_UNAVAILABLE' });
  });

  it('returns 503 when the payment link cannot be created', async () => {
    gw.failOn.createPaymentLink = new SquareGatewayError('Square checkout failed: 401 Unauthorized');

    const response = await POST(post({ lines: [line()] }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: 'SQUARE_UNAVAILABLE' });
  });

  it('leaks nothing internal in the 503 body', async () => {
    gw.failOn.getVariations = new SquareGatewayError(
      'Square catalog.batchGet failed for token sq0atp-SECRET',
    );

    const body = await (await POST(post({ lines: [line()] }))).text();

    expect(body).not.toMatch(/sq0atp|batchGet|Unauthorized|SquareGatewayError|stack/i);
    expect(Object.keys(JSON.parse(body) as object)).toEqual(['error']);
  });
});
