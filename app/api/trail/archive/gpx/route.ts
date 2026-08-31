import {
  archiveFileName,
  buildArchiveGpx,
  connectArchiveWays,
  parseArchiveRelation,
  sampleArchiveSegments,
  type ArchiveCoordinate,
} from "../../../../_lib/trail-archive";
import {
  fetchElevations,
  fetchOverpass,
  fetchOsmRelationFull,
} from "../../../../_lib/trail-archive-server";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_RELATION_WAYS = 420;
const MAX_GEOMETRY_POINTS = 50_000;

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function relationId(value: string | null) {
  if (!value || !/^\d{1,12}$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function addElevations(
  segments: ArchiveCoordinate[][],
  elevations: Array<number | null>,
) {
  let index = 0;
  return segments.map((segment) => segment.map((point) => ({
    ...point,
    elevationM: elevations[index++] ?? null,
  })));
}

async function fetchRelationGeometryPayload(id: number) {
  try {
    return await fetchOsmRelationFull(id);
  } catch {
    // The canonical OSM API is occasionally rate-limited or unreachable from
    // serverless regions. Overpass can return the same relation plus way
    // geometry in one bounded request, so use it as a transparent fallback.
    return fetchOverpass(
      `[out:json][timeout:18];relation(${id});out body;way(r);out geom;`,
      21_000,
    );
  }
}

export async function GET(request: Request) {
  const id = relationId(new URL(request.url).searchParams.get("id"));
  if (id == null) return errorResponse("A valid OpenStreetMap relation ID is required.", 400);

  try {
    const relationPayload = await fetchRelationGeometryPayload(id);
    const relation = parseArchiveRelation(relationPayload, id);
    if (relation.ways.length > MAX_RELATION_WAYS) {
      return errorResponse(
        "This very large route cannot yet be converted safely. Try a shorter regional route.",
        413,
      );
    }

    const connected = connectArchiveWays(relation.ways, relationPayload);
    const geometryPointCount = connected.reduce((sum, segment) => sum + segment.length, 0);
    if (geometryPointCount < 2) {
      return errorResponse("This route has no usable geometry.", 422);
    }
    if (geometryPointCount > MAX_GEOMETRY_POINTS) {
      return errorResponse("This route geometry is too large to process safely.", 413);
    }

    const sampled = sampleArchiveSegments(connected, 600);
    const flatPoints = sampled.flat();
    let elevations: Array<number | null> = flatPoints.map(() => null);
    try {
      elevations = await fetchElevations(flatPoints);
    } catch {
      // A route without elevation is still a valid GPX and can be previewed.
    }
    const elevated = addElevations(sampled, elevations);
    const elevationPointCount = elevations.filter((value) => value != null).length;

    return Response.json({
      fileName: archiveFileName(relation.name),
      gpx: buildArchiveGpx(relation.name, id, elevated),
      relationId: id,
      pointCount: flatPoints.length,
      segmentCount: elevated.length,
      elevationCoveragePct: Math.round((elevationPointCount / flatPoints.length) * 100),
      attribution: "© OpenStreetMap contributors",
    }, {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (/not a hiking route|no usable way|too fragmented/i.test(message)) {
      return errorResponse(message, 422);
    }
    return errorResponse("This archive route could not be retrieved right now.", 502);
  }
}
