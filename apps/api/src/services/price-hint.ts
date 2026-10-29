// Framework-free business logic: no drizzle/fastify imports allowed here.
// Price hint for the post-tab assistant (02 P2). The median of comparable
// jobs nearby (similar size, within the radius), or a rate per m² from the
// weights config when there are too few comparables. The host always sets
// the final price; this only informs the suggestion.
import {
  type Job,
  PRICE_HINT_CONFIG,
  type PriceHint,
  type PriceHintConfig,
} from "@sparkl/shared";
import { haversineKm } from "./jobs.js";

export interface PriceQuery {
  sizeSqm: number;
  latitude: number;
  longitude: number;
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? 0;
  return Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2);
}

// Comparables: a positive price, a known size within the tolerance of the
// query, and a location within the radius. Jobs without a size are skipped
// because a price cannot be compared without one.
export function comparableJobs(
  query: PriceQuery,
  pool: Job[],
  config: PriceHintConfig = PRICE_HINT_CONFIG,
): Job[] {
  return pool.filter((job) => {
    if (job.priceMinorUnits <= 0 || job.sizeSqm === null) return false;
    const sizeGap = Math.abs(job.sizeSqm - query.sizeSqm) / query.sizeSqm;
    if (sizeGap > config.sizeTolerance) return false;
    const distanceKm = haversineKm(
      query.latitude,
      query.longitude,
      job.latitude,
      job.longitude,
    );
    return distanceKm <= config.radiusKm;
  });
}

export function suggestPriceHint(
  query: PriceQuery,
  pool: Job[],
  config: PriceHintConfig = PRICE_HINT_CONFIG,
): PriceHint {
  const comparables = comparableJobs(query, pool, config);
  if (comparables.length >= config.minComparables) {
    return {
      medianMinorUnits: median(comparables.map((j) => j.priceMinorUnits)),
      comparables: comparables.length,
      source: "comparables",
    };
  }
  return {
    medianMinorUnits: Math.round(query.sizeSqm * config.perSqmMinorUnits),
    comparables: comparables.length,
    source: "per_sqm",
  };
}
