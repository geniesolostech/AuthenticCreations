/**
 * Shared, dependency-free facts about circles: the copy that must read the same
 * everywhere, the start-time boundary, and the spots-left arithmetic.
 *
 * Imported by the API service, the pages, and the client form alike — so it
 * imports nothing itself.
 */

/** Every place a full circle is announced says it with these exact words. */
export const CIRCLE_FULL_MESSAGE = 'this circle is full 💛. Check back for the next one.';
/** `/community` with nothing on the calendar. */
export const NO_CIRCLES_MESSAGE =
  'no circles on the calendar right now. Follow the blog for the next one.';
/** A circle whose time has passed — shown instead of the RSVP form. */
export const CIRCLE_MET_MESSAGE = 'this circle has already met';

/**
 * Below this many free seats we say how many are left. Above it, a count is
 * just noise — nobody hurries for "23 spots left".
 */
export const SPOTS_LEFT_THRESHOLD = 6;

/**
 * A circle is joinable right up to its start instant — the same boundary
 * `UPCOMING_EVENTS_QUERY` draws with `startsAt >= $now`, so an event listed as
 * upcoming is never one the API refuses as past.
 *
 * An unparseable `startsAt` counts as started: a date we cannot read is not a
 * date we can promise someone a seat for.
 */
export function hasStarted(startsAt: string, now: Date): boolean {
  const start = new Date(startsAt).getTime();
  if (Number.isNaN(start)) return true;
  return start < now.getTime();
}

/**
 * Free seats, or `null` for a circle with no capacity — unlimited, so there is
 * no such number. Never negative: an oversubscribed circle has zero seats, not
 * minus two.
 */
export function spotsRemaining(capacity: number | undefined, taken: number): number | null {
  if (typeof capacity !== 'number') return null;
  return Math.max(0, capacity - taken);
}

/**
 * The line shown under an event: nothing when seats are plentiful or unlimited,
 * a gentle count when they are running out, and the full-circle message at zero
 * (which is not "0 spots left").
 */
export function spotsNote(remaining: number | null): string | null {
  if (remaining === null) return null;
  if (remaining <= 0) return CIRCLE_FULL_MESSAGE;
  if (remaining >= SPOTS_LEFT_THRESHOLD) return null;
  return remaining === 1 ? '1 spot left' : `${remaining} spots left`;
}
