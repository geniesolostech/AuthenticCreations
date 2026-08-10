import { defineCliConfig } from 'sanity/cli';

// Used by the `sanity` CLI (e.g. `npx sanity init`, `npx sanity deploy`) —
// not imported by the Next.js app itself. Reads the same env vars as
// sanity.config.ts; falls back to a placeholder so the CLI doesn't crash
// before `npx sanity init` has written real values.
export default defineCliConfig({
  api: {
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || 'placeholder',
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
  },
});
