/**
 * `submitRsvp` — the whole RSVP rule set, with every I/O dependency injected.
 *
 * No Sanity, no HTTP, no clock: the fakes below stand in for the four queries
 * and the one write the route wires up for real. That keeps the interesting
 * parts — validation, the order the checks run in, and the capacity boundary —
 * testable as plain functions.
 */
import { describe, expect, test, vi } from 'vitest';

import { submitRsvp, type RsvpDeps, type RsvpEvent } from '@/lib/rsvp-service';

const NOW = new Date('2026-08-09T18:00:00.000Z');

const UPCOMING: RsvpEvent = {
  _id: 'event-1',
  startsAt: '2026-08-20T23:00:00.000Z',
};

interface FakeOptions {
  event?: RsvpEvent | null;
  count?: number;
  /** Emails already signed up — matched case-insensitively, as the GROQ does. */
  signedUp?: string[];
  now?: Date;
}

function makeDeps(options: FakeOptions = {}) {
  const { event = UPCOMING, count = 0, signedUp = [], now = NOW } = options;

  const deps: RsvpDeps = {
    getEvent: vi.fn(async () => event),
    countRsvps: vi.fn(async () => count),
    // Mirrors FIND_RSVP_QUERY's `lower(email) == lower($email)`.
    emailExists: vi.fn(async (_eventId: string, email: string) =>
      signedUp.some((existing) => existing.toLowerCase() === email.toLowerCase()),
    ),
    create: vi.fn(async () => {}),
    now: vi.fn(() => now),
  };

  return deps as RsvpDeps & {
    getEvent: ReturnType<typeof vi.fn>;
    countRsvps: ReturnType<typeof vi.fn>;
    emailExists: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    now: ReturnType<typeof vi.fn>;
  };
}

const VALID = { eventSlug: 'august-circle', name: 'Marisol Vega', email: 'marisol@example.com' };

describe('submitRsvp — CREATED', () => {
  test('signs a person up for an upcoming circle', async () => {
    const deps = makeDeps();

    await expect(submitRsvp(VALID, deps)).resolves.toBe('CREATED');

    expect(deps.getEvent).toHaveBeenCalledWith('august-circle');
    expect(deps.create).toHaveBeenCalledWith({
      eventId: 'event-1',
      name: 'Marisol Vega',
      email: 'marisol@example.com',
    });
  });

  test('stores the trimmed name and email, not the raw keystrokes', async () => {
    const deps = makeDeps();

    await expect(
      submitRsvp({ ...VALID, name: '  Marisol Vega \n', email: '  marisol@example.com  ' }, deps),
    ).resolves.toBe('CREATED');

    expect(deps.create).toHaveBeenCalledWith({
      eventId: 'event-1',
      name: 'Marisol Vega',
      email: 'marisol@example.com',
    });
    // The duplicate lookup sees the same trimmed value the write will store.
    expect(deps.emailExists).toHaveBeenCalledWith('event-1', 'marisol@example.com');
  });

  test('keeps the email as typed — case is the sender’s business, matching is the query’s', async () => {
    const deps = makeDeps();

    await submitRsvp({ ...VALID, email: 'Marisol.Vega@Example.com' }, deps);

    expect(deps.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'Marisol.Vega@Example.com' }),
    );
  });

  test('a circle with no capacity is never counted — unlimited means unlimited', async () => {
    const deps = makeDeps({ event: { _id: 'event-1', startsAt: UPCOMING.startsAt } });

    await expect(submitRsvp(VALID, deps)).resolves.toBe('CREATED');

    expect(deps.countRsvps).not.toHaveBeenCalled();
    expect(deps.create).toHaveBeenCalledTimes(1);
  });

  test('reads the clock from deps, not the ambient one', async () => {
    const deps = makeDeps({
      event: { ...UPCOMING, startsAt: '2026-08-09T18:00:01.000Z' },
      now: new Date('2026-08-09T18:00:00.000Z'),
    });

    await expect(submitRsvp(VALID, deps)).resolves.toBe('CREATED');
    expect(deps.now).toHaveBeenCalled();
  });
});

