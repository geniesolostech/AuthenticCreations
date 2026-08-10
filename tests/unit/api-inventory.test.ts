// @vitest-environment node
/**
 * Route-handler tests for `GET /api/inventory`.
 *
 * The handler is invoked directly with a `Request`; there is no HTTP server and
 * no Square SDK in play — the module-level gateway is swapped for a fake via the
 * route's `_setGatewayForTests` seam. Node environment, because jsdom does not
 * provide the `Request`/`Response` fetch primitives these handlers are built on.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SquareGatewayError } from '@/lib/square/errors';
import { FakeGateway } from '@/tests/mocks/fake-square-gateway';
import { GET, _resetGatewayForTests, _setGatewayForTests } from '@/app/api/inventory/route';

function get(query: string): Request {
  return new Request(`https://authentic-creations.test/api/inventory${query}`);
}

let gw: FakeGateway;

beforeEach(() => {
  gw = new FakeGateway().withCount('var-a', 3).withCount('var-b', 0);
  _setGatewayForTests(gw);
  // The route logs failures server-side; keep the test output readable.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  _resetGatewayForTests();
  vi.restoreAllMocks();
});

describe('GET /api/inventory', () => {
  it('returns 200 with counts for the requested ids', async () => {
    const response = await GET(get('?ids=var-a,var-b'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ counts: { 'var-a': 3, 'var-b': 0 } });
    expect(gw.calls.getInventoryCounts).toEqual([['var-a', 'var-b']]);
  });

  it('omits untracked and unknown ids from the counts map', async () => {
    const response = await GET(get('?ids=var-a,var-untracked'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ counts: { 'var-a': 3 } });
  });

  it('accepts exactly 50 ids', async () => {
    const ids = Array.from({ length: 50 }, (_, i) => `id-${i}`);
    gw.withCount('id-0', 7);

    const response = await GET(get(`?ids=${ids.join(',')}`));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ counts: { 'id-0': 7 } });
  });

  it('rejects 51 ids with 400 and never calls Square', async () => {
    const ids = Array.from({ length: 51 }, (_, i) => `id-${i}`);

    const response = await GET(get(`?ids=${ids.join(',')}`));

    expect(response.status).toBe(400);
    expect(gw.calls.getInventoryCounts).toHaveLength(0);
  });

  it('rejects an absent ids param with 400', async () => {
    const response = await GET(get(''));

    expect(response.status).toBe(400);
    expect(gw.calls.getInventoryCounts).toHaveLength(0);
  });

  it('rejects an empty ids param with 400', async () => {
    const response = await GET(get('?ids='));

    expect(response.status).toBe(400);
    expect(gw.calls.getInventoryCounts).toHaveLength(0);
  });

  it('rejects an ids param of separators and whitespace with 400', async () => {
    const response = await GET(get('?ids=%20,%20,'));

    expect(response.status).toBe(400);
    expect(gw.calls.getInventoryCounts).toHaveLength(0);
  });

  it('trims whitespace around ids', async () => {
    const response = await GET(get('?ids=%20var-a%20,%20var-b'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ counts: { 'var-a': 3, 'var-b': 0 } });
    expect(gw.calls.getInventoryCounts).toEqual([['var-a', 'var-b']]);
  });

  it('maps a gateway failure to 503 SQUARE_UNAVAILABLE', async () => {
    gw.failOn.getInventoryCounts = new SquareGatewayError(
      'Square inventory.batchGetCounts failed for token sq0atp-SECRET',
    );

    const response = await GET(get('?ids=var-a'));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: 'SQUARE_UNAVAILABLE' });
  });

  it('leaks nothing internal in the 503 body', async () => {
    gw.failOn.getInventoryCounts = new SquareGatewayError(
      'Square inventory.batchGetCounts failed for token sq0atp-SECRET',
    );

    const body = await (await GET(get('?ids=var-a'))).text();

    expect(body).not.toMatch(/sq0atp|batchGetCounts|SquareGatewayError|stack/i);
    expect(Object.keys(JSON.parse(body) as object)).toEqual(['error']);
  });

  it('leaks nothing internal in the 400 body', async () => {
    const body = await (await GET(get(''))).text();

    expect(body).not.toMatch(/zod|expected|received|invalid_type|stack/i);
  });

  it('marks counts as uncacheable so no CDN can serve stale stock', async () => {
    const response = await GET(get('?ids=var-a'));

    expect(response.headers.get('cache-control')).toMatch(/no-store/);
  });

  it('serves a second identical request from the module-level cache', async () => {
    await GET(get('?ids=var-a'));
    const response = await GET(get('?ids=var-a'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ counts: { 'var-a': 3 } });
    expect(gw.calls.getInventoryCounts).toHaveLength(1);
  });
});
