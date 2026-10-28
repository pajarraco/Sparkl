// Local-dev helper: delete obviously-fake E2E rows so Playwright suites
// start from a small, deterministic pool (the ranked board pages at 20, so
// yesterday's fake jobs would otherwise crowd out today's seeded ones).
// Matches the `E2E ...` address convention in apps/frontend/e2e/fixtures.ts
// (plus older `*E2E*` probe rows). Messages and reviews cascade off jobs;
// fake accounts are left alone (tiny, harmless).
// Run: pnpm --filter @sparkl/api clean:e2e
import postgres from "postgres";

const sql = postgres(
  process.env.DATABASE_URL ?? "postgres://sparkl:sparkl@localhost:5432/sparkl",
);
const deleted = await sql`
  DELETE FROM jobs WHERE address LIKE '%E2E%' RETURNING id
`;
console.log(
  `clean:e2e deleted ${deleted.length} fake job(s) (messages/reviews cascade).`,
);
await sql.end();
