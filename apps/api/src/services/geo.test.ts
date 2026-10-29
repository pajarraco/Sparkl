import { type GeoPlace, SPARKL_ERROR_CODES } from "@sparkl/shared";
import { describe, expect, it, vi } from "vitest";
import {
  GEO_DEFAULTS,
  GeoError,
  type GeoProviderClient,
  createGeoService,
  createGeoServiceFromEnv,
  createOsmProvider,
  createTtlCache,
  normalizeQuery,
  parseNominatimItem,
  parseNominatimSearch,
  parsePhoton,
  photonLabel,
} from "./geo.js";
import {
  RateLimitError,
  type Throttle,
  createUserRateLimiter,
} from "./rate-limit.js";

const noWait: Throttle = { wait: async () => {} };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const PHOTON = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        osm_type: "W",
        osm_id: 1082668130,
        housenumber: "12",
        street: "Ocean Street North",
        district: "Bondi",
        city: "Sydney",
        state: "New South Wales",
        country: "Australia",
        postcode: "2026",
      },
      geometry: { type: "Point", coordinates: [151.2633431, -33.8909546] },
    },
  ],
};
const NOMINATIM_ITEM = {
  place_id: 23484606,
  osm_type: "way",
  osm_id: 1082668130,
  lat: "-33.8909546",
  lon: "151.2633431",
  display_name:
    "12, Ocean Street North, Bondi, Eastern Suburbs, Sydney, New South Wales, 2026, Australia",
};
const PLACE = {
  id: "osm:W1082668130",
  label:
    "12 Ocean Street North, Bondi, Sydney, New South Wales, 2026, Australia",
  latitude: -33.8909546,
  longitude: 151.2633431,
};

describe("parsers", () => {
  it("parsePhoton", () => {
    expect(parsePhoton(PHOTON)).toEqual([PLACE]);
  });

  it("photonLabel", () => {
    expect(
      photonLabel({
        name: "Bondi Pavilion",
        street: "Queen Elizabeth Drive",
        city: "Sydney",
      }),
    ).toBe("Bondi Pavilion, Queen Elizabeth Drive, Sydney");
    expect(photonLabel({})).toBeUndefined();
  });

  it("parsePhoton edge cases", () => {
    // Helper to create bad photon input without mutating shared fixture
    function photonWith(
      props: Record<string, unknown>,
      coordinates: number[] | null,
    ) {
      return {
        features: [
          {
            properties: { ...PHOTON.features[0]?.properties, ...props },
            ...(coordinates ? { geometry: { coordinates } } : {}),
          },
        ],
      };
    }

    // Test bad osm_type
    expect(
      parsePhoton(photonWith({ osm_type: "X" }, [151.26, -33.89])),
    ).toEqual([]);

    // Test no geometry
    expect(parsePhoton(photonWith({}, null))).toEqual([]);

    // Test invalid coordinates
    expect(parsePhoton(photonWith({}, [151.26, 95]))).toEqual([]);

    // Test null input
    expect(parsePhoton(null)).toEqual([]);

    // Test empty features array
    expect(parsePhoton({})).toEqual([]);

    // Test invalid features type
    expect(parsePhoton({ features: "x" })).toEqual([]);
  });

  it("parseNominatimItem", () => {
    const result = parseNominatimItem(NOMINATIM_ITEM);
    expect(result).toEqual({
      id: "osm:W1082668130",
      label:
        "12, Ocean Street North, Bondi, Eastern Suburbs, Sydney, New South Wales, 2026, Australia",
      latitude: -33.8909546,
      longitude: 151.2633431,
    });
  });

  it("parseNominatimItem error cases", () => {
    expect(parseNominatimItem({ error: "Unable to geocode" })).toBeNull();
    expect(parseNominatimSearch("x")).toEqual([]);
    const result = parseNominatimSearch([NOMINATIM_ITEM, { osm_type: "node" }]);
    expect(result).toHaveLength(1);
  });

  it("normalizeQuery", () => {
    expect(normalizeQuery("  12 OCEAN st,   bondi ")).toBe(
      "12 ocean st, bondi",
    );
  });
});

