import type { RoutePreview } from "./route-data";
import type { WeatherMonthlySummary } from "./weather";

export const SURFACE_MODEL_VERSION = "surface-v0.1" as const;

export type SurfaceBaseKey =
  | "paved"
  | "trail"
  | "gravel"
  | "rock"
  | "sand"
  | "offTrail"
  | "unknown";

export type SurfaceConditionKey =
  | "firmTrail"
  | "gravel"
  | "mud"
  | "sand"
  | "rock"
  | "snowIce"
  | "offTrail"
  | "unknown";

export type SurfaceRoutePoint = {
  id: string;
  latitude: number;
  longitude: number;
};

export type OsmSurfaceWay = {
  id: number;
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
};

export type RouteSurfaceData = {
  modelVersion: typeof SURFACE_MODEL_VERSION;
  status: "ready" | "partial" | "unavailable";
  source: "openstreetmap" | "none";
  sampleCount: number;
  matchedPointCount: number;
  mappedCoveragePct: number;
  explicitSurfaceTagPct: number;
  base: Record<SurfaceBaseKey, number>;
  errors: string[];
  attribution: string[];
};

export type MonthlySurfaceCondition = {
  modelVersion: typeof SURFACE_MODEL_VERSION;
  month: number;
  shares: Record<SurfaceConditionKey, number>;
  terrainFactor: number;
  difficultyScore: number;
  wetness: number;
  snowCover: number;
  mappedCoveragePct: number;
  source: RouteSurfaceData["source"];
};

const BASE_KEYS: readonly SurfaceBaseKey[] = [
  "paved",
  "trail",
  "gravel",
  "rock",
  "sand",
  "offTrail",
  "unknown",
];

const CONDITION_KEYS: readonly SurfaceConditionKey[] = [
  "firmTrail",
  "gravel",
  "mud",
  "sand",
  "rock",
  "snowIce",
  "offTrail",
  "unknown",
];

const PAVED_SURFACES = new Set([
  "asphalt",
  "concrete",
  "concrete:lanes",
  "concrete:plates",
  "paving_stones",
  "sett",
  "cobblestone",
  "metal",
  "wood",
]);
const GRAVEL_SURFACES = new Set([
  "gravel",
  "fine_gravel",
  "pebblestone",
  "compacted",
  "crushed_limestone",
]);
const ROCK_SURFACES = new Set([
  "rock",
  "stone",
  "scree",
  "unhewn_cobblestone",
]);
const SAND_SURFACES = new Set(["sand"]);
const TRAIL_SURFACES = new Set([
  "ground",
  "dirt",
  "earth",
  "mud",
  "grass",
  "grass_paver",
  "clay",
  "soil",
]);
const TRAIL_HIGHWAYS = new Set([
  "path",
  "footway",
  "track",
  "bridleway",
  "steps",
  "pedestrian",
]);

function clamp(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(Math.max(value, minimum), maximum);
}

function round(value: number, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function emptyRecord<K extends string>(keys: readonly K[]) {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
}

function normalizePercentages<K extends string>(
  values: Record<K, number>,
  keys: readonly K[],
) {
  const total = keys.reduce((sum, key) => sum + Math.max(values[key], 0), 0);
  if (total <= 0) return values;
  const normalized = emptyRecord(keys);
  let assigned = 0;
  keys.forEach((key, index) => {
    const percentage = index === keys.length - 1
      ? Math.max(0, 100 - assigned)
      : round((Math.max(values[key], 0) / total) * 100, 1);
    normalized[key] = percentage;
    assigned += percentage;
  });
  return normalized;
}

function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const earthRadius = 6_371_008.8;
  const latitudeA = (a.latitude * Math.PI) / 180;
  const latitudeB = (b.latitude * Math.PI) / 180;
  const deltaLatitude = ((b.latitude - a.latitude) * Math.PI) / 180;
  const deltaLongitude = ((b.longitude - a.longitude) * Math.PI) / 180;
  const sinLatitude = Math.sin(deltaLatitude / 2);
  const sinLongitude = Math.sin(deltaLongitude / 2);
  const haversine = sinLatitude * sinLatitude +
    Math.cos(latitudeA) * Math.cos(latitudeB) * sinLongitude * sinLongitude;
  return 2 * earthRadius * Math.asin(Math.sqrt(clamp(haversine, 0, 1)));
}

function pointToSegmentMeters(
  point: SurfaceRoutePoint,
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
) {
  const latitudeRadians = (point.latitude * Math.PI) / 180;
  const metersPerLongitudeDegree = 111_320 * Math.cos(latitudeRadians);
  const metersPerLatitudeDegree = 110_540;
  const ax = (a.lon - point.longitude) * metersPerLongitudeDegree;
  const ay = (a.lat - point.latitude) * metersPerLatitudeDegree;
  const bx = (b.lon - point.longitude) * metersPerLongitudeDegree;
  const by = (b.lat - point.latitude) * metersPerLatitudeDegree;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const position = lengthSquared <= Number.EPSILON
    ? 0
    : clamp(-(ax * dx + ay * dy) / lengthSquared, 0, 1);
  return Math.hypot(ax + position * dx, ay + position * dy);
}

