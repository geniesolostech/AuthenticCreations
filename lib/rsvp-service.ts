/**
 * The RSVP rule set: everything that decides whether someone gets a seat in a
 * virtual crochet circle.
 *
 * Pure by construction — every read, the one write, and even the clock arrive
 * as injected dependencies, so this file imports nothing from Sanity and can be
 * exercised as plain functions. `app/api/rsvp/route.ts` supplies the real
 * implementations (Task 3's query helpers plus `sanityWriteClient`) and is the
 * only place in the app that writes an rsvp document.
 */

/** Every way an RSVP attempt can end. The route maps these to HTTP statuses. */
export type RsvpResult = 'CREATED' | 'DUPLICATE' | 'FULL' | 'PAST' | 'NOT_FOUND' | 'INVALID';

export interface RsvpInput {
  eventSlug: string;
  name: string;
  email: string;
}

/** The only event fields this decision needs — a narrow slice of `EventDoc`. */
export interface RsvpEvent {
  _id: string;
  startsAt: string;
  capacity?: number;
}

export interface RsvpDeps {
  getEvent(slug: string): Promise<RsvpEvent | null>;
  countRsvps(eventId: string): Promise<number>;
  emailExists(eventId: string, email: string): Promise<boolean>;
  create(doc: { eventId: string; name: string; email: string }): Promise<void>;
  now(): Date;
}

/** Longest name we'll store. Long enough for any real name, short enough that
 * an anonymous caller cannot use the field as free storage. */
export const RSVP_NAME_MAX = 100;
/** RFC 5321's ceiling on a forward path — an address longer than this cannot
 * be delivered to anyway. */
export const RSVP_EMAIL_MAX = 254;

/**
 * Deliberately the loose, "RFC-basic" shape check — something@something.tld
 * with no whitespace — not an attempt at RFC 5322. The real proof that an
 * address works is CJ's email arriving; over-strict patterns here would only
 * turn away people with unusual-but-valid addresses.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function submitRsvp(input: RsvpInput, deps: RsvpDeps): Promise<RsvpResult> {
  const name = input.name.trim();
  const email = input.email.trim();

  // Shape first: a malformed request never becomes a Sanity round-trip.
  if (name.length === 0 || name.length > RSVP_NAME_MAX) return 'INVALID';
  if (email.length > RSVP_EMAIL_MAX || !EMAIL_PATTERN.test(email)) return 'INVALID';

  const event = await deps.getEvent(input.eventSlug);
  if (event === null) return 'NOT_FOUND';

  if (hasStarted(event.startsAt, deps.now())) return 'PAST';

  // Before capacity, so someone already holding a seat is told they're in
  // rather than turned away by a circle they're already counted in.
  if (await deps.emailExists(event._id, email)) return 'DUPLICATE';

  if (typeof event.capacity === 'number') {
    const taken = await deps.countRsvps(event._id);
    if (taken >= event.capacity) return 'FULL';
  }

  await deps.create({ eventId: event._id, name, email });
  return 'CREATED';
}

/**
 * A circle is joinable right up to its start instant — the same boundary
 * `UPCOMING_EVENTS_QUERY` draws with `startsAt >= $now`, so an event listed as
 * upcoming is never one the API refuses as past.
 *
 * An unparseable `startsAt` counts as started: a date we cannot read is not a
 * date we can promise someone a seat for.
 */
function hasStarted(startsAt: string, now: Date): boolean {
  const start = new Date(startsAt).getTime();
  if (Number.isNaN(start)) return true;
  return start < now.getTime();
}
