import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // `*.test.*` only, deliberately narrower than Vitest's default (which also
    // claims `*.spec.*`). The Playwright suite in tests/e2e is written in
    // `*.spec.ts` and needs a browser and a running dev server; picked up here
    // it would fail at `import '@playwright/test'` and take `npm test` down
    // with it. One suffix per runner keeps the two from colliding.
    include: ["tests/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
      // See tests/mocks/server-only.ts for why this is aliased away.
      "server-only": path.resolve(import.meta.dirname, "./tests/mocks/server-only.ts"),
    },
  },
});
