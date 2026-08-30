import type {
  PreviewGeographicPoint,
  RoutePreview,
} from "./route-data";

/**
 * Weather is deliberately kept independent from React.  The result UI can
 * consume this contract in overview mode and in the technical workspace
 * without each surface inventing a different interpretation of the API.
 */
export const WEATHER_MODEL_VERSION = "weather-v0.2" as const;

export type WeatherSource = "open-meteo" | "nasa-power" | "mixed" | "fallback";
export type WeatherDataStatus = "ready" | "partial" | "fallback";
export type WeatherPointRole =
  | "center"
  | "start"
  | "quarter"
  | "midpoint"
  | "three-quarter"
  | "highest"
  | "lowest"
  | "finish";

export type WeatherRoutePoint = {
  id: string;
  role: WeatherPointRole;
  latitude: number;
  longitude: number;
  elevationM: number | null;
  distanceKm: number | null;
};

/** Values are normalized to 0..100 unless the name contains a physical unit. */
export type WeatherIndices = {
  /** Combined weather strain; higher means more demanding. */
  difficulty: number;
  /** Heat strain; higher means hotter or more humid. */
  heat: number;
  /** Snow/ice threat; higher means more disruptive. */
  snow: number;
  /** Convective/severe-weather threat proxy; higher means more severe. */
  storm: number;
  /** Wet-weather threat; higher means more precipitation exposure. */
  precipitation: number;
  /** Visibility quality; higher means clearer conditions. */
  visibility: number;
  /** Wind exposure; higher means stronger wind or gusts. */
  wind: number;
  /** UV exposure; higher means stronger UV. */
  uv: number;
  /** Cold strain; higher means colder conditions. */
  cold: number;
};

export type WeatherObservationInputs = {
  temperatureC?: number | null;
  apparentTemperatureC?: number | null;
  minimumTemperatureC?: number | null;
  maximumTemperatureC?: number | null;
  humidityPct?: number | null;
  precipitationProbabilityPct?: number | null;
  precipitationMm?: number | null;
  snowfallCm?: number | null;
  snowDepthM?: number | null;
  weatherCode?: number | null;
  visibilityM?: number | null;
  cloudCoverPct?: number | null;
  windSpeedKmh?: number | null;
  windGustKmh?: number | null;
  capeJkg?: number | null;
  freezingLevelM?: number | null;
  routeElevationM?: number | null;
  uvIndex?: number | null;
};

export type WeatherMonthlySummary = {
  month: number;
  meanTemperatureC: number | null;
  minimumTemperatureC: number | null;
  maximumTemperatureC: number | null;
  apparentTemperatureC: number | null;
  precipitationMmPerDay: number | null;
  precipitationDaysPct: number | null;
  snowfallCm: number | null;
  snowDaysPct: number | null;
  humidityPct: number | null;
  cloudCoverPct: number | null;
  windSpeedKmh: number | null;
  windGustKmh: number | null;
  indices: WeatherIndices;
  source: "nasa-power" | "fallback";
};

export type WeatherHourlySample = {
  time: string;
  temperatureC: number | null;
  apparentTemperatureC: number | null;
  humidityPct: number | null;
  dewPointC: number | null;
  precipitationProbabilityPct: number | null;
  precipitationMm: number | null;
  rainMm: number | null;
  showersMm: number | null;
  snowfallCm: number | null;
  snowDepthM: number | null;
  weatherCode: number | null;
  cloudCoverPct: number | null;
  cloudCoverLowPct: number | null;
  cloudCoverMidPct: number | null;
  cloudCoverHighPct: number | null;
  visibilityM: number | null;
  windSpeedKmh: number | null;
  windDirectionDeg: number | null;
  windGustKmh: number | null;
  freezingLevelM: number | null;
  uvIndex: number | null;
  capeJkg: number | null;
  surfacePressureHpa: number | null;
  pressureMslHpa: number | null;
  isDay: boolean | null;
  indices: WeatherIndices;
};

export type WeatherDailySummary = {
  date: string;
  minimumTemperatureC: number | null;
  meanTemperatureC: number | null;
  maximumTemperatureC: number | null;
  apparentMinimumTemperatureC: number | null;
  apparentMaximumTemperatureC: number | null;
  precipitationMm: number | null;
  rainMm: number | null;
  showersMm: number | null;
  snowfallCm: number | null;
  precipitationProbabilityMaxPct: number | null;
  precipitationHours: number | null;
  weatherCode: number | null;
  windSpeedMaxKmh: number | null;
  windGustMaxKmh: number | null;
  windDirectionDeg: number | null;
  sunrise: string | null;
  sunset: string | null;
  daylightSeconds: number | null;
  sunshineSeconds: number | null;
  uvIndexMax: number | null;
  /** Route-wide values use conservative extrema across sampled points. */
  visibilityMinM: number | null;
  freezingLevelMinM: number | null;
  cloudCoverMaxPct: number | null;
  indices: WeatherIndices;
  /** Point that produced the highest route-wide weather strain, when known. */
  worstPointId?: string;
  worstPointRole?: WeatherPointRole;
};

export type WeatherPointForecast = {
  point: WeatherRoutePoint;
  latitude: number;
  longitude: number;
  elevationM: number | null;
  timezone: string | null;
  utcOffsetSeconds: number | null;
  model: string | null;
  hourly: WeatherHourlySample[];
  daily: WeatherDailySummary[];
};

export type RouteWeatherData = {
  modelVersion: typeof WEATHER_MODEL_VERSION;
  status: WeatherDataStatus;
  source: WeatherSource;
  fetchedAt: string;
  routePoints: WeatherRoutePoint[];
  location: {
    latitude: number | null;
    longitude: number | null;
    elevationM: number | null;
    timezone: string | null;
  };
  monthly: WeatherMonthlySummary[];
  forecasts: WeatherPointForecast[];
  /** A conservative route-wide aggregation of the sampled point forecasts. */
  daily: WeatherDailySummary[];
  /** Metadata for the seasonal product; null when NASA POWER did not respond. */
  climateContext: {
    provider: "nasa-power";
    scope: "route-centre";
    latitude: number;
    longitude: number;
    baselineStart: "2001-01";
    baselineEnd: "2020-12";
  } | null;
  errors: string[];
  attribution: readonly string[];
};

export type WeatherFetchOptions = {
  forecastDays?: number;
  includeForecast?: boolean;
  includeClimate?: boolean;
  maxRoutePoints?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
};

export const WEATHER_ATTRIBUTION = [
  "Weather data by Open-Meteo.com",
  "Monthly climate context by NASA POWER",
] as const;

/**
 * Provider failures are deliberately normalized to a small set of user-facing
 * messages. The model keeps the English diagnostic for logs/tests, while the
 * UI can safely render the same information after a language switch without
 * leaking an English-only sentence into the Mandarin surface.
 */
