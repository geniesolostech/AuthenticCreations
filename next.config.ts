import type { NextConfig } from "next";

/**
 * Build-time pre-flight for `NEXT_PUBLIC_SITE_URL`.
 *
 * Without it, `createCheckout` refuses to build a payment link (it will not
 * send a buyer to Square with a broken return URL) and the shopper is told
 * "Square's having a moment — try again shortly". That message is a lie: the
 * problem is a missing environment variable, it is permanent, and it looks
 * transient — so nobody investigates until sales have been failing for a day.
 *
 * Checked here because this file is evaluated once per build, before any page
 * is rendered, and Next has already loaded `.env*` by this point. Production
 * only: dev and test fall back to localhost on purpose (see app/layout.tsx),
 * and a missing value there is not a deployment anyone can be hurt by.
 */
function assertSiteUrl(): void {
  if (process.env.NODE_ENV !== "production") return;

  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const advice =
    "Set it to the site's public origin (e.g. https://authenticcreationsco.com) in the " +
    "Amplify console under App settings → Environment variables, then redeploy. " +
    "It must be present at BUILD time, not just at runtime. " +
    "See docs/launch-runbook.md → pre-flight checklist.";

  if (!raw) {
    throw new Error(`NEXT_PUBLIC_SITE_URL is not set. ${advice}`);
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`NEXT_PUBLIC_SITE_URL is not a valid absolute URL: "${raw}". ${advice}`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(
      `NEXT_PUBLIC_SITE_URL must be an http(s) URL, got "${url.protocol}//". ${advice}`,
    );
  }
}

assertSiteUrl();

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
