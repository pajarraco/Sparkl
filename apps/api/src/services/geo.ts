import {
  type GeoAutocompleteInput,
  type GeoGeocodeInput,
  type GeoPlace,
  type GeoProvider,
  type GeoReverseInput,
  SPARKL_ERROR_CODES,
  type SparklErrorCode,
  geoPlaceSchema,
  geoProviderSchema,
} from "@sparkl/shared";
import {
  type Throttle,
  type UserRateLimiter,
  createThrottle,
  createUserRateLimiter,
} from "./rate-limit.js";

// Address search behind a provider switch (GEO_PROVIDER). OSM for the
// hackathon: Photon (komoot) for search-as-you-type, Nominatim for geocode
// and reverse. Coordinates only ever come from here, never from the model.
// Queries and addresses are never logged.

export const GEO_DEFAULTS = {
  photonUrl: "https://photon.komoot.io",
  nominatimUrl: "https://nominatim.openstreetmap.org",
  devUserAgent: "Sparkl/0.1 (local development)",
  timeoutMs: 8_000,
  // Nominatim usage policy: at most 1 request per second, identified.
  minIntervalMs: 1_000,
  cacheMaxEntries: 1_000,
  cacheTtlMs: 24 * 60 * 60 * 1000,
  userLimit: 60,
  userWindowMs: 60_000,
} as const;

export class GeoError extends Error {
  readonly code: SparklErrorCode;

  constructor(code: SparklErrorCode, message: string) {
    super(message);
    this.name = "GeoError";
    this.code = code;
  }
}

function unavailable(message: string): GeoError {
  return new GeoError(SPARKL_ERROR_CODES.UPSTREAM_UNAVAILABLE, message);
}

export interface GeoProviderClient {
  autocomplete(input: GeoAutocompleteInput): Promise<GeoPlace[]>;
  geocode(input: GeoGeocodeInput): Promise<GeoPlace[]>;
  reverse(input: GeoReverseInput): Promise<GeoPlace | null>;
}

// --- OSM parsing (pure) ---

type Json = Record<string, unknown>;

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}

function osmId(type: unknown, id: unknown): string | undefined {
  const letter = str(type)?.charAt(0).toUpperCase();
  if (!letter || !["N", "W", "R"].includes(letter)) return undefined;
  if (typeof id !== "number" && typeof id !== "string") return undefined;
  const digits = String(id);
  return /^\d{1,20}$/.test(digits) ? `osm:${letter}${digits}` : undefined;
}

