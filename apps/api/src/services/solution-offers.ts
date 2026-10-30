// Framework-free business logic: no drizzle/fastify imports allowed here.
// Offer learning (04 L1 step 7): the 02 price hint and the usual-cleaner
// suggestion are stored as one host-scope `offer_preference` row per offer.
// An offer the host ignores three times in a row is retired by the same rule
// as any solution, and then it is no longer shown. Offers are facts the
// service computes; only whether the host takes them is learned.
import { SOLUTION_OFFERS, type SolutionOffer } from "@sparkl/shared";
import { applyVote } from "./solution-feedback.js";
import { payloadFingerprint } from "./solution-rules.js";
import type { SolutionRow, SolutionsStore } from "./solutions-store.js";

export function offerFingerprint(offer: SolutionOffer): string {
  return payloadFingerprint("offer_preference", { offer });
}

async function offerRow(
  store: SolutionsStore,
  hostId: string,
  offer: SolutionOffer,
): Promise<SolutionRow | null> {
  return store.findByFingerprint("host", hostId, offerFingerprint(offer));
}

// True once the host has ignored this offer enough times in a row to retire
// it. Offers the host has never seen are not suppressed.
export async function isOfferSuppressed(
  store: SolutionsStore,
  hostId: string,
  offer: SolutionOffer,
): Promise<boolean> {
  const row = await offerRow(store, hostId, offer);
  return row?.status === "retired";
}

// The offers this host has retired. A store failure shows every offer: the
// suppression is a convenience, never a reason to fail the turn.
export async function suppressedOffers(
  store: SolutionsStore,
  hostId: string,
): Promise<Set<SolutionOffer>> {
  const suppressed = new Set<SolutionOffer>();
  try {
    for (const offer of SOLUTION_OFFERS) {
      if (await isOfferSuppressed(store, hostId, offer)) suppressed.add(offer);
    }
  } catch {
    return new Set();
  }
  return suppressed;
}

// Called when an offer is put in front of the host this session. Creates the
// row on first sight and logs a proposed event, so a later answer counts.
export async function noteOfferShown(
  store: SolutionsStore,
  args: {
    hostId: string;
    sessionId: string;
    offer: SolutionOffer;
    at: Date;
    newId: () => string;
  },
): Promise<void> {
  let row = await offerRow(store, args.hostId, args.offer);
  if (!row) {
    await store.insert({
      id: args.newId(),
      scope: "host",
      hostId: args.hostId,
      kind: "offer_preference",
      tags: [],
      payload: { offer: args.offer },
      fingerprint: offerFingerprint(args.offer),
      source: "service",
      status: "candidate",
      at: args.at,
    });
    row = await offerRow(store, args.hostId, args.offer);
  }
  if (!row) return;
  await store.recordEvent({
    id: args.newId(),
    solutionId: row.id,
    sessionId: args.sessionId,
    hostId: args.hostId,
    event: "proposed",
    at: args.at,
  });
}

// Records the host's answer to an offer shown in this session. Ignored when
// the offer was not shown in the session, or already answered there.
export async function recordOfferResponse(
  store: SolutionsStore,
  args: {
    hostId: string;
    sessionId: string;
    offer: SolutionOffer;
    response: "accepted" | "ignored";
    at: Date;
    newId: () => string;
  },
): Promise<void> {
  const row = await offerRow(store, args.hostId, args.offer);
  if (!row) return;
  const shown = await store.proposedSolutionIds(args.sessionId, args.hostId);
  if (!shown.includes(row.id)) return;
  const voted = await store.votedSolutionIds(args.sessionId);
  if (voted.includes(row.id)) return;
  await applyVote({
    store,
    solution: row,
    sessionId: args.sessionId,
    hostId: args.hostId,
    vote: args.response === "accepted" ? "accepted" : "rejected",
    at: args.at,
    newId: args.newId,
  });
}

// At finish, for a posted job. The price hint is answered by the client's
// response; the usual cleaner counts as accepted when the job kept the pin.
export async function recordFinishOffers(
  store: SolutionsStore,
  args: {
    hostId: string;
    sessionId: string;
    priceHintResponse: "accepted" | "ignored" | undefined;
    usualCleanerPinned: boolean;
    at: Date;
    newId: () => string;
  },
): Promise<void> {
  if (args.priceHintResponse !== undefined) {
    await recordOfferResponse(store, {
      hostId: args.hostId,
      sessionId: args.sessionId,
      offer: "price_hint",
      response: args.priceHintResponse,
      at: args.at,
      newId: args.newId,
    });
  }
  await recordOfferResponse(store, {
    hostId: args.hostId,
    sessionId: args.sessionId,
    offer: "usual_cleaner",
    response: args.usualCleanerPinned ? "accepted" : "ignored",
    at: args.at,
    newId: args.newId,
  });
}