describe("createOsmProvider", () => {
  it("autocomplete", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValueOnce(jsonResponse(PHOTON));

    const provider = createOsmProvider({
      fetch: fetchMock,
      photonThrottle: noWait,
      nominatimThrottle: noWait,
      userAgent: "Sparkl-test/1.0",
    });

    const result = await provider.autocomplete({
      query: "12 Ocean St Bondi",
      limit: 3,
    });

    expect(result).toEqual([PLACE]);

    // Check URL and headers
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    const parsedUrl = new URL(String(url));
    expect(parsedUrl.host).toBe("photon.komoot.io");
    expect(parsedUrl.pathname).toBe("/api/");
    expect(parsedUrl.searchParams.get("q")).toBe("12 Ocean St Bondi");
    expect(parsedUrl.searchParams.get("limit")).toBe("3");
    expect(init?.headers).toEqual({
      accept: "application/json",
      "user-agent": "Sparkl-test/1.0",
    });
  });

  it("autocomplete with near", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValueOnce(jsonResponse(PHOTON));

    const provider = createOsmProvider({
      fetch: fetchMock,
      photonThrottle: noWait,
      nominatimThrottle: noWait,
      userAgent: "Sparkl-test/1.0",
    });

    await provider.autocomplete({
      query: "12 Ocean St Bondi",
      limit: 3,
      near: { latitude: -33.9, longitude: 151.2 },
    });

    const [url] = fetchMock.mock.calls[0] ?? [];
    const parsedUrl = new URL(String(url));
    expect(parsedUrl.searchParams.get("lat")).toBe("-33.9");
    expect(parsedUrl.searchParams.get("lon")).toBe("151.2");
  });

  it("geocode", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValueOnce(jsonResponse([NOMINATIM_ITEM]));

    const provider = createOsmProvider({
      fetch: fetchMock,
      photonThrottle: noWait,
      nominatimThrottle: noWait,
      userAgent: "Sparkl-test/1.0",
    });

    const result = await provider.geocode({ query: "12 Ocean St Bondi" });

    // Adjust expected label to match what Nominatim actually returns
    expect(result).toEqual([
      {
        id: "osm:W1082668130",
        label:
          "12, Ocean Street North, Bondi, Eastern Suburbs, Sydney, New South Wales, 2026, Australia",
        latitude: -33.8909546,
        longitude: 151.2633431,
      },
    ]);

    // Check URL and headers
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    const parsedUrl = new URL(String(url));
    expect(parsedUrl.host).toBe("nominatim.openstreetmap.org");
    expect(parsedUrl.pathname).toBe("/search");
    expect(parsedUrl.searchParams.get("format")).toBe("jsonv2");
    expect(parsedUrl.searchParams.get("q")).toBe("12 Ocean St Bondi");
    expect(parsedUrl.searchParams.get("limit")).toBe("5");
    expect(init?.headers).toEqual({
      accept: "application/json",
      "user-agent": "Sparkl-test/1.0",
    });
  });

  it("reverse", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValueOnce(jsonResponse(NOMINATIM_ITEM));

    const provider = createOsmProvider({
      fetch: fetchMock,
      photonThrottle: noWait,
      nominatimThrottle: noWait,
      userAgent: "Sparkl-test/1.0",
    });

    const result = await provider.reverse({
      latitude: -33.8909546,
      longitude: 151.2633431,
    });

    // Adjust expected label to match what Nominatim actually returns
    expect(result).toEqual({
      id: "osm:W1082668130",
      label:
        "12, Ocean Street North, Bondi, Eastern Suburbs, Sydney, New South Wales, 2026, Australia",
      latitude: -33.8909546,
      longitude: 151.2633431,
    });
  });

  it("reverse error", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: "Unable to geocode" }),
    );

    const provider = createOsmProvider({
      fetch: fetchMock,
      photonThrottle: noWait,
      nominatimThrottle: noWait,
      userAgent: "Sparkl-test/1.0",
    });

    const result = await provider.reverse({
      latitude: -33.8909546,
      longitude: 151.2633431,
    });

    expect(result).toBeNull();
  });

  it("custom photonUrl", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValueOnce(jsonResponse(PHOTON));

    const provider = createOsmProvider({
      fetch: fetchMock,
      photonThrottle: noWait,
      nominatimThrottle: noWait,
      userAgent: "Sparkl-test/1.0",
      photonUrl: "https://photon.test/",
    });

    await provider.autocomplete({ query: "12 Ocean St Bondi", limit: 3 });

    const [url] = fetchMock.mock.calls[0] ?? [];
    const parsedUrl = new URL(String(url));
    expect(parsedUrl.host).toBe("photon.test");
    expect(parsedUrl.pathname).toBe("/api/");
  });

  it("HTTP error", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValueOnce(new Response("error", { status: 503 }));

    const provider = createOsmProvider({
      fetch: fetchMock,
      photonThrottle: noWait,
      nominatimThrottle: noWait,
      userAgent: "Sparkl-test/1.0",
    });

    const error = await provider
      .autocomplete({ query: "secret street 9", limit: 3 })
      .catch((err: unknown) => err);
    expect(error).toBeInstanceOf(GeoError);
    expect((error as GeoError).code).toBe(
      SPARKL_ERROR_CODES.UPSTREAM_UNAVAILABLE,
    );
    // Queries are addresses: they never reach error messages or logs.
    expect((error as GeoError).message).not.toContain("secret street");
  });

  it("network error", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));

    const provider = createOsmProvider({
      fetch: fetchMock,
      photonThrottle: noWait,
      nominatimThrottle: noWait,
      userAgent: "Sparkl-test/1.0",
    });

    await expect(
      provider.autocomplete({ query: "secret street 9", limit: 3 }),
    ).rejects.toThrow(GeoError);
  });

  it("malformed JSON error", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 200 }));

    const provider = createOsmProvider({
      fetch: fetchMock,
      photonThrottle: noWait,
      nominatimThrottle: noWait,
      userAgent: "Sparkl-test/1.0",
    });

    await expect(
      provider.autocomplete({ query: "secret street 9", limit: 3 }),
    ).rejects.toThrow(GeoError);
  });

  it("every call awaits throttle", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const waitMock = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const throttle: Throttle = { wait: waitMock };

    fetchMock.mockResolvedValueOnce(jsonResponse(PHOTON));
    fetchMock.mockResolvedValueOnce(jsonResponse(PHOTON));

    const provider = createOsmProvider({
      fetch: fetchMock,
      photonThrottle: throttle,
      nominatimThrottle: noWait,
      userAgent: "Sparkl-test/1.0",
    });

    await provider.autocomplete({ query: "12 Ocean St Bondi", limit: 3 });
    await provider.autocomplete({ query: "12 Ocean St Bondi", limit: 3 });

    expect(waitMock).toHaveBeenCalledTimes(2);
  });
});

