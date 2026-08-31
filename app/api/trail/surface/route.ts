import {
  aggregateSurfaceMatches,
  type OsmSurfaceWay,
  type RouteSurfaceData,
  type SurfaceRoutePoint,
} from "../../../_lib/surface";

const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const routeSurfaceCache = new Map<string, { expiresAt: number; data: RouteSurfaceData }>();

export const runtime = "nodejs";
export const maxDuration = 10;

function errorResponse(message: string, status: number) {
  return Response.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function validPoint(value: unknown, index: number): SurfaceRoutePoint | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<SurfaceRoutePoint>;
  const latitude = Number(candidate.latitude);
  const longitude = Number(candidate.longitude);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 || latitude > 90 ||
    longitude < -180 || longitude > 180
  ) return null;
  return {
    id: typeof candidate.id === "string" && candidate.id.length <= 40
      ? candidate.id
      : `surface-${index + 1}`,
    latitude,
    longitude,
  };
}

function cacheKey(points: SurfaceRoutePoint[]) {
  return points
    .map((point) => `${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}`)
    .join(";");
}

function overpassQuery(points: SurfaceRoutePoint[]) {
  const corridor = points
    .map((point) => `${point.latitude.toFixed(6)},${point.longitude.toFixed(6)}`)
    .join(",");
  const relevantHighways =
    "^(path|footway|track|bridleway|steps|pedestrian|service|unclassified|residential)$";
  return `[out:json][timeout:8];way(around:50,${corridor})["highway"~"${relevantHighways}"];out tags geom;`;
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse("A JSON route-point payload is required.", 400);
  }

  const rawPoints = payload && typeof payload === "object" &&
    Array.isArray((payload as { points?: unknown }).points)
    ? (payload as { points: unknown[] }).points
    : [];
  if (rawPoints.length < 2 || rawPoints.length > 24) {
    return errorResponse("Provide between 2 and 24 representative route points.", 400);
  }
  const points = rawPoints
    .map(validPoint)
    .filter((point): point is SurfaceRoutePoint => point != null);
  if (points.length !== rawPoints.length) {
    return errorResponse("Every route point must contain valid coordinates.", 400);
  }

  const key = cacheKey(points);
  const cached = routeSurfaceCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return Response.json(cached.data, {
      headers: { "Cache-Control": "private, max-age=3600" },
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_500);
  try {
    const response = await fetch(OVERPASS_ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "User-Agent": "Track4Trek/0.2 (+https://siuyuk.xyz)",
      },
      body: new URLSearchParams({ data: overpassQuery(points) }),
      cache: "no-store",
    });
    if (!response.ok) {
      return errorResponse(`OpenStreetMap surface service returned ${response.status}.`, 502);
    }
    const body = await response.json() as { elements?: OsmSurfaceWay[] };
    if (!Array.isArray(body.elements)) {
      return errorResponse("OpenStreetMap surface service returned invalid data.", 502);
    }
    const data = aggregateSurfaceMatches(points, body.elements);
    routeSurfaceCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return Response.json(data, {
      headers: { "Cache-Control": "private, max-age=3600" },
    });
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return errorResponse("OpenStreetMap surface request timed out.", 504);
    }
    return errorResponse("OpenStreetMap surface service is unavailable.", 502);
  } finally {
    clearTimeout(timeout);
  }
}
