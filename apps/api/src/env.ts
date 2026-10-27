// Loads the repo-root .env into process.env on import (dev convenience:
// `pnpm dev` starts long-lived servers that never inherit the setup
// script's own environment). Production sets real variables instead —
// those always win, and a missing .env file is a no-op, never an error.
// Imported for side effects by modules that read env at top level
// (db/client.ts, plugins/auth.ts); any position in their import list
// works, because imports always evaluate before the importing module's
// own top-level statements, so this is formatter-reorder safe.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Minimal .env parsing (no dependency): KEY=VALUE lines, # comments and
// blanks skipped, surrounding quotes stripped. Inline comments are NOT
// stripped so secrets containing # survive intact.
export function parseEnvFile(text: string): Record<string, string> {
  const vars: Record<string, string> = {};
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

export function rootEnvPath(): string {
  return join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "..",
    ".env",
  );
}

export function loadEnvFile(path?: string): void {
  const file = path ?? rootEnvPath();
  if (!existsSync(file)) return;
  const vars = parseEnvFile(readFileSync(file, "utf8"));
  for (const [key, value] of Object.entries(vars)) {
    process.env[key] ??= value;
  }
}

loadEnvFile();
