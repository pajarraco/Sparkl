import { describe, expect, it } from "vitest";
import {
  isOfferSuppressed,
  noteOfferShown,
  offerFingerprint,
  recordFinishOffers,
  recordOfferResponse,
  suppressedOffers,
} from "./solution-offers.js";
import { fakeStore } from "./solutions-fake.js";
import type { SolutionRow, SolutionsStore } from "./solutions-store.js";

const NOW = new Date("2026-10-30T09:00:00Z");
const HOST = "host-a";

let ids = 0;
const newId = () => `id-${++ids}`;

function offerRow(
  offer: "price_hint" | "usual_cleaner",
  overrides: Partial<SolutionRow> = {},
): SolutionRow {
  return {
    id: `offer-${offer}`,
    scope: "host",
    hostId: HOST,
    kind: "offer_preference",
    tags: [],
    payload: { offer },
    fingerprint: offerFingerprint(offer),
    source: "service",
    status: "candidate",
    proposed: 0,
    accepted: 0,
    rejected: 0,
    score: 0,
    lastAcceptedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

// Shows the offer in a session and answers it, as a turn and a finish would.
async function showAndIgnore(
  store: SolutionsStore,
  offer: "price_hint" | "usual_cleaner",
  sessionId: string,
) {
  await noteOfferShown(store, {
    hostId: HOST,
    sessionId,
    offer,
    at: NOW,
    newId,
  });
  await recordOfferResponse(store, {
    hostId: HOST,
    sessionId,
    offer,
    response: "ignored",
    at: NOW,
    newId,
  });
}

describe("noteOfferShown", () => {
  it("creates one host row per offer and logs a proposed event each session", async () => {
    const { store, rows, events } = fakeStore([]);
    await noteOfferShown(store, {
      hostId: HOST,
      sessionId: "s1",
      offer: "price_hint",
      at: NOW,
      newId,
    });
    await noteOfferShown(store, {
      hostId: HOST,
      sessionId: "s2",
      offer: "price_hint",
      at: NOW,
      newId,
    });
    expect(rows.filter((r) => r.kind === "offer_preference")).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      scope: "host",
      hostId: HOST,
      status: "candidate",
      payload: { offer: "price_hint" },
    });
    expect(events.filter((e) => e.event === "proposed")).toHaveLength(2);
  });
});

describe("offer suppression", () => {
  it("retires an offer after three ignores in a row, and only for that host", async () => {
    const { store, rows } = fakeStore([]);
    await showAndIgnore(store, "price_hint", "s1");
    await showAndIgnore(store, "price_hint", "s2");
    expect(await isOfferSuppressed(store, HOST, "price_hint")).toBe(false);
    await showAndIgnore(store, "price_hint", "s3");
    expect(await isOfferSuppressed(store, HOST, "price_hint")).toBe(true);
    expect(rows[0]?.status).toBe("retired");
    expect(await isOfferSuppressed(store, "host-b", "price_hint")).toBe(false);
  });

  it("does not suppress an offer the host has never seen", async () => {
    const { store } = fakeStore([]);
    expect(await isOfferSuppressed(store, HOST, "usual_cleaner")).toBe(false);
  });

  it("lists the suppressed offers", async () => {
    const { store } = fakeStore([
      offerRow("price_hint", { status: "retired" }),
      offerRow("usual_cleaner"),
    ]);
    expect([...(await suppressedOffers(store, HOST))]).toEqual(["price_hint"]);
  });

  it("shows every offer when the store fails", async () => {
    const { store } = fakeStore([
      offerRow("price_hint", { status: "retired" }),
    ]);
    store.listForHost = async () => {
      throw new Error("db down");
    };
    store.findByFingerprint = async () => {
      throw new Error("db down");
    };
    expect([...(await suppressedOffers(store, HOST))]).toEqual([]);
  });
});

describe("recordOfferResponse", () => {
  it("activates a candidate offer the host accepts", async () => {
    const { store, rows } = fakeStore([]);
    await noteOfferShown(store, {
      hostId: HOST,
      sessionId: "s1",
      offer: "usual_cleaner",
      at: NOW,
      newId,
    });
    await recordOfferResponse(store, {
      hostId: HOST,
      sessionId: "s1",
      offer: "usual_cleaner",
      response: "accepted",
      at: NOW,
      newId,
    });
    expect(rows[0]?.status).toBe("active");
  });

  it("ignores an answer for an offer that was not shown in the session", async () => {
    const { store, events } = fakeStore([offerRow("price_hint")]);
    await recordOfferResponse(store, {
      hostId: HOST,
      sessionId: "s1",
      offer: "price_hint",
      response: "ignored",
      at: NOW,
      newId,
    });
    expect(events).toEqual([]);
  });
});

describe("recordFinishOffers", () => {
  it("reads the pin as accepted and the client's price response", async () => {
    const { store, rows } = fakeStore([]);
    await noteOfferShown(store, {
      hostId: HOST,
      sessionId: "s1",
      offer: "price_hint",
      at: NOW,
      newId,
    });
    await noteOfferShown(store, {
      hostId: HOST,
      sessionId: "s1",
      offer: "usual_cleaner",
      at: NOW,
      newId,
    });
    await recordFinishOffers(store, {
      hostId: HOST,
      sessionId: "s1",
      priceHintResponse: "accepted",
      usualCleanerPinned: true,
      at: NOW,
      newId,
    });
    const byOffer = Object.fromEntries(
      rows.map((r) => [(r.payload as { offer: string }).offer, r.status]),
    );
    expect(byOffer).toEqual({ price_hint: "active", usual_cleaner: "active" });
  });

  it("counts an unpinned usual cleaner as ignored, and skips the price when no response is sent", async () => {
    const { store, rows, events } = fakeStore([]);
    await noteOfferShown(store, {
      hostId: HOST,
      sessionId: "s1",
      offer: "price_hint",
      at: NOW,
      newId,
    });
    await noteOfferShown(store, {
      hostId: HOST,
      sessionId: "s1",
      offer: "usual_cleaner",
      at: NOW,
      newId,
    });
    await recordFinishOffers(store, {
      hostId: HOST,
      sessionId: "s1",
      priceHintResponse: undefined,
      usualCleanerPinned: false,
      at: NOW,
      newId,
    });
    const usual = rows.find(
      (r) => (r.payload as { offer: string }).offer === "usual_cleaner",
    );
    const votes = events.filter((e) => e.event !== "proposed");
    expect(votes).toHaveLength(1);
    expect(votes[0]).toMatchObject({
      solutionId: usual?.id,
      event: "rejected",
    });
  });
});
