// @vitest-environment node
/**
 * Route-handler tests for `POST /api/rsvp` — the one place in the app that
 * writes to Sanity.
 *
 * The handler is called directly with a `Request`; the Sanity *client module* is
 * mocked — not the query helpers — so this exercises the real dep-wiring
 * (including which client each read goes through and the exact rsvp document
 * shape) without a network or a token. Node environment, because jsdom has no
 * `Request`/`Response`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sanity = vi.hoisted(() => {
  /** Reads made through the non-CDN client the route is supposed to build. */
  const freshFetch = vi.fn();
  /** Reads made straight through the CDN client — always a bug in this route. */
  const cdnFetch = vi.fn();
  /**
   * Every config the route asked `withConfig` for, kept outside the mock's own
   * call history: `withConfig` runs once at module load, and `clearAllMocks`
   * between tests would otherwise erase the only evidence of it.
   */
  const configs: unknown[] = [];
  const withConfig = vi.fn((config: unknown) => {
    configs.push(config);
    return { fetch: freshFetch };
  });
  return { freshFetch, cdnFetch, withConfig, configs, create: vi.fn() };
});

vi.mock('@/lib/sanity/client', () => ({
  sanityClient: { fetch: sanity.cdnFetch, withConfig: sanity.withConfig },
  sanityWriteClient: { create: sanity.create },
}));

import { POST, _resetRateLimitForTests } from '@/app/api/rsvp/route';
import { RSVP_RATE_LIMIT } from '@/lib/rate-limit';
import { EVENT_BY_SLUG_QUERY, FIND_RSVP_QUERY, RSVP_COUNT_QUERY } from '@/lib/sanity/queries';

/**
 * The three logical reads, behind the one `fetch` the route actually calls.
 * Routing by query string keeps each test able to say "the event lookup
 * answers X" without caring how the route spells the request.
 */
const getEvent = vi.fn();
const countRsvps = vi.fn();
const findExisting = vi.fn();
const createDoc = sanity.create;

const SITE_URL = 'https://authentic-creations.test';

const UPCOMING_EVENT = {
  _id: 'event-1',
  title: 'August Crochet Circle',
  slug: 'august-circle',
  startsAt: '2099-08-20T23:00:00.000Z',
};

const VALID_BODY = {
  eventSlug: 'august-circle',
  name: 'Marisol Vega',
  email: 'marisol@example.com',
};

