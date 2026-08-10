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
import { clientIp, makeRateLimiter, type RateLimiter } from '@/lib/rate-limit';
import { submitRsvp, type RsvpDeps, type RsvpResult } from '@/lib/rsvp-service';
import { sanityClient, sanityWriteClient } from '@/lib/sanity/client';
import { fixtureRsvpDeps, sanityFixturesEnabled } from '@/lib/sanity/fixtures';
import {
  EVENT_BY_SLUG_QUERY,
  FIND_RSVP_QUERY,
  RSVP_COUNT_QUERY,
  type EventDoc,
  type Rsvp,
} from '@/lib/sanity/queries';

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
 * The reads this endpoint's decisions rest on, deliberately **not** through the
 * CDN-cached `sanityClient` that pages use.
 *
 * `sanityWriteClient` writes with `useCdn: false`, so a CDN-backed read here
 * would mean the endpoint cannot see its own writes: an edge that has not yet
 * caught up would report an RSVP as missing and a full circle as having room,
 * stretching the check→create window out to CDN purge lag. Same project, same
 * dataset, same public queries — only the caching is different, which is why
 * this reuses Task 3's exported query strings rather than its helpers (those
 * stay on the CDN client, which is right for pages).
 */
const freshClient = sanityClient.withConfig({ useCdn: false });

/**
 * Those reads plus the write, adapted to the service's dependency shape.
 * Constructed once at module load — none of these read secrets eagerly (the
 * write token is only used when a request is made), so unlike the Square
 * gateway this needs no lazy singleton.
 */
const sanityDeps: RsvpDeps = {
  getEvent: (slug) => freshClient.fetch<EventDoc | null>(EVENT_BY_SLUG_QUERY, { slug }),
  countRsvps: (eventId) => freshClient.fetch<number>(RSVP_COUNT_QUERY, { eventId }),
  // `!= null`, not `!== null`: a lookup that answers `undefined` is a miss, and
  // treating it as a hit would silently refuse every RSVP as a duplicate.
  emailExists: async (eventId, email) =>
    (await freshClient.fetch<Rsvp | null>(FIND_RSVP_QUERY, { eventId, email })) != null,
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

/**
 * Which set of dependencies a request runs against.
 *
 * This route is the one place in the app that cannot get its fixture data from
 * `lib/sanity/queries.ts`: it deliberately reads through its own non-CDN client
 * and writes with a token, neither of which exists in fixture mode. So the
 * whole dependency bundle is swapped instead — the rules in `submitRsvp` are
 * identical either way, which is the point.
 *
 * Read per request rather than captured at module load, so the flag behaves the
 * same here as everywhere else. False in every deployed build.
 */
function deps(): RsvpDeps {
  return sanityFixturesEnabled() ? fixtureRsvpDeps : sanityDeps;
}

/**
 * The one throttle in the app.
 *
 * This endpoint is unauthenticated and it *creates documents*, so an
 * unthrottled burst does not merely spam the RSVP list — it spends the Sanity
 * project's document quota, which takes the shop down with it. The limiter
 * lives in this process's memory, so on Lambda the budget is per warm instance
 * and this is a speed bump rather than a wall; see lib/rate-limit.ts and the
 * runbook's WAF note.
 *
 * Module-level, so the counters survive between requests on one instance.
 */
let limiter: RateLimiter = makeRateLimiter();

/** Test seam: the counters outlive any one request, so tests must reset them. */
export function _resetRateLimitForTests(): void {
  limiter = makeRateLimiter();
}

export async function POST(request: Request): Promise<Response> {
  // Before the body is even read: a refusal must cost less than an acceptance,
  // or the throttle becomes its own denial-of-service amplifier.
  if (!limiter.check(clientIp(request))) {
    return Response.json({ error: 'TRY_AGAIN_LATER' }, { status: 429, headers: NO_STORE });
  }

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
    result = await submitRsvp(parsed.data, deps());
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
