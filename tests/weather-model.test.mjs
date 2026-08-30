import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFallbackWeather,
  calculateWeatherIndices,
  fetchRouteWeather,
  nearestHourlySample,
  sampleRouteWeatherPoints,
} from "../app/_lib/weather.ts";

const SURVEY = {
  activity: "day-hike",
  sex: "male",
  ageYears: 30,
  bodyWeightKg: 70,
  heightCm: 175,
  packWeightKg: 5,
  movingHours: 5,
  movingMinutes: 0,
};

function preview() {
  return {
    version: 3,
    fileName: "weather-fixture.gpx",
    createdAt: "2026-08-30T00:00:00.000Z",
    survey: SURVEY,
    source: {
      kind: "uploaded-gpx",
      pointCount: 4,
      trackCount: 2,
      segmentCount: 2,
      waypointCount: 0,
      hasElevation: true,
      hasTime: false,
    },
    stats: {
      totalDistanceKm: 2.1,
      totalAscentM: 550,
      totalDescentM: 400,
      lowestElevationM: 50,
      highestElevationM: 500,
      elevationRangeM: 450,
      requiredPaceMinPerKm: 142.9,
      requiredVerticalSpeedMPerHour: 110,
      boundingBox: { north: 23, south: 22, east: 114.01, west: 113 },
    },
    mapPath: [],
    elevationProfile: [
      { distanceKm: 0, elevationM: 100 },
      { distanceKm: 1, elevationM: 500 },
      { distanceKm: 1.1, elevationM: 50 },
      { distanceKm: 2.1, elevationM: 200 },
    ],
    geographicSegments: [
      [
        { latitude: 22, longitude: 113, elevationM: 100 },
        { latitude: 22, longitude: 113.01, elevationM: 500 },
      ],
      [
        { latitude: 23, longitude: 114, elevationM: 50 },
        { latitude: 23, longitude: 114.01, elevationM: 200 },
      ],
    ],
  };
}

const MONTH_KEYS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

function nasaPayload() {
  const monthValues = (value) => Object.fromEntries(MONTH_KEYS.map((key, index) => [key, value + index]));
  return {
    properties: {
      parameter: {
        T2M: monthValues(10),
        T2M_MAX: monthValues(15),
        T2M_MIN: monthValues(5),
        PRECTOTCORR: monthValues(1),
        RH2M: monthValues(60),
        WS10M: monthValues(2),
        WS10M_MAX: monthValues(4),
        CLOUD_AMT: monthValues(30),
      },
    },
  };
}

function forecastRoot(point, freezingLevelM = 2000) {
  return {
    latitude: point.latitude,
    longitude: point.longitude,
    timezone: "UTC",
    utc_offset_seconds: 0,
    daily: {
      time: ["2026-09-01"],
      temperature_2m_min: [5],
      temperature_2m_mean: [9],
      temperature_2m_max: [13],
      apparent_temperature_min: [4],
      apparent_temperature_max: [12],
      precipitation_sum: [0],
      snowfall_sum: [0],
      weather_code: [0],
      wind_speed_10m_max: [12],
      wind_gusts_10m_max: [20],
    },
    hourly: {
      time: ["2026-09-01T08:00"],
      temperature_2m: [8],
      apparent_temperature: [7],
      freezing_level_height: [freezingLevelM],
      visibility: [20_000],
      cloud_cover: [10],
      wind_speed_10m: [8],
      wind_gusts_10m: [12],
      weather_code: [0],
    },
  };
}

test("weather sampling preserves endpoints and elevation extrema without segment jumps", () => {
  const points = sampleRouteWeatherPoints(preview(), 4);
  assert.deepEqual(new Set(points.map((point) => point.role)), new Set(["start", "finish", "highest", "lowest"]));
  assert.ok(Math.max(...points.map((point) => point.distanceKm ?? 0)) < 3);
});

test("missing weather fields remain neutral instead of becoming maximum risk", () => {
  const empty = calculateWeatherIndices({});
  assert.equal(empty.difficulty, 0);
  assert.equal(empty.cold, 0);
  assert.equal(empty.visibility, 50);

  const severe = calculateWeatherIndices({
    apparentTemperatureC: 38,
    humidityPct: 95,
    precipitationProbabilityPct: 90,
    precipitationMm: 25,
    windGustKmh: 85,
    weatherCode: 95,
    visibilityM: 1000,
    uvIndex: 10,
  });
  assert.ok(severe.difficulty > empty.difficulty);
});