function post(body: unknown, init: { raw?: string; ip?: string } = {}): Request {
  return new Request(`${SITE_URL}/api/rsvp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(init.ip === undefined ? {} : { 'x-forwarded-for': init.ip }),
    },
    body: init.raw ?? JSON.stringify(body),
  });
}

beforeEach(() => {
  // The limiter's counters are module-level and outlive a single test, so
  // without this the sixth POST in this file would start answering 429.
  _resetRateLimitForTests();

  getEvent.mockResolvedValue(UPCOMING_EVENT);
  countRsvps.mockResolvedValue(0);
  findExisting.mockResolvedValue(null);
  createDoc.mockResolvedValue({ _id: 'rsvp-1' });

  sanity.freshFetch.mockImplementation((query: string, params: Record<string, string>) => {
    if (query === EVENT_BY_SLUG_QUERY) return getEvent(params.slug);
    if (query === RSVP_COUNT_QUERY) return countRsvps(params.eventId);
    if (query === FIND_RSVP_QUERY) return findExisting(params.eventId, params.email);
    throw new Error(`unexpected query: ${query}`);
  });

  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('POST /api/rsvp — 201 CREATED', () => {
  it('saves the seat and answers 201', async () => {
    const response = await POST(post(VALID_BODY));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ result: 'CREATED' });
  });

  it('writes exactly the rsvp document the Task 3 schema declares', async () => {
    const before = Date.now();
    await POST(post(VALID_BODY));
    const after = Date.now();

    expect(createDoc).toHaveBeenCalledTimes(1);
    const doc = createDoc.mock.calls[0][0] as Record<string, unknown>;

    expect(Object.keys(doc).sort()).toEqual(['_type', 'createdAt', 'email', 'event', 'name']);
    expect(doc._type).toBe('rsvp');
    expect(doc.event).toEqual({ _type: 'reference', _ref: 'event-1' });
    expect(doc.name).toBe('Marisol Vega');
    expect(doc.email).toBe('marisol@example.com');

    const createdAt = Date.parse(doc.createdAt as string);
    expect(createdAt).toBeGreaterThanOrEqual(before);
    expect(createdAt).toBeLessThanOrEqual(after);
    expect(doc.createdAt).toBe(new Date(createdAt).toISOString());
  });

  it('looks the event up by the posted slug and the duplicate by trimmed email', async () => {
    await POST(post({ ...VALID_BODY, name: '  Marisol Vega ', email: ' marisol@example.com ' }));

    expect(getEvent).toHaveBeenCalledWith('august-circle');
    expect(findExisting).toHaveBeenCalledWith('event-1', 'marisol@example.com');
    expect(createDoc).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Marisol Vega', email: 'marisol@example.com' }),
    );
  });

  it('strips unknown keys instead of forwarding them into the document', async () => {
    await POST(post({ ...VALID_BODY, _type: 'product', _id: 'hijack', capacity: 999 }));

    const doc = createDoc.mock.calls[0][0] as Record<string, unknown>;
    expect(doc._type).toBe('rsvp');
    expect(doc).not.toHaveProperty('_id');
    expect(doc).not.toHaveProperty('capacity');
  });
});

describe('POST /api/rsvp — reads must see this endpoint’s own writes', () => {
  it('builds its reads on a non-CDN client', () => {
    // The write client is `useCdn: false`; a CDN-backed read here would let an
    // edge that has not caught up report a fresh RSVP as missing and a full
    // circle as roomy.
    expect(sanity.configs).toContainEqual({ useCdn: false });
  });

  it('never reads through the CDN client itself', async () => {
    await POST(post({ ...VALID_BODY, eventSlug: 'august-circle' }));

    expect(sanity.cdnFetch).not.toHaveBeenCalled();
    expect(sanity.freshFetch).toHaveBeenCalled();
  });

  it('routes all three reads — event, duplicate, count — through that client', async () => {
    getEvent.mockResolvedValue({ ...UPCOMING_EVENT, capacity: 8 });

    await POST(post(VALID_BODY));

    const queries = sanity.freshFetch.mock.calls.map(([query]) => query);
    expect(queries).toEqual([EVENT_BY_SLUG_QUERY, FIND_RSVP_QUERY, RSVP_COUNT_QUERY]);
    expect(sanity.cdnFetch).not.toHaveBeenCalled();
  });

  it('treats an undefined duplicate lookup as a miss, not as "already signed up"', async () => {
    // A strict `!== null` here would turn every RSVP into a permanent 409.
    findExisting.mockResolvedValue(undefined);

    const response = await POST(post(VALID_BODY));

    expect(response.status).toBe(201);
    expect(createDoc).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/rsvp — status mapping', () => {
  it('409 DUPLICATE when this email already has a seat', async () => {
    findExisting.mockResolvedValue({
      _id: 'rsvp-0',
      event: { _ref: 'event-1' },
      name: 'Marisol Vega',
      email: 'MARISOL@example.com',
      createdAt: '2026-08-01T00:00:00.000Z',
    });

    const response = await POST(post(VALID_BODY));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: 'DUPLICATE' });
    expect(createDoc).not.toHaveBeenCalled();
  });

  it('403 FULL when the circle is at capacity', async () => {
    getEvent.mockResolvedValue({ ...UPCOMING_EVENT, capacity: 8 });
    countRsvps.mockResolvedValue(8);

    const response = await POST(post(VALID_BODY));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'FULL' });
    expect(createDoc).not.toHaveBeenCalled();
  });

  it('410 PAST when the circle has already met', async () => {
    getEvent.mockResolvedValue({ ...UPCOMING_EVENT, startsAt: '2020-01-01T00:00:00.000Z' });

    const response = await POST(post(VALID_BODY));

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toEqual({ error: 'PAST' });
    expect(createDoc).not.toHaveBeenCalled();
  });

  it('404 NOT_FOUND for a slug that is not a circle', async () => {
    getEvent.mockResolvedValue(null);

    const response = await POST(post({ ...VALID_BODY, eventSlug: 'nope' }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'NOT_FOUND' });
    expect(createDoc).not.toHaveBeenCalled();
  });

  it('400 INVALID for a malformed email', async () => {
    const response = await POST(post({ ...VALID_BODY, email: 'not-an-email' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'INVALID' });
    expect(getEvent).not.toHaveBeenCalled();
    expect(createDoc).not.toHaveBeenCalled();
  });

  it('a past circle that is also full answers PAST — check order holds over HTTP', async () => {
    getEvent.mockResolvedValue({
      ...UPCOMING_EVENT,
      startsAt: '2020-01-01T00:00:00.000Z',
      capacity: 1,
    });
    countRsvps.mockResolvedValue(1);

    const response = await POST(post(VALID_BODY));

    expect(response.status).toBe(410);
  });
});

describe('POST /api/rsvp — 400 bad bodies', () => {
  const badBodies: [string, unknown][] = [
    ['a missing eventSlug', { name: 'Marisol', email: 'a@b.co' }],
    ['an empty eventSlug', { eventSlug: '', name: 'Marisol', email: 'a@b.co' }],
    ['a missing name', { eventSlug: 'august-circle', email: 'a@b.co' }],
    ['a blank name', { eventSlug: 'august-circle', name: '   ', email: 'a@b.co' }],
    ['a 101-character name', { eventSlug: 'august-circle', name: 'x'.repeat(101), email: 'a@b.co' }],
    ['a missing email', { eventSlug: 'august-circle', name: 'Marisol' }],
    ['a numeric name', { eventSlug: 'august-circle', name: 42, email: 'a@b.co' }],
    ['a null body', null],
    ['an array body', [VALID_BODY]],
    ['an absurdly long name', { eventSlug: 'august-circle', name: 'x'.repeat(5000), email: 'a@b.co' }],
  ];

  for (const [label, body] of badBodies) {
    it(`rejects ${label} with 400 and writes nothing`, async () => {
      const response = await POST(post(body));

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: 'INVALID' });
      expect(createDoc).not.toHaveBeenCalled();
    });
  }

  it('rejects a body that is not JSON with 400', async () => {
    const response = await POST(post(undefined, { raw: 'not json at all' }));

    expect(response.status).toBe(400);
    expect(createDoc).not.toHaveBeenCalled();
  });

  it('leaks no validation internals in the 400 body', async () => {
    const body = await (await POST(post({ eventSlug: 'x', name: 42, email: 'a@b.co' }))).text();

    expect(body).not.toMatch(/zod|expected|received|invalid_type|too_big|path|stack/i);
  });
});

describe('POST /api/rsvp — 503 when Sanity is unreachable', () => {
  it('503 TRY_AGAIN when the event lookup throws', async () => {
    getEvent.mockRejectedValue(new Error('getaddrinfo ENOTFOUND api.sanity.io'));

    const response = await POST(post(VALID_BODY));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: 'TRY_AGAIN' });
  });

  it('503 TRY_AGAIN when the write itself throws', async () => {
    createDoc.mockRejectedValue(new Error('Unauthorized - Session token sk-SECRET is invalid'));

    const response = await POST(post(VALID_BODY));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: 'TRY_AGAIN' });
  });

  it('503 TRY_AGAIN when the duplicate lookup throws', async () => {
    findExisting.mockRejectedValue(new Error('boom'));

    const response = await POST(post(VALID_BODY));

    expect(response.status).toBe(503);
  });

  it('leaks nothing internal in the 503 body', async () => {
    createDoc.mockRejectedValue(new Error('Unauthorized - Session token sk-SECRET is invalid'));

    const body = await (await POST(post(VALID_BODY))).text();

    // (`error` itself is our own response key, so it is not in this list.)
    expect(body).not.toMatch(/sk-SECRET|Unauthorized|token|sanity|stack|message/i);
    expect(Object.keys(JSON.parse(body) as object)).toEqual(['error']);
  });
});

describe('POST /api/rsvp — rate limiting', () => {
  const IP = '203.0.113.7';

  it(`allows ${RSVP_RATE_LIMIT} posts from one caller, then answers 429`, async () => {
    for (let i = 0; i < RSVP_RATE_LIMIT; i++) {
      // Each one a distinct email so nothing else can be what turns them away.
      const response = await POST(post({ ...VALID_BODY, email: `guest${i}@example.com` }, { ip: IP }));
      expect(response.status).toBe(201);
    }

    const throttled = await POST(post(VALID_BODY, { ip: IP }));

    expect(throttled.status).toBe(429);
    await expect(throttled.json()).resolves.toEqual({ error: 'TRY_AGAIN_LATER' });
    expect(throttled.headers.get('cache-control')).toBe('no-store');
  });

  it('does not touch Sanity for a throttled request', async () => {
    for (let i = 0; i < RSVP_RATE_LIMIT; i++) {
      await POST(post({ ...VALID_BODY, email: `guest${i}@example.com` }, { ip: IP }));
    }
    vi.clearAllMocks();

    await POST(post(VALID_BODY, { ip: IP }));

    // A refusal that still costs a read (or a document) is not a throttle.
    expect(sanity.freshFetch).not.toHaveBeenCalled();
    expect(createDoc).not.toHaveBeenCalled();
  });

  it('counts each caller separately', async () => {
    for (let i = 0; i < RSVP_RATE_LIMIT; i++) {
      await POST(post({ ...VALID_BODY, email: `guest${i}@example.com` }, { ip: IP }));
    }
    expect((await POST(post(VALID_BODY, { ip: IP }))).status).toBe(429);

    // One noisy visitor must not close the circle to everyone else.
    const other = await POST(post(VALID_BODY, { ip: '198.51.100.4' }));

    expect(other.status).toBe(201);
  });

  it('attributes the caller to the first hop of x-forwarded-for', async () => {
    // Behind CloudFront every request carries the edge's address as a later
    // hop; keying on that would put the whole internet in one bucket.
    for (let i = 0; i < RSVP_RATE_LIMIT; i++) {
      await POST(
        post({ ...VALID_BODY, email: `guest${i}@example.com` }, { ip: `${IP}, 70.132.0.${i}` }),
      );
    }

    const throttled = await POST(post(VALID_BODY, { ip: `${IP}, 70.132.0.99` }));

    expect(throttled.status).toBe(429);
  });

  it('leaks nothing but the code in a throttled body', async () => {
    for (let i = 0; i < RSVP_RATE_LIMIT; i++) {
      await POST(post({ ...VALID_BODY, email: `guest${i}@example.com` }, { ip: IP }));
    }

    const body = await (await POST(post(VALID_BODY, { ip: IP }))).text();

    expect(Object.keys(JSON.parse(body) as object)).toEqual(['error']);
  });
});

describe('POST /api/rsvp — caching', () => {
  it('tells every cache not to store the answer, on success and on failure', async () => {
    const created = await POST(post(VALID_BODY));
    expect(created.headers.get('cache-control')).toBe('no-store');

    getEvent.mockResolvedValue(null);
    const missing = await POST(post(VALID_BODY));
    expect(missing.headers.get('cache-control')).toBe('no-store');
  });

  it('is declared force-dynamic so Next never treats it as static', async () => {
    const route = await import('@/app/api/rsvp/route');
    expect(route.dynamic).toBe('force-dynamic');
  });
});
