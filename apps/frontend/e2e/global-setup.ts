import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// Playwright global setup: wipe obviously-fake E2E rows before the suites
// run, so the ranked board (paged at 20) cannot fill up with yesterday's
// seeded jobs and crowd out today's. Local-only, like the rest of E2E.
export default async function globalSetup(): Promise<void> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const apiDir = path.resolve(here, "..", "..", "api");
  const { stdout } = await execFileAsync("node", ["scripts/clean-e2e.mjs"], {
    cwd: apiDir,
  });
  console.log(stdout.trim());
}