describe("createGeoService", () => {
  it("cache behavior", async () => {
    const mockProvider: GeoProviderClient = {
      autocomplete: vi.fn().mockResolvedValue([PLACE]),
      geocode: vi.fn().mockResolvedValue([PLACE]),
      reverse: vi.fn().mockResolvedValue(PLACE),
    };

    const t = 0;
    const now = () => t;

    const service = createGeoService({
      provider: mockProvider,
      now,
    });

    // Test geocode cache hit
    await service.geocode("u1", { query: "12 Ocean St Bondi" });
    await service.geocode("u1", { query: "12 ocean st bondi" }); // Different case, should be cached

    expect(mockProvider.geocode).toHaveBeenCalledTimes(1);

    // Test autocomplete cache
    await service.autocomplete("u1", { query: "12 Ocean St Bondi", limit: 3 });
    await service.autocomplete("u1", { query: "12 Ocean St Bondi", limit: 3 }); // Same

    expect(mockProvider.autocomplete).toHaveBeenCalledTimes(1);

    // Test autocomplete cache with different limit
    await service.autocomplete("u1", { query: "12 Ocean St Bondi", limit: 5 });

    expect(mockProvider.autocomplete).toHaveBeenCalledTimes(2);

    // Test reverse cache
    await service.reverse("u1", {
      latitude: -33.8909546,
      longitude: 151.2633431,
    });
    await service.reverse("u1", {
      latitude: -33.8909546,
      longitude: 151.2633431,
    });

    expect(mockProvider.reverse).toHaveBeenCalledTimes(1);
  });

  it("cache with near parameter", async () => {
    const mockProvider: GeoProviderClient = {
      autocomplete: vi.fn().mockResolvedValue([PLACE]),
      geocode: vi.fn().mockResolvedValue([PLACE]),
      reverse: vi.fn().mockResolvedValue(PLACE),
    };

    const t = 0;
    const now = () => t;

    const service = createGeoService({
      provider: mockProvider,
      now,
    });

    // Test near cache - this should be calling the provider twice with same coordinates
    await service.autocomplete("u1", {
      query: "12 Ocean St Bondi",
      limit: 3,
      near: { latitude: -33.861, longitude: 151.263 },
    });

    // This should hit the cache because coordinates are rounded to same value
    await service.autocomplete("u1", {
      query: "12 Ocean St Bondi",
      limit: 3,
      near: { latitude: -33.864, longitude: 151.264 }, // Same rounded to 2 decimals (-33.86, 151.26)
    });

    expect(mockProvider.autocomplete).toHaveBeenCalledTimes(1);
  });

  it("provider errors are not cached", async () => {
    const geocode = vi
      .fn<GeoProviderClient["geocode"]>()
      .mockRejectedValueOnce(new Error("upstream down"))
      .mockResolvedValue([PLACE]);
    const mockProvider: GeoProviderClient = {
      autocomplete: vi.fn().mockResolvedValue([PLACE]),
      geocode,
      reverse: vi.fn().mockResolvedValue(PLACE),
    };

    const t = 0;
    const now = () => t;

    const service = createGeoService({
      provider: mockProvider,
      now,
    });

    await expect(
      service.geocode("u1", { query: "12 Ocean St Bondi" }),
    ).rejects.toThrow("upstream down");

    await expect(
      service.geocode("u1", { query: "12 Ocean St Bondi" }),
    ).resolves.toEqual([PLACE]);
    expect(geocode).toHaveBeenCalledTimes(2);
  });

  it("rate limiting user isolation", async () => {
    const mockProvider: GeoProviderClient = {
      autocomplete: vi.fn().mockResolvedValue([PLACE]),
      geocode: vi.fn().mockResolvedValue([PLACE]),
      reverse: vi.fn().mockResolvedValue(PLACE),
    };

    const t = 0;
    const now = () => t;

    const service = createGeoService({
      provider: mockProvider,
      limiter: createUserRateLimiter({
        limit: 1,
        windowMs: 60_000,
        now,
      }),
      now,
    });

    // First call should succeed
    await expect(service.geocode("u1", { query: "q one" })).resolves.toEqual([
      PLACE,
    ]);

    // Second call should fail (limit exceeded)
    await expect(service.geocode("u1", { query: "q two" })).rejects.toThrow(
      RateLimitError,
    );

    // User u2 should still be able to call
    await expect(service.geocode("u2", { query: "q three" })).resolves.toEqual([
      PLACE,
    ]);
  });

  it("rate limiting reset", async () => {
    const mockProvider: GeoProviderClient = {
      autocomplete: vi.fn().mockResolvedValue([PLACE]),
      geocode: vi.fn().mockResolvedValue([PLACE]),
      reverse: vi.fn().mockResolvedValue(PLACE),
    };

    let t = 0;
    const now = () => t;

    const service = createGeoService({
      provider: mockProvider,
      limiter: createUserRateLimiter({
        limit: 1,
        windowMs: 60_000,
        now,
      }),
      now,
    });

    // First call should succeed
    await expect(service.geocode("u1", { query: "q one" })).resolves.toEqual([
      PLACE,
    ]);

    // Move time forward (reset window)
    t = 60_000;

    // Second call should succeed now
    await expect(service.geocode("u1", { query: "q two" })).resolves.toEqual([
      PLACE,
    ]);
  });

  it("TTL cache behavior", () => {
    let t = 0;
    const now = () => t;

    const cache = createTtlCache<GeoPlace[]>({
      maxEntries: 2,
      ttlMs: 100,
      now,
    });

    // A get refreshes recency: set a, set b, get a, set c -> b is evicted.
    cache.set("a", [PLACE]);
    cache.set("b", [PLACE]);
    expect(cache.get("a")).toEqual([PLACE]);
    cache.set("c", [PLACE]);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toEqual([PLACE]);
    expect(cache.get("c")).toEqual([PLACE]);

    // Entries expire at their TTL.
    t = 99;
    expect(cache.get("c")).toEqual([PLACE]);
    t = 100;
    expect(cache.get("c")).toBeUndefined();
  });

  it("default per-user limit: 60 calls a minute, cache hits included", async () => {
    let t = 0;
    const now = () => t;
    const service = createGeoService({
      provider: {
        autocomplete: vi.fn().mockResolvedValue([PLACE]),
        geocode: vi.fn().mockResolvedValue([PLACE]),
        reverse: vi.fn().mockResolvedValue(PLACE),
      },
      now,
    });
    for (let i = 0; i < 60; i++) {
      await service.geocode("u1", { query: "12 Ocean St" });
    }
    await expect(
      service.geocode("u1", { query: "12 Ocean St" }),
    ).rejects.toBeInstanceOf(RateLimitError);
    await expect(
      service.geocode("u2", { query: "12 Ocean St" }),
    ).resolves.toEqual([PLACE]);
    t = 60_000;
    await expect(
      service.geocode("u1", { query: "12 Ocean St" }),
    ).resolves.toEqual([PLACE]);
  });

  it("TTL cache evicts the oldest key past maxEntries", () => {
    const cache = createTtlCache<GeoPlace[]>({ maxEntries: 2, ttlMs: 100 });
    cache.set("a", [PLACE]);
    cache.set("b", [PLACE]);
    cache.set("c", [PLACE]);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toEqual([PLACE]);
  });
});

describe("createGeoServiceFromEnv", () => {
  it("throws for unsupported provider", () => {
    expect(() => createGeoServiceFromEnv({ GEO_PROVIDER: "google" })).toThrow(
      GeoError,
    );
  });

  it("throws for missing user agent in production", () => {
    expect(() => createGeoServiceFromEnv({ NODE_ENV: "production" })).toThrow(
      GeoError,
    );
  });

  it("creates service with default settings", () => {
    const service = createGeoServiceFromEnv({});
    expect(service).toBeDefined();
  });

  it("sends correct user agent", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValueOnce(jsonResponse(PHOTON));

    const service = createGeoServiceFromEnv({}, fetchMock);

    await service.autocomplete("u1", { query: "12 Ocean St Bondi", limit: 3 });

    const [, init] = fetchMock.mock.calls[0] ?? [];
    const headers = init?.headers as Record<string, string>;
    expect(headers["user-agent"]).toBe(GEO_DEFAULTS.devUserAgent);
  });
});