function nearestWayDistance(point: SurfaceRoutePoint, way: OsmSurfaceWay) {
  const geometry = way.geometry ?? [];
  if (geometry.length < 2) return Number.POSITIVE_INFINITY;
  let nearest = Number.POSITIVE_INFINITY;
  for (let index = 1; index < geometry.length; index += 1) {
    nearest = Math.min(
      nearest,
      pointToSegmentMeters(point, geometry[index - 1], geometry[index]),
    );
  }
  return nearest;
}

export function classifyOsmSurface(tags: Record<string, string> = {}): SurfaceBaseKey {
  const surface = tags.surface?.trim().toLowerCase();
  const highway = tags.highway?.trim().toLowerCase();
  const trackType = tags.tracktype?.trim().toLowerCase();

  if (surface && PAVED_SURFACES.has(surface)) return "paved";
  if (surface && GRAVEL_SURFACES.has(surface)) return "gravel";
  if (surface && ROCK_SURFACES.has(surface)) return "rock";
  if (surface && SAND_SURFACES.has(surface)) return "sand";
  if (surface && TRAIL_SURFACES.has(surface)) return "trail";
  if (trackType === "grade1") return "paved";
  if (trackType === "grade2" || trackType === "grade3") return "gravel";
  if (trackType === "grade4" || trackType === "grade5") return "trail";
  if (highway && TRAIL_HIGHWAYS.has(highway)) return "trail";
  return "unknown";
}

export function sampleRouteSurfacePoints(
  preview: RoutePreview,
  maximumPoints = 12,
): SurfaceRoutePoint[] {
  const segments = (preview.geographicSegments ?? [])
    .filter((segment) => segment.length >= 2);
  const pieces: Array<{
    startDistanceM: number;
    endDistanceM: number;
    a: { latitude: number; longitude: number };
    b: { latitude: number; longitude: number };
  }> = [];
  let totalDistanceM = 0;

  for (const segment of segments) {
    for (let index = 1; index < segment.length; index += 1) {
      const a = {
        latitude: segment[index - 1].latitude,
        longitude: segment[index - 1].longitude,
      };
      const b = {
        latitude: segment[index].latitude,
        longitude: segment[index].longitude,
      };
      const lengthM = distanceMeters(a, b);
      if (!Number.isFinite(lengthM) || lengthM <= 0) continue;
      pieces.push({ startDistanceM: totalDistanceM, endDistanceM: totalDistanceM + lengthM, a, b });
      totalDistanceM += lengthM;
    }
  }

  if (!pieces.length || totalDistanceM <= 0) return [];
  const pointCount = Math.min(
    Math.max(Math.ceil(totalDistanceM / 4_000), 8),
    Math.min(Math.max(Math.round(maximumPoints), 2), 24),
  );

  return Array.from({ length: pointCount }, (_, index) => {
    const targetDistanceM = ((index + 0.5) / pointCount) * totalDistanceM;
    const piece = pieces.find((entry) => entry.endDistanceM >= targetDistanceM) ?? pieces.at(-1)!;
    const ratio = clamp(
      (targetDistanceM - piece.startDistanceM) /
        Math.max(piece.endDistanceM - piece.startDistanceM, 0.001),
      0,
      1,
    );
    return {
      id: `surface-${index + 1}`,
      latitude: round(piece.a.latitude + (piece.b.latitude - piece.a.latitude) * ratio, 6),
      longitude: round(piece.a.longitude + (piece.b.longitude - piece.a.longitude) * ratio, 6),
    };
  });
}

export function aggregateSurfaceMatches(
  points: SurfaceRoutePoint[],
  ways: OsmSurfaceWay[],
  maximumDistanceM = 65,
): RouteSurfaceData {
  if (!points.length) return buildUnavailableSurface("No route coordinates are available for surface matching.");
  const counts = emptyRecord(BASE_KEYS);
  let matchedPointCount = 0;
  let explicitSurfaceTagCount = 0;

  for (const point of points) {
    let nearestWay: OsmSurfaceWay | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const way of ways) {
      const distance = nearestWayDistance(point, way);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestWay = way;
      }
    }
    if (!nearestWay || nearestDistance > maximumDistanceM) {
      counts.offTrail += 1;
      continue;
    }
    matchedPointCount += 1;
    if (nearestWay.tags?.surface) explicitSurfaceTagCount += 1;
    counts[classifyOsmSurface(nearestWay.tags)] += 1;
  }

  return {
    modelVersion: SURFACE_MODEL_VERSION,
    status: matchedPointCount === points.length ? "ready" : "partial",
    source: "openstreetmap",
    sampleCount: points.length,
    matchedPointCount,
    mappedCoveragePct: round((matchedPointCount / points.length) * 100, 1),
    explicitSurfaceTagPct: round((explicitSurfaceTagCount / points.length) * 100, 1),
    base: normalizePercentages(counts, BASE_KEYS),
    errors: [],
    attribution: ["© OpenStreetMap contributors", "Surface matching via Overpass API"],
  };
}