describe('submitRsvp — NOT_FOUND', () => {
  test('returns NOT_FOUND for a slug Sanity does not know', async () => {
    const deps = makeDeps({ event: null });

    await expect(submitRsvp({ ...VALID, eventSlug: 'no-such-circle' }, deps)).resolves.toBe(
      'NOT_FOUND',
    );

    expect(deps.emailExists).not.toHaveBeenCalled();
    expect(deps.countRsvps).not.toHaveBeenCalled();
    expect(deps.create).not.toHaveBeenCalled();
  });
});

describe('submitRsvp — PAST', () => {
  test('a circle that already started cannot be joined', async () => {
    const deps = makeDeps({ event: { ...UPCOMING, startsAt: '2026-08-01T23:00:00.000Z' } });

    await expect(submitRsvp(VALID, deps)).resolves.toBe('PAST');
    expect(deps.create).not.toHaveBeenCalled();
  });

  test('startsAt exactly at "now" is still open — same boundary UPCOMING_EVENTS_QUERY uses', async () => {
    const deps = makeDeps({ event: { ...UPCOMING, startsAt: NOW.toISOString() } });

    await expect(submitRsvp(VALID, deps)).resolves.toBe('CREATED');
  });

  test('one millisecond before now is past', async () => {
    const deps = makeDeps({ event: { ...UPCOMING, startsAt: '2026-08-09T17:59:59.999Z' } });

    await expect(submitRsvp(VALID, deps)).resolves.toBe('PAST');
  });

  test('a startsAt that cannot be parsed is treated as past, never as an open seat', async () => {
    const deps = makeDeps({ event: { ...UPCOMING, startsAt: 'sometime soon' } });

    await expect(submitRsvp(VALID, deps)).resolves.toBe('PAST');
    expect(deps.create).not.toHaveBeenCalled();
  });
});

describe('submitRsvp — DUPLICATE', () => {
  test('the same email twice is a friendly no-op, not a second seat', async () => {
    const deps = makeDeps({ signedUp: ['marisol@example.com'] });

    await expect(submitRsvp(VALID, deps)).resolves.toBe('DUPLICATE');
    expect(deps.create).not.toHaveBeenCalled();
  });

  test('duplicate matching ignores case', async () => {
    const deps = makeDeps({ signedUp: ['Marisol@Example.COM'] });

    await expect(submitRsvp({ ...VALID, email: 'marisol@example.com' }, deps)).resolves.toBe(
      'DUPLICATE',
    );
  });

  test('duplicate matching ignores surrounding whitespace', async () => {
    const deps = makeDeps({ signedUp: ['marisol@example.com'] });

    await expect(submitRsvp({ ...VALID, email: '  MARISOL@example.com ' }, deps)).resolves.toBe(
      'DUPLICATE',
    );
  });

  test('a different email on the same circle is a new seat', async () => {
    const deps = makeDeps({ signedUp: ['someone-else@example.com'] });

    await expect(submitRsvp(VALID, deps)).resolves.toBe('CREATED');
  });
});

describe('submitRsvp — FULL (capacity boundary)', () => {
  test('count == capacity is full', async () => {
    const deps = makeDeps({ event: { ...UPCOMING, capacity: 8 }, count: 8 });

    await expect(submitRsvp(VALID, deps)).resolves.toBe('FULL');
    expect(deps.create).not.toHaveBeenCalled();
  });

  test('count == capacity - 1 takes the last seat', async () => {
    const deps = makeDeps({ event: { ...UPCOMING, capacity: 8 }, count: 7 });

    await expect(submitRsvp(VALID, deps)).resolves.toBe('CREATED');
  });

  test('an oversubscribed circle stays full', async () => {
    const deps = makeDeps({ event: { ...UPCOMING, capacity: 8 }, count: 9 });

    await expect(submitRsvp(VALID, deps)).resolves.toBe('FULL');
  });

  test('capacity undefined is never full, however many have signed up', async () => {
    const deps = makeDeps({ event: { ...UPCOMING, capacity: undefined }, count: 5000 });

    await expect(submitRsvp(VALID, deps)).resolves.toBe('CREATED');
  });
});

