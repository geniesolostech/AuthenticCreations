/**
 * E2E runner that owns the web server's lifecycle.
 *
 * This exists for one reason, documented at length in playwright.config.ts:
 * on Windows, Playwright's own `webServer` teardown spends minutes killing the
 * Next dev server after the last test — the results are printed, the exit code
 * is decided, and the process just sits there. Measured to be unaffected by
 * every knob `webServer` has. So the suite's npm script starts the server
 * here, tells Playwright it is external (E2E_EXTERNAL_SERVER=1), and when the
 * tests finish kills the server's whole process tree the blunt way. The
 * process then exits the moment the verdict is in — which is what lets
 * anything watching the run (CI, a background shell) learn that it ended.
 *
 * Everything else — port, fixture switches, dist dir, and why each is what it
 * is — mirrors playwright.config.ts, which stays the single source of truth
 * for people running `npx playwright test` directly and accepting the slow
 * teardown.
 */
import { spawn, spawnSync } from 'node:child_process';

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;
const READY_TIMEOUT_MS = 180_000;

const serverEnv = {
  ...process.env,
  SQUARE_FAKE: '1',
  SANITY_FAKE: '1',
  NEXT_PUBLIC_SITE_URL: BASE_URL,
  NEXT_DIST_DIR: 'node_modules/.next-e2e',
};

// Next's own entry point, run directly — same reasoning as the config: every
// wrapper (npm, npx, a shell) is one more process whose child can get
// re-parented out of reach of the kill below.
const server = spawn(process.execPath, ['./node_modules/next/dist/bin/next', 'dev', '--port', String(PORT)], {
  env: serverEnv,
  // stdout dropped, stderr kept — a request log per test buries the results,
  // but a server that will not start says so on stderr.
  stdio: ['ignore', 'ignore', 'inherit'],
});

function killServerTree() {
  if (server.exitCode !== null) return;
  if (process.platform === 'win32') {
    // /T takes the whole tree; /F because SIGTERM semantics do not exist here
    // and this server holds no state worth a graceful goodbye. Absolute path:
    // some shells on this machine do not have System32 utilities on PATH.
    spawnSync(`${process.env.SystemRoot ?? 'C:\\Windows'}\\System32\\taskkill.exe`, [
      '/PID', String(server.pid), '/T', '/F',
    ], { stdio: 'ignore' });
  } else {
    server.kill('SIGTERM');
  }
}

// The server dying early (port taken, bad env) must fail the run loudly, not
// leave Playwright waiting the full readiness timeout for a corpse.
let serverExitedEarly = false;
server.on('exit', (code) => {
  serverExitedEarly = true;
  if (code !== 0 && code !== null) {
    console.error(`[e2e] web server exited before the run finished (code ${code})`);
  }
});

async function waitForReady() {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (serverExitedEarly) throw new Error('[e2e] web server died during startup');
    try {
      // Any HTTP answer means the server is up — even a 500 is a server.
      await fetch(BASE_URL, { redirect: 'manual' });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(`[e2e] web server not reachable at ${BASE_URL} within ${READY_TIMEOUT_MS}ms`);
}

// Ctrl-C and a killed shell both leave no orphan holding port 3100.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    killServerTree();
    process.exit(130);
  });
}

try {
  await waitForReady();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  killServerTree();
  process.exit(1);
}

// Arguments pass straight through, so `npm run test:e2e -- --grep shop` keeps
// working. E2E_EXTERNAL_SERVER tells the config to leave `webServer` out.
const playwright = spawn(
  process.execPath,
  ['./node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2)],
  {
    env: { ...process.env, E2E_EXTERNAL_SERVER: '1' },
    stdio: 'inherit',
  },
);

playwright.on('exit', (code) => {
  killServerTree();
  process.exit(code ?? 1);
});
