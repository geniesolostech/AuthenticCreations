import { afterEach, describe, expect, test } from 'vitest';

import { formatEventDateTime, formatEventDateTimeUtc, formatPostDate } from '@/lib/format-date';

/** ICU sometimes puts a narrow no-break space before AM/PM; readers do not care. */
function normalize(text: string): string {
  return text.replace(/ /g, ' ');
}

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

describe('formatEventDateTime', () => {
  const originalTZ = process.env.TZ;
  afterEach(() => {
    process.env.TZ = originalTZ;
  });

  test('formats an event start as a long date and short time', () => {
    process.env.TZ = 'UTC';

    expect(normalize(formatEventDateTime('2026-08-20T23:00:00.000Z'))).toBe(
      'August 20, 2026 at 11:00 PM',
    );
  });

  test('follows the viewer, not the calendar — a circle is an appointment', () => {
    const iso = '2026-08-20T23:00:00.000Z';

    process.env.TZ = 'America/New_York'; // UTC-4 in August
    const east = normalize(formatEventDateTime(iso));

    process.env.TZ = 'Pacific/Kiritimati'; // UTC+14
    const farEast = normalize(formatEventDateTime(iso));

    expect(east).toBe('August 20, 2026 at 7:00 PM');
    expect(farEast).toBe('August 21, 2026 at 1:00 PM');
    // Deliberately unlike formatPostDate, which pins the same date everywhere.
    expect(formatPostDate(iso)).toBe('August 20, 2026');
  });

  test('returns an empty string for an unparseable date', () => {
    expect(formatEventDateTime('one day soon')).toBe('');
  });
});

describe('formatEventDateTimeUtc', () => {
  const originalTZ = process.env.TZ;
  afterEach(() => {
    process.env.TZ = originalTZ;
  });

  test('spells the instant out in UTC and says so', () => {
    expect(normalize(formatEventDateTimeUtc('2026-08-20T23:00:00.000Z'))).toBe(
      'August 20, 2026 at 11:00 PM UTC',
    );
  });

  test('ignores the ambient timezone entirely — this is the server-render fallback', () => {
    const iso = '2026-08-20T23:00:00.000Z';

    process.env.TZ = 'Pacific/Kiritimati';
    const farEast = normalize(formatEventDateTimeUtc(iso));

    process.env.TZ = 'Etc/GMT+12';
    const farWest = normalize(formatEventDateTimeUtc(iso));

    expect(farEast).toBe('August 20, 2026 at 11:00 PM UTC');
    expect(farWest).toBe(farEast);
  });

  test('returns an empty string for an unparseable date', () => {
    expect(formatEventDateTimeUtc('one day soon')).toBe('');
  });
});
