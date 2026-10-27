import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadEnvFile, parseEnvFile } from "./env.js";

describe("parseEnvFile", () => {
  it("parses assignments and skips comments, blanks and keyless lines", () => {
    expect(
      parseEnvFile(
        "# comment\n\nDATABASE_URL=postgres://a:b@localhost:5432/x\nEMPTY=\nNOEQUALS\n",
      ),
    ).toEqual({
      DATABASE_URL: "postgres://a:b@localhost:5432/x",
      EMPTY: "",
    });
  });

  it("strips quotes but keeps # inside quoted values", () => {
    expect(parseEnvFile("A=\"hello # kept\"\nB='q'\n")).toEqual({
      A: "hello # kept",
      B: "q",
    });
  });
});

describe("loadEnvFile", () => {
  it("fills missing vars from the file without overriding the environment", () => {
    const dir = mkdtempSync(join(tmpdir(), "sparkl-env-"));
    try {
      const file = join(dir, ".env");
      writeFileSync(file, "SPARKL_TEST_A=from-file\nSPARKL_TEST_B=from-file\n");
      process.env.SPARKL_TEST_B = "from-env";
      loadEnvFile(file);
      expect(process.env.SPARKL_TEST_A).toBe("from-file");
      expect(process.env.SPARKL_TEST_B).toBe("from-env");
    } finally {
      // biome-ignore lint/performance/noDelete: unsetting is required; assigning undefined stores the truthy string "undefined".
      delete process.env.SPARKL_TEST_A;
      // biome-ignore lint/performance/noDelete: unsetting is required; assigning undefined stores the truthy string "undefined".
      delete process.env.SPARKL_TEST_B;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("ignores a missing file", () => {
    expect(() =>
      loadEnvFile(join(tmpdir(), "sparkl-env-missing", ".env")),
    ).not.toThrow();
  });
});