export function localizeWeatherError(
  error: string,
  language: "en" | "zh",
) {
  if (language === "en") return error;
  if (/^Weather providers are unavailable\.?$/i.test(error)) {
    return "天气服务暂不可用。";
  }
  if (/^A weather source was unavailable\.?$/i.test(error)) {
    return "一个天气数据源暂不可用。";
  }
  const monthly = /^The monthly climate response included temperature data for (\d+) of (\d+) months\.?$/i.exec(error);
  if (monthly) {
    return `月度气候响应提供了 ${monthly[1]} / ${monthly[2]} 个月的温度数据。`;
  }
  if (/^The monthly climate response was incomplete\.?$/i.test(error)) {
    return "月度气候响应不完整。";
  }
  const forecast = /^The route forecast covered (\d+) of (\d+) sampled points\.?$/i.exec(error);
  if (forecast) {
    return `路线预报覆盖了 ${forecast[1]} / ${forecast[2]} 个采样点。`;
  }
  return "天气数据响应不完整。";
}

export function localizeWeatherAttribution(
  attribution: string,
  language: "en" | "zh",
) {
  if (language === "en") return attribution;
  if (attribution === "Weather data by Open-Meteo.com") return "天气数据：Open-Meteo.com";
  if (attribution === "Monthly climate context by NASA POWER") return "月度气候背景：NASA POWER";
  return "天气数据来源";
}

const OPEN_METEO_ATTRIBUTION = WEATHER_ATTRIBUTION[0];
const NASA_POWER_ATTRIBUTION = WEATHER_ATTRIBUTION[1];

const OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
// NASA POWER does not currently expose the CORS headers needed by every
// browser.  Keep the provider request behind our same-origin route handler so
// Overview and Pro behave consistently in local development and on Vercel.
const NASA_POWER_CLIMATOLOGY_URL = "/api/weather/climate";

const OPEN_METEO_HOURLY_FIELDS = [
  "temperature_2m",
  "apparent_temperature",
  "relative_humidity_2m",
  "dew_point_2m",
  "precipitation_probability",
  "precipitation",
  "rain",
  "showers",
  "snowfall",
  "snow_depth",
  "weather_code",
  "cloud_cover",
  "cloud_cover_low",
  "cloud_cover_mid",
  "cloud_cover_high",
  "visibility",
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",
  "freezing_level_height",
  "uv_index",
  "cape",
  "surface_pressure",
  "pressure_msl",
  "is_day",
] as const;

const OPEN_METEO_DAILY_FIELDS = [
  "temperature_2m_min",
  "temperature_2m_mean",
  "temperature_2m_max",
  "apparent_temperature_min",
  "apparent_temperature_max",
  "precipitation_sum",
  "rain_sum",
  "showers_sum",
  "snowfall_sum",
  "precipitation_probability_max",
  "precipitation_hours",
  "weather_code",
  "wind_speed_10m_max",
  "wind_gusts_10m_max",
  "wind_direction_10m_dominant",
  "sunrise",
  "sunset",
  "daylight_duration",
  "sunshine_duration",
  "uv_index_max",
] as const;

const NASA_POWER_FIELDS = [
  "T2M",
  "T2M_MAX",
  "T2M_MIN",
  "PRECTOTCORR",
  "RH2M",
  "WS10M",
  "WS10M_MAX",
  "CLOUD_AMT",
] as const;

const MONTH_KEYS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
] as const;

function clamp(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(Math.max(value, minimum), maximum);
}

