const LONG_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' });

/**
 * Formats a Sanity `datetime` (or bare `date`) ISO string as a human-friendly
 * long date — e.g. "August 9, 2026" — for post/event dates rendered on
 * public pages.
 *
 * Deliberately timezone-stable: it reads the calendar date straight out of
 * the ISO string's own `YYYY-MM-DD` prefix and formats *that* in UTC, rather
 * than letting `new Date(iso)` convert to the viewer's local timezone first.
 * A `publishedAt` of "2026-08-10T02:00:00.000Z" would otherwise print as
 * "August 9" for a viewer west of UTC and "August 10" for a viewer east of
 * it, even though it's the same recorded publish date. Anchoring to the
 * ISO string's own date component keeps the printed date identical for
 * every viewer, everywhere — no off-by-one across timezones.
 */
export function formatPostDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return '';

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (Number.isNaN(date.getTime())) return '';

  return LONG_DATE_FORMATTER.format(date);
}
