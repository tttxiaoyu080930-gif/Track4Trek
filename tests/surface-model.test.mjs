import assert from "node:assert/strict";
import test from "node:test";
import { calculateComprehensiveRouteDifficulty } from "../app/_lib/route-difficulty.ts";
import {
  aggregateSurfaceMatches,
  calculateMonthlySurfaceCondition,
  classifyOsmSurface,
  sampleRouteSurfacePoints,
} from "../app/_lib/surface.ts";

function preview() {
  return {
    version: 4,
    fileName: "surface-test.gpx",
    createdAt: "2026-08-31T00:00:00.000Z",
    survey: {
      activity: "day-hike",
      tripMode: "single-day",
      plannedDays: 1,
      sex: "female",
      ageYears: 18,
      bodyWeightKg: 58,
      heightCm: 166,
      packWeightKg: 6,
      movingHours: 6,
      movingMinutes: 0,
    },
    source: {
      kind: "uploaded-gpx",
      pointCount: 4,
      trackCount: 1,
      segmentCount: 1,
      waypointCount: 0,
      hasElevation: true,
      hasTime: false,
    },
    stats: {
      totalDistanceKm: 12,
      totalAscentM: 600,
      totalDescentM: 600,
      lowestElevationM: 1000,
      highestElevationM: 1600,
      elevationRangeM: 600,
      requiredPaceMinPerKm: 30,
      requiredVerticalSpeedMPerHour: 100,
      boundingBox: { north: 39.1, south: 39, east: 113.1, west: 113 },
    },
    mapPath: [],
    elevationProfile: [
      { distanceKm: 0, elevationM: 1000 },
      { distanceKm: 6, elevationM: 1600 },
      { distanceKm: 12, elevationM: 1000 },
    ],
    geographicSegments: [[
      { latitude: 39, longitude: 113, elevationM: 1000 },
      { latitude: 39.04, longitude: 113.04, elevationM: 1300 },
      { latitude: 39.08, longitude: 113.08, elevationM: 1600 },
      { latitude: 39.1, longitude: 113.1, elevationM: 1000 },
    ]],
  };
}

function climate({ precipitation = 20, snow = 0, cold = 5, heat = 20 } = {}) {
  return {
    month: 6,
    meanTemperatureC: 15,
    minimumTemperatureC: 8,
    maximumTemperatureC: 22,
    apparentTemperatureC: 15,
    precipitationMmPerDay: 2,
    precipitationDaysPct: 30,
    snowfallCm: 0,
    snowDaysPct: 0,
    humidityPct: 70,
    cloudCoverPct: 50,
    windSpeedKmh: 12,
    windGustKmh: 24,
    indices: {
      difficulty: 35,
      heat,
      snow,
      storm: 20,
      precipitation,
      visibility: 80,
      wind: 20,
      uv: 40,
      cold,
    },
    source: "nasa-power",
  };
}

test("OSM surface and track tags map into explicit base categories", () => {
  assert.equal(classifyOsmSurface({ surface: "asphalt" }), "paved");
  assert.equal(classifyOsmSurface({ surface: "gravel" }), "gravel");
  assert.equal(classifyOsmSurface({ surface: "sand" }), "sand");
  assert.equal(classifyOsmSurface({ surface: "rock" }), "rock");
  assert.equal(classifyOsmSurface({ highway: "path" }), "trail");
  assert.equal(classifyOsmSurface({ highway: "track", tracktype: "grade5" }), "trail");
  assert.equal(classifyOsmSurface({ highway: "service" }), "unknown");
});

test("surface samples are bounded and spread across route distance", () => {
  const points = sampleRouteSurfacePoints(preview(), 20);
  assert.ok(points.length >= 8 && points.length <= 20);
  assert.ok(points[0].latitude < points.at(-1).latitude);
  assert.ok(points.every((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude)));
});

