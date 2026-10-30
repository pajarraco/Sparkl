// Demo seed for the solutions store (04 L1 step 9): three obviously fake
// global checklists and three FAQ entries, so find_solutions ranks something
// on the first run. Every text starts with [DEMO]; replace the FAQ answers
// with the owner's real policy before any real host sees them. Vote counters
// are seeded directly because no session exists to hang events on. Reruns skip
// anything already present by fingerprint and never change or delete rows.
// Run: pnpm --filter @sparkl/api seed:solutions
import { randomUUID } from "node:crypto";
import { SOLUTION_RANKING_CONFIG, type SolutionTag } from "@sparkl/shared";
import { connection, db } from "../src/db/client.js";
import { assistantSolutions } from "../src/db/schema.js";
import { drizzleSolutionsStore } from "../src/db/stores.js";
import {
  checkPersonalData,
  payloadFingerprint,
} from "../src/services/solution-rules.js";

interface SeedRow {
  kind: "checklist" | "faq";
  tags: SolutionTag[];
  payload: { items: string[] } | { question: string; answer: string };
  accepted: number;
  rejected: number;
}

const SEEDS: SeedRow[] = [
  {
    kind: "checklist",
    tags: ["turnover"],
    payload: {
      items: [
        "[DEMO] Strip the beds and load the linen",
        "[DEMO] Wipe the kitchen surfaces",
        "[DEMO] Empty the bins",
        "[DEMO] Vacuum the living area",
      ],
    },
    accepted: 9,
    rejected: 1,
  },
  {
    kind: "checklist",
    tags: ["deep_clean", "pets"],
    payload: {
      items: [
        "[DEMO] Descale the kettle",
        "[DEMO] Clean the oven door glass",
        "[DEMO] Mop the bathroom floor",
        "[DEMO] Wipe the skirting boards",
      ],
    },
    accepted: 4,
    rejected: 0,
  },
  {
    kind: "checklist",
    tags: ["studio"],
    payload: {
      items: [
        "[DEMO] Make the bed",
        "[DEMO] Clean the bathroom sink",
        "[DEMO] Wipe the balcony table",
      ],
    },
    accepted: 2,
    rejected: 3,
  },
  {
    kind: "faq",
    tags: [],
    payload: {
      question: "[DEMO] Do you bring cleaning products?",
      answer:
        "[DEMO] Sample answer for the demo only. Replace with the real policy.",
    },
    accepted: 0,
    rejected: 0,
  },
  {
    kind: "faq",
    tags: [],
    payload: {
      question: "[DEMO] Can cleaners work while I am away?",
      answer:
        "[DEMO] Sample answer for the demo only. Replace with the real policy.",
    },
    accepted: 0,
    rejected: 0,
  },
  {
    kind: "faq",
    tags: [],
    payload: {
      question: "[DEMO] How do cancellations work?",
      answer:
        "[DEMO] Sample answer for the demo only. Replace with the real policy.",
    },
    accepted: 0,
    rejected: 0,
  },
];

function textsOf(seed: SeedRow): string[] {
  return seed.kind === "checklist"
    ? (seed.payload as { items: string[] }).items
    : [
        (seed.payload as { question: string }).question,
        (seed.payload as { answer: string }).answer,
      ];
}

const store = drizzleSolutionsStore(db);
const now = new Date();

try {
  for (const seed of SEEDS) {
    const privacy = checkPersonalData(textsOf(seed), []);
    if (!privacy.ok)
      throw new Error(
        `seed refused by the personal-data check: ${privacy.reasons.join(", ")}`,
      );

    const fingerprint = payloadFingerprint(seed.kind, seed.payload);
    if (await store.findByFingerprint("global", null, fingerprint)) {
      console.log(`skip ${seed.kind} (present) ${fingerprint.slice(0, 12)}`);
      continue;
    }
    const votes = {
      accepted: seed.accepted,
      rejected: seed.rejected,
      lastAcceptedAt: seed.accepted > 0 ? now : null,
    };
    const wilsonInput = seed.accepted + seed.rejected;
    console.log(
      `add ${seed.kind} ${fingerprint.slice(0, 12)} votes ${wilsonInput}`,
    );
    await db.insert(assistantSolutions).values({
      id: randomUUID(),
      scope: "global",
      hostId: null,
      kind: seed.kind,
      tags: seed.tags,
      payload: seed.payload,
      fingerprint,
      source: "seed",
      status: "active",
      accepted: votes.accepted,
      rejected: votes.rejected,
      lastAcceptedAt: votes.lastAcceptedAt,
      createdAt: now,
      updatedAt: now,
    });
  }
  console.log(`done (wilsonZ ${SOLUTION_RANKING_CONFIG.wilsonZ})`);
} finally {
  await connection.end();
}
