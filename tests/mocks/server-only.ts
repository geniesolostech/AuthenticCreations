// No-op stand-in for the `server-only` package, used only under Vitest (see
// vitest.config.ts's resolve.alias).
//
// The real `server-only` package throws unconditionally unless the module
// resolver sets the "react-server" export condition — a condition only
// Next.js's own webpack build sets (per-bundle: no-op in the server layer,
// throws in the client layer). Vitest never sets that condition, so without
// this alias, simply importing any server-only-guarded module (e.g.
// lib/sanity/client.ts) would crash every test that transitively imports it
// — including tests that only want the exported GROQ query strings and never
// touch the network. `next build`/`next dev` are unaffected: they resolve
// the real package, so the client/server bundle guard still holds there.
export {};
