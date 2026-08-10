'use client';

/**
 * sanity.config.ts pulls in the full Sanity Studio runtime (structureTool,
 * etc.), which is only meant to run in a browser bundle. If a Server
 * Component imports it directly (even just to pass the config object as a
 * prop), Next's RSC bundler resolves that import graph under the
 * "react-server" export condition — and Studio's own `swr` dependency has no
 * default export under that condition, which breaks `next build`. Keeping
 * the `import config from '@/sanity.config'` inside this 'use client' file
 * keeps that whole module graph in the client bundle instead.
 */
import { NextStudio } from 'next-sanity/studio';

import config from '@/sanity.config';

export default function StudioClient() {
  return <NextStudio config={config} />;
}
