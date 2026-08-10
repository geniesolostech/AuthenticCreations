'use client';

import { useEffect } from 'react';

/**
 * Reported with every event so a spike can be traced to a release. Bumped by
 * hand; RUM only uses it as a label.
 */
const APPLICATION_VERSION = '1.0.0';

/**
 * CloudWatch RUM — the site's whole analytics story (spec §8).
 *
 * Renders nothing, ever. Its only job is to start the RUM web client once, in
 * the browser, after the page is interactive.
 *
 * **Unset means off.** All three variables must be present or this is a no-op:
 * dev machines, CI, and the unit suite have no app monitor, and a client that
 * half-starts would either throw on every page or beacon to an endpoint that
 * does not exist. The app monitor is created at deploy time (see
 * docs/launch-runbook.md), so "not configured yet" is the normal state of the
 * repo, not an error.
 *
 * The three reads are spelled out as full `process.env.NEXT_PUBLIC_…` literals
 * because Next inlines them at build time by exact text match — a computed
 * lookup like `process.env[name]` would inline nothing and silently disable
 * analytics in production. They are `NEXT_PUBLIC_` by necessity: the browser is
 * what reports, and none of the three is a secret (the identity pool grants
 * guests permission to put RUM events and nothing else).
 */
export default function Rum() {
  useEffect(() => {
    const applicationId = process.env.NEXT_PUBLIC_RUM_APP_MONITOR_ID;
    const identityPoolId = process.env.NEXT_PUBLIC_RUM_IDENTITY_POOL_ID;
    const region = process.env.NEXT_PUBLIC_RUM_REGION;

    if (!applicationId || !identityPoolId || !region) return;

    // Effects cannot be async, and this component can unmount before a slow
    // chunk lands (a fast route change on a cold cache), so the import result
    // is guarded rather than awaited.
    let cancelled = false;

    // Imported dynamically so the ~100KB client is a separate chunk fetched
    // after hydration, and never at all when analytics is unconfigured —
    // a static import would put it in the main bundle for every visitor.
    void import('aws-rum-web')
      .then(({ AwsRum }) => {
        if (cancelled) return;
        new AwsRum(applicationId, APPLICATION_VERSION, region, {
          identityPoolId,
          // The dataplane is per-region and derivable, so it is one fewer
          // variable for whoever is doing the deploy to get wrong.
          endpoint: `https://dataplane.rum.${region}.amazonaws.com`,
          telemetries: ['performance', 'errors', 'http'],
          // First-party session cookies, which is what lets RUM tell a returning
          // visitor from a new one. Disclosed on /policies (spec §8).
          allowCookies: true,
          // Every session. At this traffic level sampling would mostly produce
          // gaps, and the cost is about a dollar a month either way.
          sessionSampleRate: 1,
          enableXRay: false,
        });
      })
      .catch((error: unknown) => {
        // Analytics failing must never take a page with it. A blocked chunk
        // (ad blocker, offline) is the common case and is not worth a crash.
        console.error('[rum] could not start the CloudWatch RUM client', error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