// Drops anything that does not satisfy the shared contract.
function toPlace(candidate: {
  id: string | undefined;
  label: string | undefined;
  latitude: number;
  longitude: number;
}): GeoPlace | null {
  const parsed = geoPlaceSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export function photonLabel(props: Json): string | undefined {
  const street = str(props.street);
  const house = str(props.housenumber);
  const name = str(props.name);
  const line1 = house && street ? `${house} ${street}` : (street ?? name);
  const parts = [
    name && line1 !== name ? name : undefined,
    line1,
    str(props.district) ?? str(props.locality),
    str(props.city),
    str(props.state),
    str(props.postcode),
    str(props.country),
  ].filter((p): p is string => p !== undefined);
  const unique = parts.filter((p, i) => parts.indexOf(p) === i);
  return unique.length > 0 ? unique.join(", ").slice(0, 500) : undefined;
}

export function parsePhoton(json: unknown): GeoPlace[] {
  const features = (json as { features?: unknown } | null)?.features;
  if (!Array.isArray(features)) return [];
  const places: GeoPlace[] = [];
  for (const feature of features) {
    const props = (feature as { properties?: unknown })?.properties as
      | Json
      | undefined;
    const coords = (feature as { geometry?: { coordinates?: unknown } })
      ?.geometry?.coordinates;
    if (!props || !Array.isArray(coords) || coords.length < 2) continue;
    const place = toPlace({
      id: osmId(props.osm_type, props.osm_id),
      label: photonLabel(props),
      longitude: Number(coords[0]),
      latitude: Number(coords[1]),
    });
    if (place) places.push(place);
  }
  return places;
}

export function parseNominatimItem(item: unknown): GeoPlace | null {
  const row = item as Json | null;
  if (!row || typeof row !== "object") return null;
  return toPlace({
    id: osmId(row.osm_type, row.osm_id),
    label: str(row.display_name)?.slice(0, 500),
    latitude: Number(row.lat),
    longitude: Number(row.lon),
  });
}

export function parseNominatimSearch(json: unknown): GeoPlace[] {
  if (!Array.isArray(json)) return [];
  return json.map(parseNominatimItem).filter((p): p is GeoPlace => p !== null);
}

// --- OSM provider ---

export interface OsmProviderOptions {
  userAgent: string;
  photonUrl?: string | undefined;
  nominatimUrl?: string | undefined;
  timeoutMs?: number;
  fetch?: typeof fetch | undefined;
  photonThrottle?: Throttle;
  nominatimThrottle?: Throttle;
}

export function createOsmProvider(
  options: OsmProviderOptions,
): GeoProviderClient {
  const doFetch = options.fetch ?? fetch;
  const photonUrl = (options.photonUrl ?? GEO_DEFAULTS.photonUrl).replace(
    /\/+$/,
    "",
  );
  const nominatimUrl = (
    options.nominatimUrl ?? GEO_DEFAULTS.nominatimUrl
  ).replace(/\/+$/, "");
  const timeoutMs = options.timeoutMs ?? GEO_DEFAULTS.timeoutMs;
  const photonThrottle =
    options.photonThrottle ??
    createThrottle({ minIntervalMs: GEO_DEFAULTS.minIntervalMs });
  const nominatimThrottle =
    options.nominatimThrottle ??
    createThrottle({ minIntervalMs: GEO_DEFAULTS.minIntervalMs });

  async function getJson(url: string, throttle: Throttle): Promise<unknown> {
    await throttle.wait();
    let response: Response;
    try {
      response = await doFetch(url, {
        headers: {
          accept: "application/json",
          "user-agent": options.userAgent,
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw unavailable("address lookup is unavailable");
    }
    if (!response.ok) {
      throw unavailable(`address lookup failed with HTTP ${response.status}`);
    }
    try {
      return await response.json();
    } catch {
      throw unavailable("address lookup returned an unreadable response");
    }
  }

  return {
    async autocomplete(input) {
      const params = new URLSearchParams({
        q: input.query,
        limit: String(input.limit),
      });
      if (input.near) {
        params.set("lat", String(input.near.latitude));
        params.set("lon", String(input.near.longitude));
      }
      const json = await getJson(`${photonUrl}/api/?${params}`, photonThrottle);
      return parsePhoton(json).slice(0, input.limit);
    },
    async geocode(input) {
      const params = new URLSearchParams({
        format: "jsonv2",
        q: input.query,
        limit: "5",
      });
      const json = await getJson(
        `${nominatimUrl}/search?${params}`,
        nominatimThrottle,
      );
      return parseNominatimSearch(json).slice(0, 5);
    },
    async reverse(input) {
      const params = new URLSearchParams({
        format: "jsonv2",
        lat: String(input.latitude),
        lon: String(input.longitude),
      });
      const json = await getJson(
        `${nominatimUrl}/reverse?${params}`,
        nominatimThrottle,
      );
      // Nominatim answers { error: "Unable to geocode" } for open sea etc.
      return parseNominatimItem(json);
    },
  };
}

// --- cache ---

export interface TtlCache<T> {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
}

// Insertion-ordered Map as a small LRU: reads move the key to the end.
export function createTtlCache<T>(options: {
  maxEntries: number;
  ttlMs: number;
  now?: (() => number) | undefined;
}): TtlCache<T> {
  const now = options.now ?? Date.now;
  const entries = new Map<string, { value: T; expires: number }>();
  return {
    get(key) {
      const entry = entries.get(key);
      if (entry === undefined) return undefined;
      if (entry.expires <= now()) {
        entries.delete(key);
        return undefined;
      }
      entries.delete(key);
      entries.set(key, entry);
      return entry.value;
    },
    set(key, value) {
      entries.delete(key);
      entries.set(key, { value, expires: now() + options.ttlMs });
      while (entries.size > options.maxEntries) {
        const oldest = entries.keys().next().value;
        if (oldest === undefined) break;
        entries.delete(oldest);
      }
    },
  };
}

// Cache keys: case- and space-insensitive queries; coordinates rounded to
// ~1 m for reverse and ~1 km for the autocomplete bias.
export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

function round(value: number, digits: number): string {
  return value.toFixed(digits);
}

// --- service ---

export interface GeoService {
  autocomplete(
    userId: string,
    input: GeoAutocompleteInput,
  ): Promise<GeoPlace[]>;
  geocode(userId: string, input: GeoGeocodeInput): Promise<GeoPlace[]>;
  reverse(userId: string, input: GeoReverseInput): Promise<GeoPlace | null>;
}

export interface GeoServiceDeps {
  provider: GeoProviderClient;
  limiter?: UserRateLimiter;
  cache?: TtlCache<GeoPlace[]>;
  now?: (() => number) | undefined;
}

export function createGeoService(deps: GeoServiceDeps): GeoService {
  const limiter =
    deps.limiter ??
    createUserRateLimiter({
      limit: GEO_DEFAULTS.userLimit,
      windowMs: GEO_DEFAULTS.userWindowMs,
      now: deps.now,
    });
  const cache =
    deps.cache ??
    createTtlCache<GeoPlace[]>({
      maxEntries: GEO_DEFAULTS.cacheMaxEntries,
      ttlMs: GEO_DEFAULTS.cacheTtlMs,
      now: deps.now,
    });

  // Cache hits are free for the upstream but still count against the
  // user, so one account cannot hammer the endpoint either way.
  async function cached(
    userId: string,
    key: string,
    load: () => Promise<GeoPlace[]>,
  ): Promise<GeoPlace[]> {
    limiter.consume(userId);
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    const places = await load();
    cache.set(key, places);
    return places;
  }

  return {
    autocomplete(userId, input) {
      const near = input.near
        ? `${round(input.near.latitude, 2)},${round(input.near.longitude, 2)}`
        : "-";
      const key = `a|${normalizeQuery(input.query)}|${near}|${input.limit}`;
      return cached(userId, key, () => deps.provider.autocomplete(input));
    },
    geocode(userId, input) {
      const key = `g|${normalizeQuery(input.query)}`;
      return cached(userId, key, () => deps.provider.geocode(input));
    },
    async reverse(userId, input) {
      const key = `r|${round(input.latitude, 5)},${round(input.longitude, 5)}`;
      const places = await cached(userId, key, async () => {
        const place = await deps.provider.reverse(input);
        return place ? [place] : [];
      });
      return places[0] ?? null;
    },
  };
}

// --- wiring from env ---

type Env = Record<string, string | undefined>;

export function createGeoServiceFromEnv(
  env: Env = process.env,
  fetchImpl?: typeof fetch,
): GeoService {
  const providerName = geoProviderSchema.safeParse(env.GEO_PROVIDER ?? "osm");
  if (!providerName.success) {
    throw unavailable("GEO_PROVIDER is not supported");
  }
  const provider: GeoProvider = providerName.data;
  const userAgent = str(env.GEO_USER_AGENT);
  // Nominatim requires an identifying User-Agent; production must set one.
  if (!userAgent && env.NODE_ENV === "production") {
    throw unavailable("GEO_USER_AGENT is required in production");
  }
  switch (provider) {
    case "osm":
      return createGeoService({
        provider: createOsmProvider({
          userAgent: userAgent ?? GEO_DEFAULTS.devUserAgent,
          photonUrl: str(env.GEO_PHOTON_URL),
          nominatimUrl: str(env.GEO_NOMINATIM_URL),
          fetch: fetchImpl,
        }),
      });
  }
}

let singleton: GeoService | undefined;

// One per process, so the cache, throttles and per-user limits are shared
// by every request.
export function getGeoService(): GeoService {
  singleton ??= createGeoServiceFromEnv();
  return singleton;
}
