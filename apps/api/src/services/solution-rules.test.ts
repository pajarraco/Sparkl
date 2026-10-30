import { describe, expect, it } from "vitest";
import {
  type RankableSolution,
  checkPersonalData,
  payloadFingerprint,
  rankSolutions,
  recencyFactor,
  solutionScore,
  wilsonLowerBound,
} from "./solution-rules.js";

const NOW = new Date("2026-10-30T00:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function solution(
  overrides: Partial<RankableSolution> & Pick<RankableSolution, "id">,
): RankableSolution {
  return {
    kind: "checklist",
    scope: "global",
    hostId: null,
    status: "active",
    tags: [],
    accepted: 0,
    rejected: 0,
    lastAcceptedAt: NOW,
    ...overrides,
  };
}

describe("wilsonLowerBound", () => {
  it("should be 0 with no votes", () => {
    expect(wilsonLowerBound(0, 0)).toBe(0);
  });

  it("should rank 9 of 10 above 1 of 1", () => {
    expect(wilsonLowerBound(9, 10)).toBeGreaterThan(wilsonLowerBound(1, 1));
  });

  it("should stay within 0 and 1 and grow with more agreeing votes", () => {
    const small = wilsonLowerBound(3, 4);
    const large = wilsonLowerBound(30, 40);
    expect(small).toBeGreaterThan(0);
    expect(large).toBeLessThanOrEqual(1);
    expect(large).toBeGreaterThan(small);
  });
});

describe("recencyFactor", () => {
  it("should be 1 when accepted now and 0 when never accepted", () => {
    expect(recencyFactor(NOW, NOW)).toBe(1);
    expect(recencyFactor(null, NOW)).toBe(0);
  });

  it("should halve every 30 days", () => {
    const thirtyDaysAgo = new Date(NOW.getTime() - 30 * DAY);
    expect(recencyFactor(thirtyDaysAgo, NOW)).toBeCloseTo(0.5, 10);
  });

  it("should not go above 1 for a future timestamp", () => {
    const later = new Date(NOW.getTime() + DAY);
    expect(recencyFactor(later, NOW)).toBe(1);
  });
});

describe("solutionScore", () => {
  it("should ignore proposals because they are not an input", () => {
    const votes = { accepted: 2, rejected: 0, lastAcceptedAt: NOW };
    expect(solutionScore(votes, NOW)).toBe(
      wilsonLowerBound(2, 2) * recencyFactor(NOW, NOW),
    );
  });

  it("should let a shown-often, rejected-often answer sink", () => {
    const liked = solutionScore(
      { accepted: 8, rejected: 2, lastAcceptedAt: NOW },
      NOW,
    );
    const disliked = solutionScore(
      { accepted: 1, rejected: 9, lastAcceptedAt: NOW },
      NOW,
    );
    expect(liked).toBeGreaterThan(disliked);
  });

  it("should lower an old acceptance", () => {
    const fresh = solutionScore(
      { accepted: 5, rejected: 0, lastAcceptedAt: NOW },
      NOW,
    );
    const stale = solutionScore(
      {
        accepted: 5,
        rejected: 0,
        lastAcceptedAt: new Date(NOW.getTime() - 60 * DAY),
      },
      NOW,
    );
    expect(stale).toBeLessThan(fresh);
  });
});

describe("rankSolutions", () => {
  const base = {
    hostId: "host-a",
    kind: "checklist" as const,
    tags: [] as const,
    now: NOW,
    rejectedByHost: new Set<string>(),
  };

  it("should put the host's own solutions before any global one", () => {
    const ranked = rankSolutions(
      [
        solution({ id: "global-best", accepted: 50, rejected: 0 }),
        solution({
          id: "own-weak",
          scope: "host",
          hostId: "host-a",
          accepted: 1,
          rejected: 1,
        }),
      ],
      base,
    );
    expect(ranked.map((r) => r.solution.id)).toEqual([
      "own-weak",
      "global-best",
    ]);
  });

  it("should never return another host's rows", () => {
    const ranked = rankSolutions(
      [
        solution({
          id: "host-b-row",
          scope: "host",
          hostId: "host-b",
          accepted: 9,
        }),
      ],
      base,
    );
    expect(ranked).toEqual([]);
  });

  it("should skip global rows this host rejected", () => {
    const ranked = rankSolutions(
      [
        solution({ id: "g1", accepted: 9 }),
        solution({ id: "g2", accepted: 1 }),
      ],
      { ...base, rejectedByHost: new Set(["g1"]) },
    );
    expect(ranked.map((r) => r.solution.id)).toEqual(["g2"]);
  });

  it("should skip candidates, retired rows and other kinds", () => {
    const ranked = rankSolutions(
      [
        solution({ id: "cand", status: "candidate", accepted: 9 }),
        solution({ id: "gone", status: "retired", accepted: 9 }),
        solution({ id: "faq", kind: "faq", accepted: 9 }),
        solution({ id: "ok", accepted: 1 }),
      ],
      base,
    );
    expect(ranked.map((r) => r.solution.id)).toEqual(["ok"]);
  });

  it("should order by score, then tag overlap, then id", () => {
    const ranked = rankSolutions(
      [
        solution({ id: "b", accepted: 3, rejected: 0, tags: ["pets"] }),
        solution({ id: "a", accepted: 3, rejected: 0, tags: ["pets"] }),
        solution({ id: "c", accepted: 3, rejected: 0, tags: ["linen"] }),
        solution({ id: "top", accepted: 9, rejected: 0, tags: [] }),
      ],
      { ...base, tags: ["pets"] },
    );
    expect(ranked.map((r) => r.solution.id)).toEqual(["top", "a", "b"]);
  });

  it("should cap the result at topK", () => {
    const many = Array.from({ length: 6 }, (_, i) =>
      solution({ id: `g${i}`, accepted: i + 1 }),
    );
    expect(rankSolutions(many, base)).toHaveLength(3);
  });
});