export function buildUnavailableSurface(error?: string): RouteSurfaceData {
  const base = emptyRecord(BASE_KEYS);
  base.unknown = 100;
  return {
    modelVersion: SURFACE_MODEL_VERSION,
    status: "unavailable",
    source: "none",
    sampleCount: 0,
    matchedPointCount: 0,
    mappedCoveragePct: 0,
    explicitSurfaceTagPct: 0,
    base,
    errors: error ? [error] : [],
    attribution: [],
  };
}

/**
 * Converts static mapped surface shares into month-dependent condition shares.
 * Mud and snow/ice are planning proxies derived from climate fields; they are
 * not direct trail-condition observations.
 */
export function calculateMonthlySurfaceCondition(
  surface: RouteSurfaceData | null,
  weather: WeatherMonthlySummary,
): MonthlySurfaceCondition {
  const base = surface?.base ?? buildUnavailableSurface().base;
  const precipitation = clamp(weather.indices.precipitation / 100, 0, 1);
  const humidity = clamp((weather.humidityPct ?? 50) / 100, 0, 1);
  const heat = clamp(weather.indices.heat / 100, 0, 1);
  const cold = clamp(weather.indices.cold / 100, 0, 1);
  const snowRisk = clamp(weather.indices.snow / 100, 0, 1);
  const wetness = clamp(
    precipitation * 0.62 + humidity * 0.18 + weather.indices.storm / 100 * 0.12 - heat * 0.12,
    0,
    1,
  );
  const snowCover = clamp(snowRisk * 0.62 + cold * 0.18, 0, 0.78);

  const exposedMapped = base.paved + base.trail + base.gravel + base.rock + base.sand;
  const snowIce = exposedMapped * snowCover;
  const remainingRatio = exposedMapped > 0
    ? clamp((exposedMapped - snowIce) / exposedMapped, 0, 1)
    : 0;
  let firmTrail = (base.paved + base.trail) * remainingRatio;
  let gravel = base.gravel * remainingRatio;
  const rock = base.rock * remainingRatio;
  const sand = base.sand * remainingRatio;
  const mud = Math.min(
    firmTrail + gravel,
    base.trail * remainingRatio * wetness * 0.7 +
      base.paved * remainingRatio * wetness * 0.04 +
      gravel * wetness * 0.18,
  );
  const mudFromFirm = Math.min(firmTrail, mud * 0.86);
  firmTrail -= mudFromFirm;
  gravel = Math.max(0, gravel - (mud - mudFromFirm));

  const shares = normalizePercentages({
    firmTrail,
    gravel,
    mud,
    sand,
    rock,
    snowIce,
    offTrail: base.offTrail,
    unknown: base.unknown,
  }, CONDITION_KEYS);

  const slickRockFactor = 1.2 + wetness * 0.18 + cold * 0.08;
  const terrainFactor =
    shares.firmTrail / 100 * 1 +
    shares.gravel / 100 * 1.1 +
    shares.mud / 100 * 1.35 +
    shares.sand / 100 * 1.55 +
    shares.rock / 100 * slickRockFactor +
    shares.snowIce / 100 * 1.45 +
    shares.offTrail / 100 * 1.12 +
    shares.unknown / 100 * 1;

  return {
    modelVersion: SURFACE_MODEL_VERSION,
    month: weather.month,
    shares,
    terrainFactor: round(terrainFactor, 2),
    difficultyScore: Math.round(clamp((terrainFactor - 1) / 0.5, 0, 1) * 100),
    wetness: round(wetness * 100, 1),
    snowCover: round(snowCover * 100, 1),
    mappedCoveragePct: surface?.mappedCoveragePct ?? 0,
    source: surface?.source ?? "none",
  };
}

export function surfaceCacheKey(preview: RoutePreview, maximumPoints = 12) {
  const segments = preview.geographicSegments ?? [];
  const first = segments[0]?.[0];
  const last = segments.at(-1)?.at(-1);
  return [
    SURFACE_MODEL_VERSION,
    preview.fileName,
    preview.stats.totalDistanceKm.toFixed(2),
    segments.reduce((sum, segment) => sum + segment.length, 0),
    first ? `${first.latitude.toFixed(5)},${first.longitude.toFixed(5)}` : "none",
    last ? `${last.latitude.toFixed(5)},${last.longitude.toFixed(5)}` : "none",
    maximumPoints,
  ].join(":");
}

export async function fetchRouteSurface(
  preview: RoutePreview,
  options: { maximumPoints?: number; signal?: AbortSignal } = {},
) {
  const points = sampleRouteSurfacePoints(preview, options.maximumPoints ?? 12);
  if (!points.length) return buildUnavailableSurface("No route coordinates are available for surface matching.");
  const response = await fetch("/api/trail/surface", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ points }),
    signal: options.signal,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error ?? `Surface provider returned ${response.status}.`);
  }
  return await response.json() as RouteSurfaceData;
}
