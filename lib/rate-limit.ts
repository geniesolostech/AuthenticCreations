/**
 * A fixed-window, in-memory rate limiter.
 *
 * `POST /api/rsvp` is the app's only unauthenticated writer: anyone who can
 * reach it can create Sanity documents, and a burst costs the whole app its
 * document quota — a failure that shows up as a broken shop, not just a broken
 * RSVP form. This puts a ceiling on how fast one caller can spend it.
 *
 * Deliberately simple, and deliberately honest about what that buys: the
 * counters live in this process's memory, so on Amplify/Lambda the limit is
 * enforced *per instance*. Under fan-out a determined caller gets one bucket
 * per warm instance. That is a speed bump, not a wall; AWS WAF in front of the
 * app is the real answer, and docs/launch-runbook.md records it as the upgrade
 * path.
 *
 * No dependencies and no I/O, so it is a plain function to test.
 */

/** RSVP posts one caller may make per window. Generous for a person, tight for a script. */
export const RSVP_RATE_LIMIT = 5;
/** Length of an RSVP window. */
export const RSVP_RATE_WINDOW_MS = 10 * 60_000;

/**
 * Most callers tracked at once.
 *
 * The keys are caller-supplied (a request header), so without a ceiling this
 * map is an unbounded, process-lifetime memory leak that anyone can grow — the
 * same hazard `lib/square/service.ts`'s inventory cache guards against, and the
 * same discipline applies here: sweep expired entries on every check, then trim
 * to this bound.
 *
 * Trimming can evict a live counter, which hands that caller a fresh window —
 * so the bound is set far above any plausible real concurrent-caller count,
 * and the eviction order (soonest-to-expire first) means the entries with the
 * least remaining protection go first.
 */
export const RATE_LIMIT_MAX_KEYS = 10_000;

export interface RateLimiter {
  /**
   * Records one hit for `key` and reports whether it is within the window's
   * quota. A rejected hit is *not* counted, so a caller who backs off is not
   * punished for having been over the line once.
   */
  check(key: string): boolean;
  /** Entries currently resident. Exposed so the memory bound is observable from tests. */
  _size(): number;
}

interface Window {
  count: number;
  expiresAt: number;
}

/**
 * Builds a limiter allowing `limit` hits per `windowMs` per key.
 *
 * Fixed window, not sliding: a caller can in principle land `limit` hits at the
 * end of one window and `limit` more at the start of the next. At these numbers
 * that burst is harmless, and the alternative costs per-key history for no
 * practical gain.
 */
export function makeRateLimiter(
  limit: number = RSVP_RATE_LIMIT,
  windowMs: number = RSVP_RATE_WINDOW_MS,
  maxKeys: number = RATE_LIMIT_MAX_KEYS,
): RateLimiter {
  const windows = new Map<string, Window>();

  return {
    check(key: string): boolean {
      const now = Date.now();

      // Sweep first, so a key nobody uses again cannot stay resident for the
      // life of the process. After this, "present" means "in an open window".
      for (const [existing, window] of windows) {
        if (window.expiresAt <= now) windows.delete(existing);
      }

      const current = windows.get(key);
      let allowed: boolean;

      if (current === undefined) {
        // Delete-before-set is redundant on a fresh key but kept uniform with
        // the branch below, where it is what keeps insertion order equal to
        // expiry order — which is what lets `trim` evict from the front.
        windows.delete(key);
        windows.set(key, { count: 1, expiresAt: now + windowMs });
        allowed = true;
      } else if (current.count < limit) {
        current.count += 1;
        allowed = true;
      } else {
        allowed = false;
      }

      trim(windows, maxKeys);
      return allowed;
    },

    _size(): number {
      return windows.size;
    },
  };
}

/** Drops the soonest-to-expire windows until at most `maxKeys` remain. */
function trim(windows: Map<string, Window>, maxKeys: number): void {
  if (windows.size <= maxKeys) return;
  for (const key of windows.keys()) {
    if (windows.size <= maxKeys) return;
    windows.delete(key);
  }
}

/**
 * The app's one limiter, guarding `POST /api/rsvp`.
 *
 * It lives here rather than in the route module for two reasons: a Next route
 * module may export only its handlers and route config (so the reset seam below
 * could not sit beside `POST`), and the counters need to outlive a request,
 * which means module scope either way.
 */
let rsvpLimiter = makeRateLimiter();

export function rsvpRateLimiter(): RateLimiter {
  return rsvpLimiter;
}

/** Test seam: the counters outlive any one request, so tests must reset them. */
export function _resetRsvpRateLimiterForTests(): void {
  rsvpLimiter = makeRateLimiter();
}

/**
 * The caller a request is attributed to.
 *
 * Behind Amplify/CloudFront the client address arrives in `x-forwarded-for` as
 * a comma-separated chain; the **first** hop is the original client and every
 * entry after it is a proxy. Anything else — a direct request in local dev, a
 * missing header — shares one `unknown` bucket, which is the safe direction:
 * unattributable traffic is limited together rather than not at all.
 *
 * Note this header is trivially spoofable by anyone talking to the origin
 * directly. That is the same reason the per-instance caveat above matters, and
 * has the same answer (WAF).
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  return first ? first : 'unknown';
}
