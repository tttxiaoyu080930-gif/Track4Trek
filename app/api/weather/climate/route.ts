const NASA_POWER_ENDPOINT =
  "https://power.larc.nasa.gov/api/temporal/climatology/point";

const NASA_POWER_PARAMETERS = [
  "T2M",
  "T2M_MAX",
  "T2M_MIN",
  "PRECTOTCORR",
  "RH2M",
  "WS10M",
  "WS10M_MAX",
  "CLOUD_AMT",
] as const;

const CACHE_CONTROL =
  "public, s-maxage=2592000, stale-while-revalidate=86400";

export const runtime = "nodejs";
export const maxDuration = 10;

function errorResponse(message: string, status: number) {
  return Response.json(
    { error: message },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

function coordinate(value: string | null, minimum: number, maximum: number) {
  if (value == null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : null;
}

/**
 * Proxy NASA POWER's monthly climatology through the app origin. NASA POWER
 * does not consistently return browser CORS headers, while the client only
 * needs a single, fixed set of read-only parameters.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const latitude = coordinate(searchParams.get("latitude"), -90, 90);
  const longitude = coordinate(searchParams.get("longitude"), -180, 180);
  if (latitude == null || longitude == null) {
    return errorResponse("Valid latitude and longitude are required.", 400);
  }

  const upstreamUrl = new URL(NASA_POWER_ENDPOINT);
  upstreamUrl.searchParams.set("parameters", NASA_POWER_PARAMETERS.join(","));
  upstreamUrl.searchParams.set("community", "RE");
  upstreamUrl.searchParams.set("longitude", longitude.toFixed(5));
  upstreamUrl.searchParams.set("latitude", latitude.toFixed(5));
  upstreamUrl.searchParams.set("format", "JSON");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(upstreamUrl, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      next: { revalidate: 2_592_000 },
    });
    if (!response.ok) {
      return errorResponse(`NASA POWER returned ${response.status}.`, 502);
    }

    const body = await response.text();
    try {
      JSON.parse(body);
    } catch {
      return errorResponse("NASA POWER returned invalid JSON.", 502);
    }

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": CACHE_CONTROL,
      },
    });
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return errorResponse("NASA POWER request timed out.", 504);
    }
    return errorResponse("NASA POWER is unavailable.", 502);
  } finally {
    clearTimeout(timeout);
  }
}