function round(value: number, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function finite(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function finiteNasa(value: unknown): number | null {
  const parsed = finite(value);
  // NASA POWER declares -999.0 as its missing-data fill value. None of the
  // requested physical fields can legitimately approach this range.
  return parsed == null || parsed <= -998 ? null : parsed;
}

function finiteArray(value: unknown): Array<number | null> {
  return Array.isArray(value) ? value.map(finite) : [];
}

function stringArray(value: unknown): Array<string | null> {
  return Array.isArray(value)
    ? value.map((entry) => typeof entry === "string" ? entry : null)
    : [];
}

function booleanArray(value: unknown): Array<boolean | null> {
  return Array.isArray(value)
    ? value.map((entry) => typeof entry === "boolean" ? entry : finite(entry) === 1 ? true : finite(entry) === 0 ? false : null)
    : [];
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value != null
    ? value as Record<string, unknown>
    : null;
}

function valueAt(values: Array<number | null>, index: number) {
  return values[index] ?? null;
}

function stringAt(values: Array<string | null>, index: number) {
  return values[index] ?? null;
}

function booleanAt(values: Array<boolean | null>, index: number) {
  return values[index] ?? null;
}

function haversineKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const radiusKm = 6371.0088;
  const latA = a.latitude * Math.PI / 180;
  const latB = b.latitude * Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * Math.PI / 180;
  const dLon = (b.longitude - a.longitude) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(latA) * Math.cos(latB) * Math.sin(dLon / 2) ** 2;
  const bounded = clamp(h, 0, 1);
  return 2 * radiusKm * Math.atan2(Math.sqrt(bounded), Math.sqrt(1 - bounded));
}

function elevationOf(point: PreviewGeographicPoint) {
  return point.elevationM == null || !Number.isFinite(point.elevationM)
    ? null
    : point.elevationM;
}

function routeCoordinates(preview: RoutePreview) {
  const segments = (preview.geographicSegments ?? [])
    .filter((segment) => segment.length > 0);
  if (segments.reduce((count, segment) => count + segment.length, 0) >= 2) {
    // Keep cumulative distance continuous within each GPX segment, but do not
    // invent a straight-line jump between separate tracks.
    let distanceKm = 0;
    const located: Array<{ point: PreviewGeographicPoint; distanceKm: number }> = [];
    for (const segment of segments) {
      segment.forEach((point, index) => {
        if (index > 0) distanceKm += haversineKm(segment[index - 1], point);
        located.push({ point, distanceKm });
      });
    }
    return located;
  }

  const box = preview.stats.boundingBox;
  if (!box) return [];
  return [{
    point: {
      latitude: (box.north + box.south) / 2,
      longitude: (box.east + box.west) / 2,
      elevationM: preview.stats.highestElevationM ?? preview.stats.lowestElevationM ?? null,
    },
    distanceKm: 0,
  }];
}

function pointForLocated(
  id: string,
  role: WeatherPointRole,
  located: Array<{ point: PreviewGeographicPoint; distanceKm: number }>,
  index: number,
): WeatherRoutePoint | null {
  const entry = located[Math.min(Math.max(index, 0), located.length - 1)];
  if (!entry) return null;
  return {
    id,
    role,
    latitude: entry.point.latitude,
    longitude: entry.point.longitude,
    elevationM: elevationOf(entry.point),
    distanceKm: round(entry.distanceKm, 2),
  } satisfies WeatherRoutePoint;
}

/** Pick a small, deterministic set that represents route length and elevation. */
export function sampleRouteWeatherPoints(preview: RoutePreview, maxPoints = 6) {
  const located = routeCoordinates(preview);
  if (!located.length) return [];
  if (located.length === 1) {
    const only = pointForLocated("center", "center", located, 0);
    return only ? [only] : [];
  }

  const lastIndex = located.length - 1;
  const totalDistance = Math.max(located[lastIndex].distanceKm, 0);
  const nearestDistanceIndex = (fraction: number) => {
    const target = totalDistance * fraction;
    return located.reduce((selected, entry, index) =>
      Math.abs(entry.distanceKm - target) < Math.abs(located[selected].distanceKm - target)
        ? index
        : selected, 0);
  };
  const highestIndex = located.reduce((selected, entry, index) => {
    const elevation = elevationOf(entry.point);
    const selectedElevation = elevationOf(located[selected].point);
    return elevation != null && (selectedElevation == null || elevation > selectedElevation)
      ? index
      : selected;
  }, 0);
  const lowestIndex = located.reduce((selected, entry, index) => {
    const elevation = elevationOf(entry.point);
    const selectedElevation = elevationOf(located[selected].point);
    return elevation != null && (selectedElevation == null || elevation < selectedElevation)
      ? index
      : selected;
  }, 0);

  const candidates: Array<[string, WeatherPointRole, number]> = [
    ["start", "start", 0],
    ["quarter", "quarter", nearestDistanceIndex(0.25)],
    ["midpoint", "midpoint", nearestDistanceIndex(0.5)],
    ["three-quarter", "three-quarter", nearestDistanceIndex(0.75)],
    ["highest", "highest", highestIndex],
    ["lowest", "lowest", lowestIndex],
    ["finish", "finish", lastIndex],
  ];
  // Four points are the minimum useful route context: start, finish, highest,
  // and lowest. They may collapse to fewer coordinates on a short route.
  const targetCount = Math.max(4, Math.min(Math.round(maxPoints), 12));
  // Endpoints and elevation extrema carry the most useful route context. Fill
  // remaining slots with evenly spaced distance samples, then de-duplicate.
  const priority = [candidates[0], candidates[6], candidates[4], candidates[5]];
  const remainder = candidates.slice(1, 4);
  const selected = [...priority, ...remainder].slice(0, Math.min(targetCount, candidates.length));

  const seen = new Set<string>();
  return selected
    .map(([id, role, index]) => pointForLocated(id, role, located, index))
    .filter((point): point is WeatherRoutePoint => point !== null)
    .filter((point) => {
      const key = `${point.latitude.toFixed(4)}:${point.longitude.toFixed(4)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, targetCount);
}

function centrePoint(preview: RoutePreview, points: WeatherRoutePoint[]) {
  const box = preview.stats.boundingBox;
  if (box) {
    return {
      latitude: (box.north + box.south) / 2,
      longitude: (box.east + box.west) / 2,
      elevationM: preview.stats.highestElevationM == null || preview.stats.lowestElevationM == null
        ? null
        : round((preview.stats.highestElevationM + preview.stats.lowestElevationM) / 2),
    };
  }
  const first = points[0];
  return first
    ? { latitude: first.latitude, longitude: first.longitude, elevationM: first.elevationM }
    : { latitude: null, longitude: null, elevationM: null };
}

function normalize(value: number | null | undefined, minimum: number, maximum: number) {
  if (value == null || !Number.isFinite(value)) return 0;
  return clamp(((value - minimum) / Math.max(maximum - minimum, Number.EPSILON)) * 100, 0, 100);
}

function normalizedOrNull(value: number | null | undefined, minimum: number, maximum: number) {
  return value == null || !Number.isFinite(value)
    ? null
    : normalize(value, minimum, maximum);
}

function inverseNormalize(value: number | null | undefined, minimum: number, maximum: number) {
  return 100 - normalize(value, minimum, maximum);
}

function maxFinite(values: Array<number | null>) {
  const valid = values.filter((value): value is number => value != null && Number.isFinite(value));
  return valid.length ? Math.max(...valid) : null;
}

function minFinite(values: Array<number | null>) {
  const valid = values.filter((value): value is number => value != null && Number.isFinite(value));
  return valid.length ? Math.min(...valid) : null;
}

function meanFinite(values: Array<number | null>) {
  const valid = values.filter((value): value is number => value != null && Number.isFinite(value));
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

function weatherCodeSeverity(code: number | null | undefined) {
  if (code == null || !Number.isFinite(code)) return 0;
  if (code >= 95) return 95;
  if (code >= 80) return 55;
  if (code >= 65) return 45;
  if (code >= 51) return 28;
  if (code === 45 || code === 48) return 38;
  return 0;
}

/** Convert provider fields to the normalized wheels used by both views. */
export function calculateWeatherIndices(input: WeatherObservationInputs): WeatherIndices {
  const baseTemperature = input.apparentTemperatureC ?? input.temperatureC;
  const minimum = input.minimumTemperatureC ?? input.temperatureC ?? null;
  const temperatureScore = normalizedOrNull(baseTemperature, 18, 38);
  const humidityScore = normalizedOrNull(input.humidityPct, 55, 100);
  const heat = temperatureScore == null
    ? 0
    : clamp(temperatureScore + (humidityScore ?? 0) * 0.22, 0, 100);
  const cold = normalizedOrNull(minimum, -10, 12) == null
    ? 0
    : inverseNormalize(minimum, -10, 12);

  const precipitationProbability = normalizedOrNull(input.precipitationProbabilityPct, 20, 90);
  const precipitationAmount = normalizedOrNull(input.precipitationMm, 1, 30);
  const precipitation = clamp(Math.max(precipitationProbability ?? 0, precipitationAmount ?? 0), 0, 100);
  const snowAmount = normalizedOrNull(input.snowfallCm, 0.2, 12) ?? 0;
  const snowDepth = normalizedOrNull(input.snowDepthM, 0.01, 0.3) ?? 0;
  const freezePenalty = input.freezingLevelM != null && input.routeElevationM != null
    ? input.routeElevationM >= input.freezingLevelM ? 45 : 0
    : minimum != null && minimum <= 0 ? 30 : 0;
  const snow = clamp(Math.max(snowAmount * 0.65 + snowDepth * 0.35, freezePenalty), 0, 100);

  const gust = normalizedOrNull(input.windGustKmh ?? input.windSpeedKmh, 25, 90) ?? 0;
  const cape = normalizedOrNull(input.capeJkg, 250, 2500) ?? 0;
  const storm = clamp(Math.max(weatherCodeSeverity(input.weatherCode), gust * 0.45 + cape * 0.55), 0, 100);

  const visibilityFromDistance = input.visibilityM == null
    ? input.cloudCoverPct == null ? null : inverseNormalize(input.cloudCoverPct, 25, 100)
    : normalize(input.visibilityM, 1000, 20_000);
  const precipitationVisibility = input.precipitationProbabilityPct == null
    ? null
    : inverseNormalize(input.precipitationProbabilityPct, 25, 95);
  const visibility = visibilityFromDistance == null
    ? precipitationVisibility ?? 50
    : clamp(visibilityFromDistance * 0.82 + (precipitationVisibility ?? 50) * 0.18, 0, 100);
  const windSpeed = normalizedOrNull(input.windSpeedKmh, 15, 70);
  const windGust = normalizedOrNull(input.windGustKmh, 25, 90);
  const wind = clamp(Math.max(windSpeed ?? 0, windGust ?? 0), 0, 100);
  const uv = normalizedOrNull(input.uvIndex, 2, 11) ?? 0;

  const terms = [
    [heat, baseTemperature != null, 0.2],
    [snow, input.snowfallCm != null || input.snowDepthM != null || input.freezingLevelM != null || minimum != null, 0.2],
    [storm, input.weatherCode != null || input.windSpeedKmh != null || input.windGustKmh != null || input.capeJkg != null, 0.2],
    [precipitation, input.precipitationProbabilityPct != null || input.precipitationMm != null, 0.17],
    [100 - visibility, input.visibilityM != null || input.cloudCoverPct != null || input.precipitationProbabilityPct != null, 0.1],
    [wind, input.windSpeedKmh != null || input.windGustKmh != null, 0.08],
    [uv, input.uvIndex != null, 0.05],
    [cold, minimum != null, 0.05],
  ] as const;
  const knownTerms = terms.filter((term) => term[1]);
  const totalWeight = knownTerms.reduce((sum, term) => sum + term[2], 0);
  const difficulty = totalWeight === 0
    ? 0
    : clamp(knownTerms.reduce((sum, term) => sum + term[0] * term[2], 0) / totalWeight, 0, 100);

  return {
    difficulty: round(difficulty),
    heat: round(heat),
    snow: round(snow),
    storm: round(storm),
    precipitation: round(precipitation),
    visibility: round(visibility),
    wind: round(wind),
    uv: round(uv),
    cold: round(cold),
  };
}

function fallbackMonthly(preview: RoutePreview, points: WeatherRoutePoint[]): WeatherMonthlySummary[] {
  const centre = centrePoint(preview, points);
  const latitude = centre.latitude ?? 35;
  const latitudeMagnitude = Math.min(Math.abs(latitude), 66);
  const elevationCooling = Math.max(centre.elevationM ?? 0, 0) / 1000 * 6.5;
  const routeWetness = clamp((preview.stats.totalDistanceKm / 100) + (preview.stats.totalAscentM ?? 0) / 10_000, 0, 0.35);
  const hemisphere = latitude < 0 ? -1 : 1;

  return MONTH_KEYS.map((_, monthIndex) => {
    const phase = ((monthIndex + 0.5) / 12) * Math.PI * 2;
    const seasonal = Math.cos((phase - (hemisphere > 0 ? Math.PI : 0)));
    const amplitude = 7 + latitudeMagnitude * 0.16;
    const mean = 20 + seasonal * amplitude - elevationCooling;
    const minimum = mean - (5 + latitudeMagnitude * 0.025);
    const maximum = mean + (5 + latitudeMagnitude * 0.025);
    const humidity = clamp(72 + seasonal * -8 + routeWetness * 25, 25, 98);
    const precipitation = clamp(2.2 + (1 - seasonal) * 2.7 + routeWetness * 8, 0.2, 12);
    const precipitationDays = clamp(22 + (1 - seasonal) * 14 + routeWetness * 16, 4, 88);
    const snowfall = minimum <= 1 ? clamp((1 - minimum) * 1.8, 0, 18) : 0;
    const snowDays = snowfall > 0 ? clamp(snowfall * 5, 0, 85) : 0;
    const wind = clamp(16 + (1 - seasonal) * 5, 4, 45);
    const gust = wind * 1.9;
    const cloud = clamp(58 + (1 - seasonal) * 18 + routeWetness * 12, 10, 98);
    const indices = calculateWeatherIndices({
      temperatureC: mean,
      apparentTemperatureC: mean + (humidity > 78 ? 1.5 : 0),
      minimumTemperatureC: minimum,
      maximumTemperatureC: maximum,
      humidityPct: humidity,
      precipitationMm: precipitation,
      precipitationProbabilityPct: precipitationDays,
      snowfallCm: snowfall,
      cloudCoverPct: cloud,
      windSpeedKmh: wind,
      windGustKmh: gust,
      routeElevationM: centre.elevationM,
    });
    return {
      month: monthIndex + 1,
      meanTemperatureC: round(mean),
      minimumTemperatureC: round(minimum),
      maximumTemperatureC: round(maximum),
      apparentTemperatureC: round(mean + (humidity > 78 ? 1.5 : 0)),
      precipitationMmPerDay: round(precipitation),
      precipitationDaysPct: round(precipitationDays),
      snowfallCm: round(snowfall),
      snowDaysPct: round(snowDays),
      humidityPct: round(humidity),
      cloudCoverPct: round(cloud),
      windSpeedKmh: round(wind),
      windGustKmh: round(gust),
      indices,
      source: "fallback" as const,
    };
  });
}

type NasaMonthlyParseResult = {
  monthly: WeatherMonthlySummary[];
  complete: boolean;
  availableMonthCount: number;
  completeMonthCount: number;
};

function parseNasaMonthly(
  payload: unknown,
  preview: RoutePreview,
  points: WeatherRoutePoint[],
): NasaMonthlyParseResult | null {
  const root = record(payload);
  const properties = record(root?.properties);
  const parameters = record(properties?.parameter);
  if (!parameters) return null;

  const parameter = (name: string) => record(parameters[name]);
  const centre = centrePoint(preview, points);
  const fallback = fallbackMonthly(preview, points);
  let availableMonthCount = 0;
  let completeMonthCount = 0;
  const monthly: WeatherMonthlySummary[] = MONTH_KEYS.map((key, index) => {
    const get = (name: string) => finiteNasa(parameter(name)?.[key]);
    const mean = get("T2M");
    const minimum = get("T2M_MIN");
    const maximum = get("T2M_MAX");
    const precipitation = get("PRECTOTCORR");
    const humidity = get("RH2M");
    const windMs = get("WS10M");
    const gustMs = get("WS10M_MAX");
    const cloud = get("CLOUD_AMT");
    const providerValues = [
      mean,
      minimum,
      maximum,
      precipitation,
      humidity,
      windMs,
      gustMs,
      cloud,
    ];
    const hasProviderData = providerValues.some((value) => value != null);
    const hasTemperatureData = [mean, minimum, maximum].some((value) => value != null);
    if (!hasProviderData) return fallback[index];
    availableMonthCount += 1;
    // A month is considered present when at least one temperature statistic is
    // available; the other parameters are optional in POWER responses.
    if (hasTemperatureData) completeMonthCount += 1;
    const indices = calculateWeatherIndices({
      temperatureC: mean,
      apparentTemperatureC: mean,
      minimumTemperatureC: minimum,
      maximumTemperatureC: maximum,
      humidityPct: humidity,
      precipitationMm: precipitation,
      cloudCoverPct: cloud,
      windSpeedKmh: windMs == null ? null : windMs * 3.6,
      windGustKmh: gustMs == null ? null : gustMs * 3.6,
      routeElevationM: centre.elevationM,
    });
    return {
      month: index + 1,
      meanTemperatureC: mean == null ? null : round(mean),
      minimumTemperatureC: minimum == null ? null : round(minimum),
      maximumTemperatureC: maximum == null ? null : round(maximum),
      apparentTemperatureC: mean == null ? null : round(mean),
      // NASA POWER's PRECTOTCORR climatology value is an average daily rate.
      precipitationMmPerDay: precipitation == null ? null : round(precipitation),
      // PRECTOTCORR does not encode wet-day frequency or probability.
      precipitationDaysPct: null,
      snowfallCm: null,
      snowDaysPct: null,
      humidityPct: humidity == null ? null : round(humidity),
      cloudCoverPct: cloud == null ? null : round(cloud),
      windSpeedKmh: windMs == null ? null : round(windMs * 3.6),
      windGustKmh: gustMs == null ? null : round(gustMs * 3.6),
      indices,
      source: "nasa-power" as const,
    } satisfies WeatherMonthlySummary;
  });

  return availableMonthCount
    ? {
        monthly,
        complete: completeMonthCount === MONTH_KEYS.length,
        availableMonthCount,
        completeMonthCount,
      }
    : null;
}

function parseDaily(recordValue: Record<string, unknown>, routeElevationM: number | null): WeatherDailySummary[] {
  const daily = record(recordValue.daily);
  if (!daily) return [];
  const dates = stringArray(daily.time);
  const fields = new Map<string, Array<number | null>>();
  for (const field of OPEN_METEO_DAILY_FIELDS) {
    if (field === "sunrise" || field === "sunset") continue;
    fields.set(field, finiteArray(daily[field]));
  }
  const sunrise = stringArray(daily.sunrise);
  const sunset = stringArray(daily.sunset);
  return dates.map((date, index) => {
    const get = (field: string) => valueAt(fields.get(field) ?? [], index);
    const minimum = get("temperature_2m_min");
    const mean = get("temperature_2m_mean");
    const maximum = get("temperature_2m_max");
    const apparentMinimum = get("apparent_temperature_min");
    const apparentMaximum = get("apparent_temperature_max");
    const precipitation = get("precipitation_sum");
    const probability = get("precipitation_probability_max");
    const code = get("weather_code");
    const windMax = get("wind_speed_10m_max");
    const gustMax = get("wind_gusts_10m_max");
    const indices = calculateWeatherIndices({
      temperatureC: mean,
      apparentTemperatureC: apparentMaximum ?? mean,
      minimumTemperatureC: minimum,
      maximumTemperatureC: maximum,
      precipitationProbabilityPct: probability,
      precipitationMm: precipitation,
      snowfallCm: get("snowfall_sum"),
      weatherCode: code,
      windSpeedKmh: windMax,
      windGustKmh: gustMax,
      uvIndex: get("uv_index_max"),
      routeElevationM,
    });
    return {
      date: date ?? "",
      minimumTemperatureC: minimum,
      meanTemperatureC: mean,
      maximumTemperatureC: maximum,
      apparentMinimumTemperatureC: apparentMinimum,
      apparentMaximumTemperatureC: apparentMaximum,
      precipitationMm: precipitation,
      rainMm: get("rain_sum"),
      showersMm: get("showers_sum"),
      snowfallCm: get("snowfall_sum"),
      precipitationProbabilityMaxPct: probability,
      precipitationHours: get("precipitation_hours"),
      weatherCode: code,
      windSpeedMaxKmh: windMax,
      windGustMaxKmh: gustMax,
      windDirectionDeg: get("wind_direction_10m_dominant"),
      sunrise: stringAt(sunrise, index),
      sunset: stringAt(sunset, index),
      daylightSeconds: get("daylight_duration"),
      sunshineSeconds: get("sunshine_duration"),
      uvIndexMax: get("uv_index_max"),
      visibilityMinM: null,
      freezingLevelMinM: null,
      cloudCoverMaxPct: null,
      indices,
    };
  }).filter((entry) => entry.date !== "");
}

function enrichDailyAtmosphere(
  daily: WeatherDailySummary[],
  hourly: WeatherHourlySample[],
  routeElevationM: number | null,
) {
  if (!daily.length || !hourly.length) return daily;
  return daily.map((entry) => {
    const sameDay = hourly.filter((sample) => sample.time.slice(0, 10) === entry.date);
    if (!sameDay.length) return entry;
    const visibility = minFinite(sameDay.map((sample) => sample.visibilityM));
    const freezing = minFinite(sameDay.map((sample) => sample.freezingLevelM));
    const cloud = maxFinite(sameDay.map((sample) => sample.cloudCoverPct));
    const indices = calculateWeatherIndices({
      temperatureC: entry.meanTemperatureC,
      apparentTemperatureC: entry.apparentMaximumTemperatureC ?? entry.meanTemperatureC,
      minimumTemperatureC: entry.minimumTemperatureC,
      maximumTemperatureC: entry.maximumTemperatureC,
      precipitationProbabilityPct: entry.precipitationProbabilityMaxPct,
      precipitationMm: entry.precipitationMm,
      snowfallCm: entry.snowfallCm,
      weatherCode: entry.weatherCode,
      visibilityM: visibility,
      cloudCoverPct: cloud,
      windSpeedKmh: entry.windSpeedMaxKmh,
      windGustKmh: entry.windGustMaxKmh,
      freezingLevelM: freezing,
      routeElevationM,
      uvIndex: entry.uvIndexMax,
    });
    return { ...entry, visibilityMinM: visibility, freezingLevelMinM: freezing, cloudCoverMaxPct: cloud, indices };
  });
}

function parseHourly(recordValue: Record<string, unknown>, routeElevationM: number | null): WeatherHourlySample[] {
  const hourly = record(recordValue.hourly);
  if (!hourly) return [];
  const times = stringArray(hourly.time);
  const fields = new Map<string, Array<number | null>>();
  for (const field of OPEN_METEO_HOURLY_FIELDS) {
    if (field === "is_day") continue;
    fields.set(field, finiteArray(hourly[field]));
  }
  const dayFlags = booleanArray(hourly.is_day);
  return times.map((time, index) => {
    const get = (field: string) => valueAt(fields.get(field) ?? [], index);
    const temperature = get("temperature_2m");
    const apparent = get("apparent_temperature");
    const probability = get("precipitation_probability");
    const precipitation = get("precipitation");
    const code = get("weather_code");
    const visibility = get("visibility");
    const wind = get("wind_speed_10m");
    const gust = get("wind_gusts_10m");
    return {
      time: time ?? "",
      temperatureC: temperature,
      apparentTemperatureC: apparent,
      humidityPct: get("relative_humidity_2m"),
      dewPointC: get("dew_point_2m"),
      precipitationProbabilityPct: probability,
      precipitationMm: precipitation,
      rainMm: get("rain"),
      showersMm: get("showers"),
      snowfallCm: get("snowfall"),
      snowDepthM: get("snow_depth"),
      weatherCode: code,
      cloudCoverPct: get("cloud_cover"),
      cloudCoverLowPct: get("cloud_cover_low"),
      cloudCoverMidPct: get("cloud_cover_mid"),
      cloudCoverHighPct: get("cloud_cover_high"),
      visibilityM: visibility,
      windSpeedKmh: wind,
      windDirectionDeg: get("wind_direction_10m"),
      windGustKmh: gust,
      freezingLevelM: get("freezing_level_height"),
      uvIndex: get("uv_index"),
      capeJkg: get("cape"),
      surfacePressureHpa: get("surface_pressure"),
      pressureMslHpa: get("pressure_msl"),
      isDay: booleanAt(dayFlags, index),
      indices: calculateWeatherIndices({
        temperatureC: temperature,
        apparentTemperatureC: apparent,
        humidityPct: get("relative_humidity_2m"),
        precipitationProbabilityPct: probability,
        precipitationMm: precipitation,
        snowfallCm: get("snowfall"),
        snowDepthM: get("snow_depth"),
        weatherCode: code,
        visibilityM: visibility,
        cloudCoverPct: get("cloud_cover"),
        windSpeedKmh: wind,
        windGustKmh: gust,
        freezingLevelM: get("freezing_level_height"),
        routeElevationM,
        uvIndex: get("uv_index"),
        capeJkg: get("cape"),
      }),
    };
  }).filter((entry) => entry.time !== "");
}

type OpenMeteoParseResult = {
  forecasts: WeatherPointForecast[];
  complete: boolean;
  availablePointCount: number;
};

function emptyPointForecast(point: WeatherRoutePoint): WeatherPointForecast {
  return {
    point,
    latitude: point.latitude,
    longitude: point.longitude,
    elevationM: point.elevationM,
    timezone: null,
    utcOffsetSeconds: null,
    model: null,
    hourly: [],
    daily: [],
  };
}

function parseOpenMeteo(payload: unknown, points: WeatherRoutePoint[]): OpenMeteoParseResult {
  const roots = Array.isArray(payload)
    ? payload.map(record)
    : [record(payload)];
  let availablePointCount = 0;
  const forecasts = points.map((requested, index) => {
    const root = roots[index];
    if (!root) return emptyPointForecast(requested);
    const returnedPoint: WeatherRoutePoint = {
      ...requested,
      latitude: finite(root.latitude) ?? requested.latitude,
      longitude: finite(root.longitude) ?? requested.longitude,
      elevationM: finite(root.elevation) ?? requested.elevationM,
    };
    const hourly = parseHourly(root, returnedPoint.elevationM);
    const daily = enrichDailyAtmosphere(parseDaily(root, returnedPoint.elevationM), hourly, returnedPoint.elevationM);
    if (hourly.length || daily.length) availablePointCount += 1;
    return {
      point: returnedPoint,
      latitude: returnedPoint.latitude,
      longitude: returnedPoint.longitude,
      elevationM: returnedPoint.elevationM,
      timezone: typeof root.timezone === "string" ? root.timezone : null,
      utcOffsetSeconds: finite(root.utc_offset_seconds),
      model: typeof root.model === "string" ? root.model : null,
      hourly,
      daily,
    } satisfies WeatherPointForecast;
  });

  return {
    forecasts,
    complete:
      points.length > 0 &&
      roots.length === points.length &&
      availablePointCount === points.length,
    availablePointCount,
  };
}

function worstWeatherCode(codes: Array<number | null>) {
  return codes.reduce<number | null>((selected, code) =>
    code != null && (selected == null || weatherCodeSeverity(code) > weatherCodeSeverity(selected))
      ? code
      : selected, null);
}

function aggregateRouteIndices(entries: Array<{ forecast: WeatherPointForecast; entry: WeatherDailySummary }>): {
  indices: WeatherIndices;
  worstPointId?: string;
  worstPointRole?: WeatherPointRole;
} {
  const maxIndex = (key: keyof WeatherIndices) => maxFinite(entries.map(({ entry }) => entry.indices[key]));
  const minIndex = (key: keyof WeatherIndices) => minFinite(entries.map(({ entry }) => entry.indices[key]));
  const worst = entries.reduce((selected, current) =>
    current.entry.indices.difficulty > selected.entry.indices.difficulty ? current : selected,
  entries[0]);

  return {
    indices: {
      difficulty: maxIndex("difficulty") ?? 0,
      heat: maxIndex("heat") ?? 0,
      snow: maxIndex("snow") ?? 0,
      storm: maxIndex("storm") ?? 0,
      precipitation: maxIndex("precipitation") ?? 0,
      // Visibility is a quality score, so the least-clear sampled point is the
      // route-wide value. This preserves a conservative warning for high terrain
      // or a clouded/snow-covered segment.
      visibility: minIndex("visibility") ?? 50,
      wind: maxIndex("wind") ?? 0,
      uv: maxIndex("uv") ?? 0,
      cold: maxIndex("cold") ?? 0,
    },
    worstPointId: worst?.forecast.point.id,
    worstPointRole: worst?.forecast.point.role,
  };
}

function aggregateDaily(forecasts: WeatherPointForecast[]) {
  const dates = [...new Set(forecasts.flatMap((forecast) => forecast.daily.map((entry) => entry.date)))].sort();
  return dates.map<WeatherDailySummary | null>((date) => {
    const entries = forecasts.flatMap((forecast) => forecast.daily
      .filter((entry) => entry.date === date)
      .map((entry) => ({ forecast, entry })));
    const first = entries[0]?.entry;
    if (!first) return null;
    const dailyEntries = entries.map(({ entry }) => entry);
    const minimum = minFinite(dailyEntries.map((entry) => entry.minimumTemperatureC));
    const mean = meanFinite(dailyEntries.map((entry) => entry.meanTemperatureC));
    const maximum = maxFinite(dailyEntries.map((entry) => entry.maximumTemperatureC));
    const apparentMinimum = minFinite(dailyEntries.map((entry) => entry.apparentMinimumTemperatureC));
    const apparentMaximum = maxFinite(dailyEntries.map((entry) => entry.apparentMaximumTemperatureC));
    const precipitation = maxFinite(dailyEntries.map((entry) => entry.precipitationMm));
    const probability = maxFinite(dailyEntries.map((entry) => entry.precipitationProbabilityMaxPct));
    const windMax = maxFinite(dailyEntries.map((entry) => entry.windSpeedMaxKmh));
    const gustMax = maxFinite(dailyEntries.map((entry) => entry.windGustMaxKmh));
    const snowfall = maxFinite(dailyEntries.map((entry) => entry.snowfallCm));
    const visibilityMin = minFinite(dailyEntries.map((entry) => entry.visibilityMinM));
    const freezingMin = minFinite(dailyEntries.map((entry) => entry.freezingLevelMinM));
    const cloudMax = maxFinite(dailyEntries.map((entry) => entry.cloudCoverMaxPct));
    const routeIndices = aggregateRouteIndices(entries);
    return {
      date,
      minimumTemperatureC: minimum,
      meanTemperatureC: mean,
      maximumTemperatureC: maximum,
      apparentMinimumTemperatureC: apparentMinimum,
      apparentMaximumTemperatureC: apparentMaximum,
      precipitationMm: precipitation,
      rainMm: maxFinite(dailyEntries.map((entry) => entry.rainMm)),
      showersMm: maxFinite(dailyEntries.map((entry) => entry.showersMm)),
      snowfallCm: snowfall,
      precipitationProbabilityMaxPct: probability,
      precipitationHours: maxFinite(dailyEntries.map((entry) => entry.precipitationHours)),
      weatherCode: worstWeatherCode(dailyEntries.map((entry) => entry.weatherCode)),
      windSpeedMaxKmh: windMax,
      windGustMaxKmh: gustMax,
      windDirectionDeg: entries.find(({ forecast }) => forecast.point.id === routeIndices.worstPointId)?.entry.windDirectionDeg ?? first.windDirectionDeg,
      sunrise: first.sunrise,
      sunset: first.sunset,
      daylightSeconds: first.daylightSeconds,
      sunshineSeconds: first.sunshineSeconds,
      uvIndexMax: maxFinite(dailyEntries.map((entry) => entry.uvIndexMax)),
      visibilityMinM: visibilityMin,
      freezingLevelMinM: freezingMin,
      cloudCoverMaxPct: cloudMax,
      indices: routeIndices.indices,
      worstPointId: routeIndices.worstPointId,
      worstPointRole: routeIndices.worstPointRole,
    } satisfies WeatherDailySummary;
  }).filter((entry): entry is WeatherDailySummary => entry != null);
}

function buildForecastUrl(points: WeatherRoutePoint[], forecastDays: number) {
  const query = new URLSearchParams();
  query.set("latitude", points.map((point) => point.latitude.toFixed(5)).join(","));
  query.set("longitude", points.map((point) => point.longitude.toFixed(5)).join(","));
  const elevations = points.map((point) => point.elevationM);
  if (elevations.every((elevation): elevation is number => elevation != null && Number.isFinite(elevation))) {
    query.set("elevation", elevations.map((elevation) => String(round(elevation))).join(","));
  }
  query.set("hourly", OPEN_METEO_HOURLY_FIELDS.join(","));
  query.set("daily", OPEN_METEO_DAILY_FIELDS.join(","));
  query.set("timezone", "auto");
  query.set("forecast_days", String(clamp(Math.round(forecastDays), 1, 16)));
  return `${OPEN_METEO_FORECAST_URL}?${query.toString()}`;
}

function buildNasaUrl(point: { latitude: number; longitude: number }) {
  const query = new URLSearchParams();
  query.set("parameters", NASA_POWER_FIELDS.join(","));
  query.set("community", "RE");
  query.set("longitude", point.longitude.toFixed(5));
  query.set("latitude", point.latitude.toFixed(5));
  query.set("format", "JSON");
  return `${NASA_POWER_CLIMATOLOGY_URL}?${query.toString()}`;
}

function abortError() {
  return new DOMException("The weather request was cancelled.", "AbortError");
}

async function fetchJson(url: string, signal: AbortSignal | undefined, timeoutMs: number) {
  if (signal?.aborted) throw abortError();
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Weather provider returned ${response.status}.`);
    return await response.json() as unknown;
  } finally {
    globalThis.clearTimeout(timeout);
    signal?.removeEventListener("abort", onAbort);
  }
}

function fallbackData(preview: RoutePreview, points: WeatherRoutePoint[], errors: string[] = []): RouteWeatherData {
  const centre = centrePoint(preview, points);
  return {
    modelVersion: WEATHER_MODEL_VERSION,
    status: "fallback",
    source: "fallback",
    fetchedAt: new Date().toISOString(),
    routePoints: points,
    location: {
      latitude: centre.latitude,
      longitude: centre.longitude,
      elevationM: centre.elevationM,
      timezone: null,
    },
    monthly: fallbackMonthly(preview, points),
    forecasts: [],
    daily: [],
    climateContext: null,
    errors,
    // Synthetic values must never imply that either provider supplied them.
    attribution: [],
  };
}

/** Build deterministic values without making a network request. */
export function buildFallbackWeather(preview: RoutePreview, maxRoutePoints = 6) {
  const points = sampleRouteWeatherPoints(preview, maxRoutePoints);
  return fallbackData(preview, points);
}

/** A stable cache key that ignores irrelevant GPX object identity. */
export function weatherCacheKey(preview: RoutePreview, options: WeatherFetchOptions = {}) {
  const points = sampleRouteWeatherPoints(preview, options.maxRoutePoints ?? 6);
  const forecastDays = clamp(Math.round(options.forecastDays ?? 16), 1, 16);
  return [
    WEATHER_MODEL_VERSION,
    preview.fileName,
    preview.createdAt,
    forecastDays,
    options.includeForecast !== false ? "forecast" : "no-forecast",
    options.includeClimate !== false ? "climate" : "no-climate",
    points.map((point) => `${point.latitude.toFixed(4)},${point.longitude.toFixed(4)},${point.elevationM ?? ""}`).join(";"),
  ].join("|");
}

/** Fetch both products when requested, retaining whichever one is available. */
export async function fetchRouteWeather(
  preview: RoutePreview,
  options: WeatherFetchOptions = {},
): Promise<RouteWeatherData> {
  const points = sampleRouteWeatherPoints(preview, options.maxRoutePoints ?? 6);
  const fallback = fallbackData(preview, points);
  if (!points.length) return fallback;
  const timeoutMs = clamp(Math.round(options.timeoutMs ?? 8000), 1000, 30_000);
  const centre = centrePoint(preview, points);
  const forecastRequested = options.includeForecast !== false;
  const climateRequested = options.includeClimate !== false && centre.latitude != null && centre.longitude != null;
  const requests: Array<Promise<{ kind: "forecast" | "climate"; payload: unknown }>> = [];
  if (forecastRequested) {
    requests.push(fetchJson(buildForecastUrl(points, options.forecastDays ?? 16), options.signal, timeoutMs)
      .then((payload) => ({ kind: "forecast" as const, payload })));
  }
  if (climateRequested) {
    requests.push(fetchJson(buildNasaUrl({ latitude: centre.latitude, longitude: centre.longitude }), options.signal, timeoutMs)
      .then((payload) => ({ kind: "climate" as const, payload })));
  }
  if (!requests.length) return fallback;

  const settled = await Promise.allSettled(requests);
  if (options.signal?.aborted) throw abortError();
  const errors: string[] = [];
  let monthly = fallback.monthly;
  let forecasts: WeatherPointForecast[] = [];
  let climateUsable = false;
  let climateComplete = false;
  let forecastUsable = false;
  let forecastComplete = false;
  let climateContext: RouteWeatherData["climateContext"] = null;

  for (const result of settled) {
    if (result.status === "rejected") {
      if (result.reason?.name !== "AbortError") errors.push("A weather source was unavailable.");
      continue;
    }
    if (result.value.kind === "climate") {
      const parsed = parseNasaMonthly(result.value.payload, preview, points);
      if (parsed) {
        monthly = parsed.monthly;
        climateUsable = parsed.availableMonthCount > 0;
        climateComplete = parsed.complete;
        if (!parsed.complete) {
          errors.push(`The monthly climate response included temperature data for ${parsed.completeMonthCount} of ${MONTH_KEYS.length} months.`);
        }
        if (centre.latitude != null && centre.longitude != null) {
          climateContext = {
            provider: "nasa-power",
            scope: "route-centre",
            latitude: centre.latitude,
            longitude: centre.longitude,
            baselineStart: "2001-01",
            baselineEnd: "2020-12",
          };
        }
      } else {
        errors.push("The monthly climate response was incomplete.");
      }
    } else {
      const parsed = parseOpenMeteo(result.value.payload, points);
      forecasts = parsed.forecasts;
      forecastUsable = parsed.availablePointCount > 0;
      forecastComplete = parsed.complete;
      if (!parsed.complete) {
        errors.push(`The route forecast covered ${parsed.availablePointCount} of ${points.length} sampled points.`);
      }
    }
  }

  const source: WeatherSource = climateUsable && forecastUsable
    ? "mixed"
    : forecastUsable
      ? "open-meteo"
      : climateUsable
        ? "nasa-power"
        : "fallback";
  const allRequestedComplete =
    (!climateRequested || climateComplete) &&
    (!forecastRequested || forecastComplete);
  const status: WeatherDataStatus = allRequestedComplete && (climateUsable || forecastUsable)
    ? "ready"
    : climateUsable || forecastUsable
      ? "partial"
      : "fallback";
  const daily = aggregateDaily(forecasts);
  const timezone = forecasts.find((forecast) => forecast.timezone)?.timezone ?? null;
  const returnedCentre = forecasts[0];

  return {
    ...fallback,
    status,
    source,
    fetchedAt: new Date().toISOString(),
    monthly,
    forecasts,
    daily,
    climateContext,
    errors: [...new Set(errors)],
    attribution: [
      ...(forecastUsable ? [OPEN_METEO_ATTRIBUTION] : []),
      ...(climateUsable ? [NASA_POWER_ATTRIBUTION] : []),
    ],
    location: {
      latitude: returnedCentre?.latitude ?? centre.latitude,
      longitude: returnedCentre?.longitude ?? centre.longitude,
      elevationM: returnedCentre?.elevationM ?? centre.elevationM,
      timezone,
    },
  };
}

/** Return the closest monthly row, keeping callers safe around user input. */
export function monthlyWeather(data: RouteWeatherData, month: number) {
  const normalized = clamp(Math.round(month), 1, 12);
  // Match by the provider's explicit month number. Positional fallback would
  // relabel March as February when a provider omits a month.
  return data.monthly.find((entry) => entry.month === normalized) ?? null;
}

function weatherTimestamp(value: string, utcOffsetSeconds: number | null) {
  const trimmed = value.trim();
  if (!trimmed) return Number.NaN;
  // Open-Meteo returns local wall-clock timestamps when timezone=auto (for
  // example, 2026-08-30T08:00), without an offset. Parse those explicitly so
  // the browser's own timezone cannot move the selected hour.
  const local = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?$/.exec(trimmed);
  if (local && !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed)) {
    const milliseconds = local[7] ? Number(local[7].padEnd(3, "0")) : 0;
    const wallClock = Date.UTC(
      Number(local[1]),
      Number(local[2]) - 1,
      Number(local[3]),
      Number(local[4] ?? 0),
      Number(local[5] ?? 0),
      Number(local[6] ?? 0),
      milliseconds,
    );
    return wallClock - (utcOffsetSeconds ?? 0) * 1000;
  }
  return Date.parse(trimmed);
}

/** Find the nearest hourly sample for a local ISO timestamp. */
export function nearestHourlySample(forecast: WeatherPointForecast, timestamp: string) {
  const target = weatherTimestamp(timestamp, forecast.utcOffsetSeconds);
  if (!Number.isFinite(target) || !forecast.hourly.length) return null;
  const firstValid = forecast.hourly.find((sample) => Number.isFinite(weatherTimestamp(sample.time, forecast.utcOffsetSeconds)));
  if (!firstValid) return null;
  return forecast.hourly.reduce((selected, sample) => {
    const selectedTimestamp = weatherTimestamp(selected.time, forecast.utcOffsetSeconds);
    const sampleTimestamp = weatherTimestamp(sample.time, forecast.utcOffsetSeconds);
    if (!Number.isFinite(sampleTimestamp)) return selected;
    if (!Number.isFinite(selectedTimestamp)) return sample;
    const selectedDistance = Math.abs(selectedTimestamp - target);
    const sampleDistance = Math.abs(sampleTimestamp - target);
    return sampleDistance < selectedDistance ? sample : selected;
  }, firstValid);
}
