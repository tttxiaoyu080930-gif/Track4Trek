import {
  buildArchiveRouteQuery,
  normalizeArchiveBoundingBox,
  parseArchiveRoutes,
} from "../../../../_lib/trail-archive";
import { fetchOverpass } from "../../../../_lib/trail-archive-server";

export const runtime = "nodejs";
export const maxDuration = 16;

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const boundingBox = normalizeArchiveBoundingBox({
    south: searchParams.get("south"),
    west: searchParams.get("west"),
    north: searchParams.get("north"),
    east: searchParams.get("east"),
  });
  if (!boundingBox) return errorResponse("A valid search area is required.", 400);

  try {
    const payload = await fetchOverpass(buildArchiveRouteQuery(boundingBox), 13_000);
    return Response.json({
      routes: parseArchiveRoutes(payload),
      attribution: "© OpenStreetMap contributors",
    }, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch {
    return errorResponse("The OpenStreetMap route archive is temporarily unavailable.", 502);
  }
}
