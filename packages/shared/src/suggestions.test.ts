import { describe, expect, it } from "vitest";
import {
  RANKING_WEIGHTS_FLAG,
  RANKING_WEIGHTS_V1,
  RANKING_WEIGHTS_V2,
  rankJobsOutputSchema,
  rankingWeightsSchema,
  suggestCleanersInput,
} from "./suggestions.js";

function sum(weights: Record<string, number>): number {
  return Object.values(weights).reduce((a, b) => a + b, 0);
}

describe("ranking contract", () => {
  it("both weight sets sum to 1 and satisfy the schema", () => {
    expect(sum({ ...RANKING_WEIGHTS_V1 })).toBeCloseTo(1);
    expect(sum({ ...RANKING_WEIGHTS_V2 })).toBeCloseTo(1);
    expect(rankingWeightsSchema.parse(RANKING_WEIGHTS_V1)).toEqual(
      RANKING_WEIGHTS_V1,
    );
    expect(rankingWeightsSchema.parse(RANKING_WEIGHTS_V2)).toEqual(
      RANKING_WEIGHTS_V2,
    );
  });

  it("rejects weights that do not sum to 1", () => {
    expect(() =>
      rankingWeightsSchema.parse({ ...RANKING_WEIGHTS_V1, rating: 0.9 }),
    ).toThrow("ranking weights must sum to 1");
  });

  it("exposes the Unleash flag name and paginated input defaults", () => {
    expect(RANKING_WEIGHTS_FLAG).toBe("ranking-weights-v2");
    expect(
      suggestCleanersInput.parse({
        jobId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toEqual({
      jobId: "11111111-1111-4111-8111-111111111111",
      limit: 20,
      offset: 0,
    });
  });

  it("accepts an empty ranked board page", () => {
    expect(rankJobsOutputSchema.parse({ jobs: [], total: 0 })).toEqual({
      jobs: [],
      total: 0,
    });
  });
});
