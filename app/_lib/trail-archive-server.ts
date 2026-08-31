const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
const PHOTON_ENDPOINT = "https://photon.komoot.io/api/";
const ELEVATION_ENDPOINT = "https://api.open-meteo.com/v1/elevation";
const OPENSTREETMAP_API = "https://api.openstreetmap.org/api/0.6";

function abortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

export async function fetchJsonWithTimeout(
  url: string | URL,
  init: RequestInit,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) throw new Error(`Upstream service returned ${response.status}.`);
    return await response.json() as unknown;
  } catch (error: unknown) {
    if (abortError(error)) throw new Error("The upstream request timed out.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function fetchPhoton(query: string) {
  const url = new URL(PHOTON_ENDPOINT);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "12");
  url.searchParams.set("lang", "en");
  return fetchJsonWithTimeout(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Track4Trek/0.3 (+https://siuyuk.xyz)",
    },
    cache: "no-store",
  }, 8_000);
}

export function fetchOverpass(query: string, timeoutMs: number) {
  return fetchJsonWithTimeout(OVERPASS_ENDPOINT, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      "User-Agent": "Track4Trek/0.3 (+https://siuyuk.xyz)",
    },
    body: new URLSearchParams({ data: query }),
    cache: "no-store",
  }, timeoutMs);
}

export function fetchOsmRelationFull(relationId: number) {
  return fetchJsonWithTimeout(
    `${OPENSTREETMAP_API}/relation/${relationId}/full.json`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "Track4Trek/0.3 (+https://siuyuk.xyz)",
      },
      cache: "no-store",
    },
    15_000,
  );
}

export async function fetchElevations(
  points: Array<{ latitude: number; longitude: number }>,
) {
  const chunks: Array<typeof points> = [];
  for (let index = 0; index < points.length; index += 100) {
    chunks.push(points.slice(index, index + 100));
  }

  const results = await Promise.allSettled(chunks.map(async (chunk) => {
    const url = new URL(ELEVATION_ENDPOINT);
    url.searchParams.set("latitude", chunk.map((point) => point.latitude.toFixed(6)).join(","));
    url.searchParams.set("longitude", chunk.map((point) => point.longitude.toFixed(6)).join(","));
    const payload = await fetchJsonWithTimeout(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    }, 6_000);
    if (!payload || typeof payload !== "object" || !Array.isArray((payload as { elevation?: unknown }).elevation)) {
      throw new Error("The elevation service returned invalid data.");
    }
    const elevations = (payload as { elevation: unknown[] }).elevation;
    return chunk.map((_, index) => {
      const elevation = Number(elevations[index]);
      return Number.isFinite(elevation) && elevation > -500 && elevation < 9000
        ? elevation
        : null;
    });
  }));

  return results.flatMap((result, chunkIndex) =>
    result.status === "fulfilled"
      ? result.value
      : chunks[chunkIndex].map(() => null),
  );
}
