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
/**
 * Formats an event's `startsAt` as date **and** time — e.g.
 * "August 20, 2026 at 7:00 PM" — in the *viewer's own* timezone.
 *
 * Deliberately the opposite choice from `formatPostDate`: a circle is a live
 * call, so "when do I need to be there, my time" is the only useful reading of
 * that instant. A publish date is a fact about a post and must look the same
 * everywhere; a start time is an appointment and must not.
 *
 * The formatter is built per call rather than once at module load: it resolves
 * the ambient timezone at construction, so a cached one would freeze whatever
 * the process happened to be in (and quietly ignore a `TZ` change under test).
 */
export function formatEventDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeStyle: 'short' }).format(date);
}

const UTC_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'UTC',
});

/**
 * The same instant, spelled out in UTC and labelled as such.
 *
 * This is what a server render (and a visitor with JavaScript off) sees: the
 * server's timezone is not the viewer's, so rendering *its* local time would be
 * a confidently wrong appointment. `<EventDateTime>` swaps this for the local
 * reading once it is running in the browser.
 */
export function formatEventDateTimeUtc(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  return `${UTC_DATE_TIME_FORMATTER.format(date)} UTC`;
}

export function formatPostDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return '';

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (Number.isNaN(date.getTime())) return '';

  return LONG_DATE_FORMATTER.format(date);
}
