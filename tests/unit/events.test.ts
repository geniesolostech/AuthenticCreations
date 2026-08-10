import { describe, expect, test } from 'vitest';

import {
  CIRCLE_FULL_MESSAGE,
  CIRCLE_MET_MESSAGE,
  NO_CIRCLES_MESSAGE,
  SPOTS_LEFT_THRESHOLD,
  hasStarted,
  spotsNote,
  spotsRemaining,
} from '@/lib/events';

describe('locked copy', () => {
  test('reads exactly as the brief writes it', () => {
    expect(CIRCLE_FULL_MESSAGE).toBe('this circle is full 💛. Check back for the next one.');
    expect(NO_CIRCLES_MESSAGE).toBe(
      'no circles on the calendar right now. Follow the blog for the next one.',
    );
    expect(CIRCLE_MET_MESSAGE).toBe('this circle has already met');
  });
});

describe('hasStarted', () => {
  const now = new Date('2026-08-09T18:00:00.000Z');

  test('a start in the future has not started', () => {
    expect(hasStarted('2026-08-20T23:00:00.000Z', now)).toBe(false);
  });

  test('a start in the past has', () => {
    expect(hasStarted('2026-08-01T23:00:00.000Z', now)).toBe(true);
  });

  test('exactly now has not — the same boundary UPCOMING_EVENTS_QUERY draws', () => {
    expect(hasStarted(now.toISOString(), now)).toBe(false);
  });

  test('an unreadable date counts as started', () => {
    expect(hasStarted('one day soon', now)).toBe(true);
  });
});

describe('spotsRemaining', () => {
  test('capacity minus the count', () => {
    expect(spotsRemaining(8, 3)).toBe(5);
  });

  test('no capacity means no number to give', () => {
    expect(spotsRemaining(undefined, 3)).toBeNull();
  });

  test('an oversubscribed circle has zero seats, never negative', () => {
    expect(spotsRemaining(8, 11)).toBe(0);
  });

  test('exactly at capacity is zero', () => {
    expect(spotsRemaining(8, 8)).toBe(0);
  });
});

describe('spotsNote', () => {
  test('says nothing when seats are unlimited', () => {
    expect(spotsNote(null)).toBeNull();
  });

  test(`says nothing at or above the threshold of ${SPOTS_LEFT_THRESHOLD}`, () => {
    expect(spotsNote(SPOTS_LEFT_THRESHOLD)).toBeNull();
    expect(spotsNote(40)).toBeNull();
  });

  test('counts down below the threshold', () => {
    expect(spotsNote(SPOTS_LEFT_THRESHOLD - 1)).toBe(`${SPOTS_LEFT_THRESHOLD - 1} spots left`);
    expect(spotsNote(2)).toBe('2 spots left');
  });

  test('the last seat is singular', () => {
    expect(spotsNote(1)).toBe('1 spot left');
  });

  test('zero seats is the full message, not "0 spots left"', () => {
    expect(spotsNote(0)).toBe(CIRCLE_FULL_MESSAGE);
  });
});