describe("checkPersonalData", () => {
  const clean = (text: string) =>
    expect(checkPersonalData([text], [])).toEqual({ ok: true });
  const flagged = (text: string, names: string[], reason: string) => {
    const result = checkPersonalData([text], names);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasons).toContain(reason);
  };

  it("should pass ordinary checklist items", () => {
    clean("Wipe the hob and the splashback");
    clean("Vacuum under the sofa");
    clean("Check the bins are out on Thursday");
  });

  it("should refuse an email address", () => {
    flagged("Email me at jo@example.com", [], "email");
  });

  it("should refuse a URL", () => {
    flagged("See https://example.com/code", [], "url");
    flagged("Look at www.example.org", [], "url");
    flagged("Visit cleanpro.com.au", [], "url");
  });

  it("should refuse a phone number, with or without spaces", () => {
    flagged("Call 0412 345 678 first", [], "phone");
    flagged("Ring +61 412-345-678", [], "phone");
  });

  it("should refuse any run of 4 or more digits", () => {
    flagged("Lockbox 1234", [], "digits");
    flagged("Gate code 9087", [], "digits");
  });

  it("should allow short numbers like a room count", () => {
    clean("Clean 3 bedrooms and 2 bathrooms");
  });

  it("should refuse a street address: number next to a street type", () => {
    flagged("Park in 12 Smith Street", [], "address");
    flagged("Keys left at Ocean Ave 4", [], "address");
  });

  it("should refuse the host's and cleaners' names, whole word only", () => {
    flagged("Ask Maria to check the oven", ["Maria"], "name");
    flagged("ask maria", ["Maria"], "name");
    clean("The mariachi band is loud");
  });

  it("should ignore names that are too short to match safely", () => {
    clean("Dust the a shelves");
    expect(checkPersonalData(["Dust the a shelves"], ["a"])).toEqual({
      ok: true,
    });
  });

  it("should check every text in the payload and list each reason once", () => {
    const result = checkPersonalData(
      ["jo@example.com", "lockbox 1234", "jo again"],
      ["Jo"],
    );
    expect(result).toEqual({
      ok: false,
      reasons: ["email", "url", "digits", "name"],
    });
  });
});

describe("payloadFingerprint", () => {
  it("should match the same checklist with different case and spacing", () => {
    const a = payloadFingerprint("checklist", {
      items: ["Wipe the hob", "Vacuum  the rugs"],
    });
    const b = payloadFingerprint("checklist", {
      items: ["  wipe the HOB ", "vacuum the rugs"],
    });
    expect(a).toBe(b);
  });

  it("should differ when the item order changes", () => {
    const a = payloadFingerprint("checklist", { items: ["Mop", "Dust"] });
    const b = payloadFingerprint("checklist", { items: ["Dust", "Mop"] });
    expect(a).not.toBe(b);
  });

  it("should differ across kinds with the same payload", () => {
    const payload = { items: ["Mop"] };
    expect(payloadFingerprint("checklist", payload)).not.toBe(
      payloadFingerprint("window_preference", payload),
    );
  });

  it("should ignore key order inside an object", () => {
    const a = payloadFingerprint("faq", { question: "Q?", answer: "A." });
    const b = payloadFingerprint("faq", { answer: "A.", question: "Q?" });
    expect(a).toBe(b);
  });

  it("should return a 64-character hex sha256", () => {
    expect(payloadFingerprint("faq", { question: "Q", answer: "A" })).toMatch(
      /^[0-9a-f]{64}$/,
    );
  });
});