test("nearby OSM way geometry produces percentages and preserves unmapped corridor", () => {
  const points = [
    { id: "a", latitude: 39, longitude: 113 },
    { id: "b", latitude: 39.001, longitude: 113.001 },
  ];
  const data = aggregateSurfaceMatches(points, [{
    id: 1,
    tags: { highway: "path", surface: "gravel" },
    geometry: [
      { lat: 38.9999, lon: 112.9999 },
      { lat: 39.0001, lon: 113.0001 },
    ],
  }], 40);
  assert.equal(data.status, "partial");
  assert.equal(data.mappedCoveragePct, 50);
  assert.equal(data.base.gravel, 50);
  assert.equal(data.base.offTrail, 50);
  assert.equal(Object.values(data.base).reduce((sum, value) => sum + value, 0), 100);
});

test("wet months increase mud while cold snowy months increase snow and surface demand", () => {
  const surface = {
    modelVersion: "surface-v0.1",
    status: "ready",
    source: "openstreetmap",
    sampleCount: 20,
    matchedPointCount: 20,
    mappedCoveragePct: 100,
    explicitSurfaceTagPct: 80,
    base: { paved: 0, trail: 70, gravel: 20, rock: 10, sand: 0, offTrail: 0, unknown: 0 },
    errors: [],
    attribution: ["© OpenStreetMap contributors"],
  };
  const dry = calculateMonthlySurfaceCondition(surface, climate({ precipitation: 5 }));
  const wet = calculateMonthlySurfaceCondition(surface, climate({ precipitation: 95 }));
  const snow = calculateMonthlySurfaceCondition(surface, climate({ precipitation: 60, snow: 95, cold: 90 }));

  assert.ok(wet.shares.mud > dry.shares.mud);
  assert.ok(snow.shares.snowIce > wet.shares.snowIce);
  assert.ok(wet.difficultyScore >= dry.difficultyScore);
  assert.ok(snow.difficultyScore > dry.difficultyScore);
  assert.equal(Math.round(Object.values(snow.shares).reduce((sum, value) => sum + value, 0)), 100);
});

test("surface demand adds a bounded amount to comprehensive route difficulty", () => {
  const analysis = {
    status: "estimated",
    features: {
      hillSeverity: 0.45,
      enduranceSeverity: 0.5,
      altitudeSeverity: 0.2,
      packRatio: 0.1,
      meanElevationM: 1800,
      highestElevationM: 2500,
      acuteAltitudeAvailability: 0.95,
      altitudePerformanceLossPct: 5,
      distanceAbove2500Pct: 10,
      distanceAbove3000Pct: 0,
      distanceAbove4000Pct: 0,
    },
    metrics: { vo2Max: { center: 40 } },
  };
  const weather = climate().indices;
  const firm = calculateMonthlySurfaceCondition({
    modelVersion: "surface-v0.1",
    status: "ready",
    source: "openstreetmap",
    sampleCount: 10,
    matchedPointCount: 10,
    mappedCoveragePct: 100,
    explicitSurfaceTagPct: 100,
    base: { paved: 100, trail: 0, gravel: 0, rock: 0, sand: 0, offTrail: 0, unknown: 0 },
    errors: [],
    attribution: [],
  }, climate());
  const rough = calculateMonthlySurfaceCondition({
    modelVersion: "surface-v0.1",
    status: "ready",
    source: "openstreetmap",
    sampleCount: 10,
    matchedPointCount: 10,
    mappedCoveragePct: 100,
    explicitSurfaceTagPct: 100,
    base: { paved: 0, trail: 0, gravel: 0, rock: 0, sand: 100, offTrail: 0, unknown: 0 },
    errors: [],
    attribution: [],
  }, climate());
  const firmScore = calculateComprehensiveRouteDifficulty(analysis, weather, firm);
  const roughScore = calculateComprehensiveRouteDifficulty(analysis, weather, rough);

  assert.ok(roughScore.score > firmScore.score);
  assert.ok(roughScore.surfaceAdjustment > firmScore.surfaceAdjustment);
  assert.ok(roughScore.surfaceAdjustment <= 16);
  assert.ok(roughScore.score <= 100);
});