test("fallback weather always exposes a complete finite twelve-month baseline", () => {
  const data = buildFallbackWeather(preview());
  assert.equal(data.status, "fallback");
  assert.equal(data.monthly.length, 12);
  assert.ok(data.monthly.every((month) => Number.isFinite(month.indices.difficulty)));
});

test("forecast requests omit elevation when a sampled GPX point has no elevation", async () => {
  const route = preview();
  route.geographicSegments[0][0].elevationM = null;
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return { ok: true, json: async () => [] };
  };

  try {
    await fetchRouteWeather(route, { includeClimate: false, timeoutMs: 1000 });
  } finally {
    globalThis.fetch = originalFetch;
  }

  const url = new URL(requestedUrl);
  assert.equal(url.searchParams.has("elevation"), false);
  const queryValues = [...url.searchParams.values()]
    .flatMap((value) => value.split(","));
  assert.ok(queryValues.every((value) => value.toLowerCase() !== "nan"));
});

test("NASA fill values do not shift months or become extreme weather", async () => {
  const payload = nasaPayload();
  for (const parameter of Object.values(payload.properties.parameter)) parameter.FEB = -999;
  payload.properties.parameter.T2M.MAR = 33;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => payload });

  let data;
  try {
    data = await fetchRouteWeather(preview(), { includeForecast: false, timeoutMs: 1000 });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(data.status, "partial");
  assert.equal(data.monthly.length, 12);
  assert.equal(data.monthly[1].month, 2);
  assert.equal(data.monthly[1].source, "fallback");
  assert.equal(data.monthly[2].month, 3);
  assert.equal(data.monthly[2].meanTemperatureC, 33);
  assert.equal(data.monthly[2].precipitationDaysPct, null);
  assert.deepEqual(data.attribution, ["Monthly climate context by NASA POWER"]);
  assert.equal(data.climateContext?.scope, "route-centre");
  assert.equal(data.climateContext?.baselineStart, "2001-01");
  assert.match(data.errors[0], /11 of 12 months/);
});

test("a partial multi-point forecast preserves missing route points and status", async () => {
  const route = preview();
  const points = sampleRouteWeatherPoints(route, 4);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => [forecastRoot(points[0])] });

  let data;
  try {
    data = await fetchRouteWeather(route, { includeClimate: false, maxRoutePoints: 4, timeoutMs: 1000 });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(data.status, "partial");
  assert.equal(data.source, "open-meteo");
  assert.equal(data.forecasts.length, points.length);
  assert.equal(data.forecasts.filter((forecast) => forecast.daily.length > 0).length, 1);
  assert.match(data.errors[0], new RegExp(`1 of ${points.length} sampled points`));
});

test("route-wide daily indices retain freezing risk at the high point", async () => {
  const route = preview();
  const points = sampleRouteWeatherPoints(route, 4);
  const roots = points.map((point) => forecastRoot(
    point,
    point.role === "highest" ? Math.max((point.elevationM ?? 0) - 50, 0) : (point.elevationM ?? 0) + 1000,
  ));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => roots });

  let data;
  try {
    data = await fetchRouteWeather(route, { includeClimate: false, maxRoutePoints: 4, timeoutMs: 1000 });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(data.status, "ready");
  assert.equal(data.daily[0].indices.snow, 45);
  assert.equal(data.daily[0].worstPointRole, "highest");
});

test("nearest hourly selection respects the forecast UTC offset", () => {
  const routePoint = sampleRouteWeatherPoints(preview(), 4)[0];
  const sample = (time) => ({ time });
  const forecast = {
    point: routePoint,
    latitude: routePoint.latitude,
    longitude: routePoint.longitude,
    elevationM: routePoint.elevationM,
    timezone: "Asia/Shanghai",
    utcOffsetSeconds: 8 * 60 * 60,
    model: null,
    hourly: [sample("2026-09-01T08:00"), sample("2026-09-01T09:00")],
    daily: [],
  };

  assert.equal(nearestHourlySample(forecast, "2026-09-01T00:20:00Z")?.time, "2026-09-01T08:00");
});
