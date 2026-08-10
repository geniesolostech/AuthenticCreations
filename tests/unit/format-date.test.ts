import { afterEach, describe, expect, test } from 'vitest';

import { formatPostDate } from '@/lib/format-date';

describe('formatPostDate', () => {
  const originalTZ = process.env.TZ;
  afterEach(() => {
    process.env.TZ = originalTZ;
  });

  test('formats an ISO datetime as a long US date', () => {
    expect(formatPostDate('2026-08-09T12:00:00.000Z')).toBe('August 9, 2026');
  });

  test('pads single-digit months and days correctly', () => {
    expect(formatPostDate('2026-01-01T00:00:00.000Z')).toBe('January 1, 2026');
  });

  test('a bare YYYY-MM-DD string (no time component) formats the same way', () => {
    expect(formatPostDate('2026-12-25')).toBe('December 25, 2026');
  });

  test('is stable across the viewer timezone — the same instant prints the same calendar date everywhere', () => {
    // 2026-08-10T02:00:00Z is 2026-08-10 in UTC+14 and 2026-08-09 in UTC-12 —
    // a naive `new Date(iso).toLocaleDateString()` would print different
    // days for these two timezones. formatPostDate must not.
    const iso = '2026-08-10T02:00:00.000Z';

    process.env.TZ = 'Pacific/Kiritimati'; // UTC+14
    const farEast = formatPostDate(iso);

    process.env.TZ = 'Etc/GMT+12'; // UTC-12
    const farWest = formatPostDate(iso);

    expect(farEast).toBe('August 10, 2026');
    expect(farWest).toBe('August 10, 2026');
  });

  test('returns an empty string for an unparseable date', () => {
    expect(formatPostDate('not-a-date')).toBe('');
  });
});
