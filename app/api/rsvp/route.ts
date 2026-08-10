/**
 * `POST /api/rsvp` — the only writer in the app.
 *
 * Thin by design, like `/api/checkout`: parse the body, hand it to
 * `submitRsvp` with the real Sanity dependencies, map the result to a status.
 * Every rule about who gets a seat lives in `lib/rsvp-service.ts`; re-deciding
 * any of it here would be a second, weaker source of truth.
 *
 * Failure bodies are closed codes the form switches on. No Sanity message, no
 * token, no internal text ever reaches the browser — those go to the server log.
 */
import { rsvpBodySchema } from '@/lib/api-schemas';
import { submitRsvp, type RsvpDeps, type RsvpResult } from '@/lib/rsvp-service';
import { sanityWriteClient } from '@/lib/sanity/client';
import { findRsvp, getEventBySlug, getRsvpCount } from '@/lib/sanity/queries';

export const dynamic = 'force-dynamic';

/**
 * `dynamic` keeps Next from caching this route, but it emits no cache header of
 * its own, which would leave a CDN or browser free to reuse a response under
 * its own heuristics. A replayed "you're in!" (or a cached 403) is a lie about
 * someone's seat, so say it outright on every response.
 */
const NO_STORE = { 'cache-control': 'no-store' } as const;

/** The brief's result taxonomy, mapped to the wire. */
const STATUS: Record<RsvpResult, number> = {
  CREATED: 201,
  DUPLICATE: 409,
  FULL: 403,
  PAST: 410,
  NOT_FOUND: 404,
  INVALID: 400,
};

/**
 * Task 3's read helpers plus the write client, adapted to the service's
 * dependency shape. Constructed once at module load — none of these read
 * secrets eagerly (the write token is only used when a request is made), so
 * unlike the Square gateway this needs no lazy singleton.
 */
const sanityDeps: RsvpDeps = {
  getEvent: (slug) => getEventBySlug(slug),
  countRsvps: (eventId) => getRsvpCount(eventId),
  emailExists: async (eventId, email) => (await findRsvp(eventId, email)) !== null,
  create: async ({ eventId, name, email }) => {
    await sanityWriteClient.create({
      _type: 'rsvp',
      event: { _type: 'reference', _ref: eventId },
      name,
      email,
      createdAt: new Date().toISOString(),
    });
  },
  now: () => new Date(),
};

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    // Malformed JSON is a malformed request, not a server fault.
    return fail('INVALID');
  }

  const parsed = rsvpBodySchema.safeParse(body);
  // Deliberately no zod issue detail in the response — the form knows the
  // contract, and echoing parser output is free reconnaissance.
  if (!parsed.success) return fail('INVALID');

  let result: RsvpResult;
  try {
    result = await submitRsvp(parsed.data, sanityDeps);
  } catch (error) {
    // Sanity unreachable, or the write was refused. The service itself decides
    // nothing here — it either answered or it didn't.
    console.error('[api/rsvp] rsvp could not be recorded', error);
    return Response.json({ error: 'TRY_AGAIN' }, { status: 503, headers: NO_STORE });
  }

  if (result === 'CREATED') {
    return Response.json({ result }, { status: STATUS.CREATED, headers: NO_STORE });
  }
  return fail(result);
}

function fail(result: Exclude<RsvpResult, 'CREATED'>): Response {
  return Response.json({ error: result }, { status: STATUS[result], headers: NO_STORE });
}
