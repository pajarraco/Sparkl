// Local boot helper behind `pnpm dev` (see root package.json): install
// deps, start Postgres/Redis/MinIO, apply Drizzle migrations, ensure
// buckets, then hand back so pnpm starts the API + Expo dev servers.
// Fails fast with a hint when Docker or the database is unavailable;
// a bucket failure only warns (uploads are not needed for the basic
// host flow) so MinIO trouble never blocks the app itself.
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = join(import.meta.dirname, "..");

// Minimal .env parsing (no dependency): KEY=VALUE lines, # comments and
// blanks skipped, surrounding quotes stripped. Existing environment
// variables win over the file. Inline comments are NOT stripped so
// secrets containing # survive intact.
export function parseEnvFile(text) {
  const vars = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key !== "") vars[key] = value;
  }
  return vars;
}

export function loadLocalEnv() {
  const path = join(ROOT, ".env");
  if (!existsSync(path)) {
    console.log("no .env found — copy .env.example to .env for local defaults");
    return;
  }
  const vars = parseEnvFile(readFileSync(path, "utf8"));
  for (const [key, value] of Object.entries(vars)) {
    process.env[key] ??= value;
  }
}

function run(label, command) {
  console.log(`\n### ${label}\n$ ${command}`);
  execSync(command, { stdio: "inherit", cwd: ROOT });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retry(label, command, tries, delayMs) {
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      run(`${label} (attempt ${attempt}/${tries})`, command);
      return;
    } catch (err) {
      if (attempt === tries) throw err;
      await sleep(delayMs);
    }
  }
}

async function main() {
  loadLocalEnv();

  run("install dependencies", "pnpm install");

  try {
    run(
      "start local services",
      "docker compose -f docker-compose.dev.yml up -d",
    );
  } catch {
    console.error(
      "Docker is unavailable — start Docker Desktop, then run `pnpm dev` again.",
    );
    process.exit(1);
  }

  try {
    await retry(
      "apply database migrations",
      "pnpm --filter @sparkl/api exec drizzle-kit migrate",
      30,
      2000,
    );
  } catch {
    console.error(
      "Migrations failed — is Postgres up? Try `docker compose -f docker-compose.dev.yml ps`.",
    );
    process.exit(1);
  }

  try {
    await retry(
      "ensure storage buckets",
      "pnpm --filter @sparkl/api buckets",
      15,
      2000,
    );
  } catch {
    console.warn(
      "WARNING: buckets unavailable — continuing without MinIO. " +
        "Uploads will fail until `pnpm --filter @sparkl/api buckets` passes.",
    );
  }

  console.log("\nlocal infra ready — starting dev servers");
}

// Main guard so the pure helpers stay importable without booting infra.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
