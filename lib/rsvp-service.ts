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

import { hasStarted } from '@/lib/events';

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

/**
 * The two field rules, exported so `<RsvpForm>` can say *which* field the API
 * turned down without keeping a second, drifting copy of them. Both take raw
 * input and trim it themselves — leading spaces are a typo, not a rejection.
 *
 * The only thing this module imports is `lib/events`, which is itself
 * dependency-free, so a Client Component can pull these in freely (the bundler
 * tree-shakes `submitRsvp` and its dependency types out of the browser build).
 */
export function isValidRsvpName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= RSVP_NAME_MAX;
}

export function isValidRsvpEmail(email: string): boolean {
  const trimmed = email.trim();
  return trimmed.length <= RSVP_EMAIL_MAX && EMAIL_PATTERN.test(trimmed);
}

export async function submitRsvp(input: RsvpInput, deps: RsvpDeps): Promise<RsvpResult> {
  const name = input.name.trim();
  const email = input.email.trim();

  // Shape first: a malformed request never becomes a Sanity round-trip.
  if (!isValidRsvpName(name) || !isValidRsvpEmail(email)) return 'INVALID';

  const event = await deps.getEvent(input.eventSlug);
  // Truthiness rather than `=== null`: GROQ's `[0]` on no match answers null,
  // but nothing about a missing document deserves a crash if it ever answers
  // undefined instead.
  if (!event) return 'NOT_FOUND';

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
