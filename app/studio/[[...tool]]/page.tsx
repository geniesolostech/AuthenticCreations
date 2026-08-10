/**
 * This route is responsible for the built-in authoring environment using
 * Sanity Studio. All routes under /studio are handled by this file via
 * Next.js' catch-all routes:
 * https://nextjs.org/docs/app/api-reference/file-conventions/dynamic-routes#catch-all-segments
 *
 * https://github.com/sanity-io/next-sanity
 */

import StudioClient from './studio-client';

export const dynamic = 'force-static';

export { metadata, viewport } from 'next-sanity/studio';

export default function StudioPage() {
  return <StudioClient />;
}
