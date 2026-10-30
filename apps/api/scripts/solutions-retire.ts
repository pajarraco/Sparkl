// Owner tool (04 L1 step 6): retire one global shared solution so the
// assistant never proposes it again. Host rows cannot be retired here.
// Usage: pnpm --filter @sparkl/api solutions:retire <solution-id>
import { connection, db } from "../src/db/client.js";
import { drizzleSolutionsStore } from "../src/db/stores.js";
import { retireGlobalSolution } from "../src/services/solution-sharing.js";

const id = process.argv[2];
if (!id) {
  console.error(
    "usage: pnpm --filter @sparkl/api solutions:retire <solution-id>",
  );
  process.exit(2);
}

try {
  const result = await retireGlobalSolution(drizzleSolutionsStore(db), {
    id,
    at: new Date(),
  });
  if (result.ok) {
    console.log(`retired ${id}`);
  } else {
    console.error(`${result.code}: ${result.message}`);
    process.exitCode = 1;
  }
} finally {
  await connection.end();
}