describe('submitRsvp — INVALID', () => {
  const badInputs: [string, { name: string; email: string }][] = [
    ['an empty name', { name: '', email: 'a@b.co' }],
    ['a whitespace-only name', { name: '   \t\n ', email: 'a@b.co' }],
    ['a 101-character name', { name: 'x'.repeat(101), email: 'a@b.co' }],
    ['an empty email', { name: 'Marisol', email: '' }],
    ['an email with no @', { name: 'Marisol', email: 'marisol.example.com' }],
    ['an email with no domain dot', { name: 'Marisol', email: 'marisol@example' }],
    ['an email with no local part', { name: 'Marisol', email: '@example.com' }],
    ['an email with a space', { name: 'Marisol', email: 'mari sol@example.com' }],
    ['an email with two @', { name: 'Marisol', email: 'a@b@example.com' }],
    ['an email over 254 characters', { name: 'Marisol', email: `${'x'.repeat(250)}@example.com` }],
  ];

  for (const [label, fields] of badInputs) {
    test(`rejects ${label} without touching Sanity`, async () => {
      const deps = makeDeps();

      await expect(submitRsvp({ eventSlug: 'august-circle', ...fields }, deps)).resolves.toBe(
        'INVALID',
      );

      expect(deps.getEvent).not.toHaveBeenCalled();
      expect(deps.create).not.toHaveBeenCalled();
    });
  }

  test('a 100-character name is accepted — the boundary is inclusive', async () => {
    const deps = makeDeps();

    await expect(submitRsvp({ ...VALID, name: 'x'.repeat(100) }, deps)).resolves.toBe('CREATED');
  });

  test('a name of surrounding-whitespace plus one character is accepted', async () => {
    const deps = makeDeps();

    await expect(submitRsvp({ ...VALID, name: '  J  ' }, deps)).resolves.toBe('CREATED');
    expect(deps.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'J' }));
  });

  test('a 101-character name that trims to 100 is accepted', async () => {
    const deps = makeDeps();

    await expect(submitRsvp({ ...VALID, name: `${'x'.repeat(100)} ` }, deps)).resolves.toBe(
      'CREATED',
    );
  });

  test('validation runs before the lookup — a bad email on a missing event is still INVALID', async () => {
    const deps = makeDeps({ event: null });

    await expect(submitRsvp({ ...VALID, email: 'nope' }, deps)).resolves.toBe('INVALID');
  });
});

describe('submitRsvp — order of checks', () => {
  test('a past circle that is also full and already has this email answers PAST', async () => {
    const deps = makeDeps({
      event: { _id: 'event-1', startsAt: '2026-01-01T00:00:00.000Z', capacity: 2 },
      count: 2,
      signedUp: ['marisol@example.com'],
    });

    await expect(submitRsvp(VALID, deps)).resolves.toBe('PAST');
    // Nothing past the PAST gate should even be asked.
    expect(deps.emailExists).not.toHaveBeenCalled();
    expect(deps.countRsvps).not.toHaveBeenCalled();
  });

  test('an already-signed-up email on a full circle answers DUPLICATE, not FULL', async () => {
    const deps = makeDeps({
      event: { ...UPCOMING, capacity: 2 },
      count: 2,
      signedUp: ['marisol@example.com'],
    });

    await expect(submitRsvp(VALID, deps)).resolves.toBe('DUPLICATE');
    expect(deps.countRsvps).not.toHaveBeenCalled();
  });

  test('an unknown slug wins over an invalid-but-present-shape everything else', async () => {
    const deps = makeDeps({ event: null, count: 99, signedUp: ['marisol@example.com'] });

    await expect(submitRsvp(VALID, deps)).resolves.toBe('NOT_FOUND');
  });
});
