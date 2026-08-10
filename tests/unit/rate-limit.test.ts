/**
 * Rate limiter tests — pure functions, fake timers, no I/O.
 *
 * The three properties that matter are the three ways this could quietly stop
 * protecting anything: a window that never reopens (locks real people out), a
 * counter shared between callers (one visitor's RSVPs spend another's quota),
 * and a map that grows without limit (the leak the limiter itself would become).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RSVP_RATE_LIMIT, RSVP_RATE_WINDOW_MS, clientIp, makeRateLimiter } from '@/lib/rate-limit';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-10T12:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('makeRateLimiter — the quota', () => {
  it('allows exactly `limit` hits, then refuses', () => {
    const limiter = makeRateLimiter(3, 1000);

    expect([limiter.check('a'), limiter.check('a'), limiter.check('a')]).toEqual([
      true,
      true,
      true,
    ]);
    expect(limiter.check('a')).toBe(false);
    expect(limiter.check('a')).toBe(false);
  });

  it('defaults to the RSVP budget', () => {
    const limiter = makeRateLimiter();

    for (let i = 0; i < RSVP_RATE_LIMIT; i++) {
      expect(limiter.check('a')).toBe(true);
    }
    expect(limiter.check('a')).toBe(false);
  });

  it('does not count a refused hit against the next window', () => {
    // Hammering while blocked must not extend the block — otherwise a script
    // pointed at the endpoint would keep a real visitor's IP shut out forever.
    const limiter = makeRateLimiter(2, 1000);
    limiter.check('a');
    limiter.check('a');
    for (let i = 0; i < 50; i++) limiter.check('a');

    vi.advanceTimersByTime(1001);

    expect(limiter.check('a')).toBe(true);
    expect(limiter.check('a')).toBe(true);
    expect(limiter.check('a')).toBe(false);
  });
});

describe('makeRateLimiter — window expiry', () => {
  it('keeps refusing until the window is up', () => {
    const limiter = makeRateLimiter(1, 1000);
    expect(limiter.check('a')).toBe(true);

    vi.advanceTimersByTime(999);
    expect(limiter.check('a')).toBe(false);

    vi.advanceTimersByTime(2);
    expect(limiter.check('a')).toBe(true);
  });

  it('opens a fresh window rather than resuming the old count', () => {
    const limiter = makeRateLimiter(2, 1000);
    limiter.check('a');

    vi.advanceTimersByTime(1001);

    expect(limiter.check('a')).toBe(true);
    expect(limiter.check('a')).toBe(true);
    expect(limiter.check('a')).toBe(false);
  });

  it('drops expired entries on the next check rather than holding them forever', () => {
    const limiter = makeRateLimiter(1, 1000);
    limiter.check('a');
    limiter.check('b');
    expect(limiter._size()).toBe(2);

    vi.advanceTimersByTime(1001);
    limiter.check('c');

    // 'a' and 'b' were swept; only the live window remains.
    expect(limiter._size()).toBe(1);
  });

  it('uses the RSVP window length by default', () => {
    const limiter = makeRateLimiter(1);
    expect(limiter.check('a')).toBe(true);

    vi.advanceTimersByTime(RSVP_RATE_WINDOW_MS - 1);
    expect(limiter.check('a')).toBe(false);

    vi.advanceTimersByTime(2);
    expect(limiter.check('a')).toBe(true);
  });
});

describe('makeRateLimiter — per-key isolation', () => {
  it('gives every key its own budget', () => {
    const limiter = makeRateLimiter(2, 1000);

    expect(limiter.check('1.1.1.1')).toBe(true);
    expect(limiter.check('1.1.1.1')).toBe(true);
    expect(limiter.check('1.1.1.1')).toBe(false);

    // A second caller is untouched by the first one's exhausted budget.
    expect(limiter.check('2.2.2.2')).toBe(true);
    expect(limiter.check('2.2.2.2')).toBe(true);
    expect(limiter.check('2.2.2.2')).toBe(false);
  });

  it('runs every key on its own clock', () => {
    const limiter = makeRateLimiter(1, 1000);
    limiter.check('a');

    vi.advanceTimersByTime(600);
    limiter.check('b');

    vi.advanceTimersByTime(500); // a: 1100ms (expired), b: 500ms (live)
    expect(limiter.check('a')).toBe(true);
    expect(limiter.check('b')).toBe(false);
  });
});

describe('makeRateLimiter — bounded memory', () => {
  it('never holds more than maxKeys entries, however many callers appear', () => {
    const limiter = makeRateLimiter(5, 60_000, 10);

    for (let i = 0; i < 500; i++) {
      limiter.check(`caller-${i}`);
      expect(limiter._size()).toBeLessThanOrEqual(10);
    }

    expect(limiter._size()).toBe(10);
  });

  it('evicts the soonest-to-expire windows first', () => {
    const limiter = makeRateLimiter(1, 60_000, 2);

    limiter.check('oldest');
    vi.advanceTimersByTime(10);
    limiter.check('middle');
    vi.advanceTimersByTime(10);
    limiter.check('newest'); // pushes size to 3, trims back to 2

    expect(limiter._size()).toBe(2);
    // 'oldest' lost its counter (fresh budget); the two newer ones kept theirs.
    expect(limiter.check('oldest')).toBe(true);
    expect(limiter.check('newest')).toBe(false);
  });

  it('an exhausted key stays one entry no matter how often it is hit', () => {
    const limiter = makeRateLimiter(2, 60_000, 100);

    for (let i = 0; i < 100; i++) limiter.check('a');

    expect(limiter._size()).toBe(1);
  });
});

describe('clientIp', () => {
  function request(headers: Record<string, string>): Request {
    return new Request('https://example.test/api/rsvp', { method: 'POST', headers });
  }

  it('takes the first hop of x-forwarded-for — the original client', () => {
    // Later entries are proxies we control; keying on them would put every
    // visitor behind one CloudFront edge into a single shared bucket.
    expect(clientIp(request({ 'x-forwarded-for': '203.0.113.7, 70.132.0.1, 10.0.0.5' }))).toBe(
      '203.0.113.7',
    );
  });

  it('trims surrounding whitespace', () => {
    expect(clientIp(request({ 'x-forwarded-for': '  203.0.113.7  , 10.0.0.5' }))).toBe('203.0.113.7');
  });

  it('handles a single-hop header', () => {
    expect(clientIp(request({ 'x-forwarded-for': '203.0.113.7' }))).toBe('203.0.113.7');
  });

  it('falls back to one shared bucket when the header is absent or empty', () => {
    // Limiting unattributable traffic together is the safe direction — the
    // alternative is not limiting it at all.
    expect(clientIp(request({}))).toBe('unknown');
    expect(clientIp(request({ 'x-forwarded-for': '' }))).toBe('unknown');
    expect(clientIp(request({ 'x-forwarded-for': '   ,10.0.0.5' }))).toBe('unknown');
  });
});
