import { parsePhotonPlaces } from "../../../../_lib/trail-archive";
import { fetchPhoton } from "../../../../_lib/trail-archive-server";

export const runtime = "nodejs";
export const maxDuration = 10;

function fallbackPlaceQuery(query: string) {
  const commaSeparated = query.split(",")[0]?.trim() ?? "";
  if (commaSeparated.length >= 2 && commaSeparated !== query) return commaSeparated;
  const words = query.split(/\s+/).filter(Boolean);
  return words.length > 1 ? words.slice(0, -1).join(" ") : "";
}

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 80) {
    return errorResponse("Enter a place name between 2 and 80 characters.", 400);
  }

  try {
    const payload = await fetchPhoton(query);
    let places = parsePhotonPlaces(payload);
    const fallbackQuery = fallbackPlaceQuery(query);
    if (!places.length && fallbackQuery.length >= 2 && fallbackQuery !== query) {
      places = parsePhotonPlaces(await fetchPhoton(fallbackQuery));
    }
    return Response.json({ places }, {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
    });
  } catch {
    return errorResponse("The place search service is temporarily unavailable.", 502);
  }
}
