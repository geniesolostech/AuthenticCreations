import { createImageUrlBuilder, type SanityImageSource } from '@sanity/image-url';

// Image URL building only needs the project id/dataset (image URLs are
// public CDN URLs, not sensitive) so this is intentionally decoupled from
// lib/sanity/client.ts's server-only-guarded clients: urlFor() stays safe to
// call from both Server and Client Components.
const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || 'placeholder';
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production';

const builder = createImageUrlBuilder({ projectId, dataset });

export function urlFor(source: SanityImageSource) {
  return builder.image(source);
}
