// @vitest-environment node
/**
 * Route-handler tests for `POST /api/rsvp` — the one place in the app that
 * writes to Sanity.
 *
 * The handler is called directly with a `Request`; the Sanity query helpers and
 * the write client are module-mocked, so this exercises the real dep-wiring
 * (including the exact rsvp document shape) without a network or a token. Node
 * environment, because jsdom has no `Request`/`Response`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/sanity/queries', () => ({
  getEventBySlug: vi.fn(),
  getRsvpCount: vi.fn(),
  findRsvp: vi.fn(),
}));

vi.mock('@/lib/sanity/client', () => ({
  sanityWriteClient: { create: vi.fn() },
}));

import { POST } from '@/app/api/rsvp/route';
import { sanityWriteClient } from '@/lib/sanity/client';
import { findRsvp, getEventBySlug, getRsvpCount } from '@/lib/sanity/queries';

const getEvent = vi.mocked(getEventBySlug);
const countRsvps = vi.mocked(getRsvpCount);
const findExisting = vi.mocked(findRsvp);
const createDoc = vi.mocked(sanityWriteClient.create);

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

function post(body: unknown, init: { raw?: string } = {}): Request {
  return new Request(`${SITE_URL}/api/rsvp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: init.raw ?? JSON.stringify(body),
  });
}

beforeEach(() => {
  getEvent.mockResolvedValue(UPCOMING_EVENT);
  countRsvps.mockResolvedValue(0);
  findExisting.mockResolvedValue(null);
  createDoc.mockResolvedValue({ _id: 'rsvp-1' } as never);
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
