import assert from "node:assert/strict";
import test from "node:test";

import { calculateRouteDemand } from "../app/_lib/route-demand.ts";

const BASE_SURVEY = {
  activity: "day-hike",
  sex: "male",
  ageYears: 30,
  bodyWeightKg: 70,
  heightCm: 175,
  packWeightKg: 5,
  movingHours: 4,
  movingMinutes: 0,
};

function routePreview({
  survey = {},
  profile = [
    [0, 300],
    [8, 700],
    [16, 300],
  ],
  distanceKm,
} = {}) {
  const resolvedSurvey = { ...BASE_SURVEY, ...survey };
  const points = profile?.map(([pointDistanceKm, elevationM]) => ({
    distanceKm: pointDistanceKm,
    elevationM,
  })) ?? [];
  const resolvedDistanceKm = distanceKm ?? points.at(-1)?.distanceKm ?? 16;
  let ascentM = 0;
  let descentM = 0;

  for (let index = 1; index < points.length; index += 1) {
    const change = points[index].elevationM - points[index - 1].elevationM;
    if (change > 0) ascentM += change;
    else descentM += Math.abs(change);
  }

  const elevations = points.map((point) => point.elevationM);
  const movingMinutes = resolvedSurvey.movingHours * 60 + resolvedSurvey.movingMinutes;

  return {
    version: 3,
    fileName: "fixture.gpx",
    createdAt: "2026-08-30T00:00:00.000Z",
    survey: resolvedSurvey,
    source: {
      kind: "uploaded-gpx",
      pointCount: Math.max(points.length, 2),
      trackCount: 1,
      segmentCount: 1,
      waypointCount: 0,
      hasElevation: points.length >= 2,
      hasTime: false,
    },
    stats: {
      totalDistanceKm: resolvedDistanceKm,
      totalAscentM: points.length >= 2 ? ascentM : null,
      totalDescentM: points.length >= 2 ? descentM : null,
      lowestElevationM: elevations.length ? Math.min(...elevations) : null,
      highestElevationM: elevations.length ? Math.max(...elevations) : null,
      elevationRangeM: elevations.length
        ? Math.max(...elevations) - Math.min(...elevations)
        : null,
      requiredPaceMinPerKm: resolvedDistanceKm > 0
        ? movingMinutes / resolvedDistanceKm
        : null,
      requiredVerticalSpeedMPerHour: points.length >= 2 && movingMinutes > 0
        ? ascentM / (movingMinutes / 60)
        : null,
      boundingBox: null,
    },
    mapPath: [
      { x: -1, y: 0, elevation: elevations[0] ?? null },
      { x: 1, y: 0, elevation: elevations.at(-1) ?? null },
    ],
    elevationProfile: points.length ? points : undefined,
    geographicSegments: [],
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function assertFiniteEstimate(metric) {
  if (metric.status === "unavailable") {
    assert.equal(metric.dial, null);
    return;
  }

  for (const key of ["center", "low", "high"]) {
    assert.ok(Number.isFinite(metric[key]), `${key} should be finite`);
  }
  assert.ok(metric.low <= metric.center);
  assert.ok(metric.center <= metric.high);
  assert.ok(metric.dial.startPct >= 0 && metric.dial.startPct <= 100);
  assert.ok(metric.dial.endPct >= 0 && metric.dial.endPct <= 100);
  assert.ok(metric.dial.startPct <= metric.dial.endPct);
}

test("route-demand calculation is deterministic, pure, finite and ordered", () => {
  const preview = deepFreeze(routePreview());
  const first = calculateRouteDemand(preview);
  const second = calculateRouteDemand(preview);

  assert.deepEqual(first, second);
  assert.equal(first.status, "estimated");
  Object.values(first.metrics).forEach(assertFiniteEstimate);
});

test("more backpack mass raises oxygen demand and active calories", () => {
  const unloaded = calculateRouteDemand(routePreview({ survey: { packWeightKg: 0 } }));
  const loaded = calculateRouteDemand(routePreview({ survey: { packWeightKg: 15 } }));

  assert.ok(loaded.features.grossOxygenMlKgMin > unloaded.features.grossOxygenMlKgMin);
  assert.ok(loaded.metrics.activeCalories.center > unloaded.metrics.activeCalories.center);
  assert.ok(loaded.metrics.vo2Max.center > unloaded.metrics.vo2Max.center);
});

test("shorter target time raises trail-running intensity and threshold pace demand", () => {
  const slower = calculateRouteDemand(routePreview({
    survey: { activity: "trail-run", movingHours: 3 },
  }));
  const faster = calculateRouteDemand(routePreview({
    survey: { activity: "trail-run", movingHours: 2 },
  }));

  assert.ok(faster.metrics.vo2Max.center > slower.metrics.vo2Max.center);
  assert.equal(faster.metrics.lactateThreshold.status, "estimated");
  assert.equal(slower.metrics.lactateThreshold.status, "estimated");
  assert.ok(
    faster.metrics.lactateThreshold.center < slower.metrics.lactateThreshold.center,
    "faster threshold pace is represented by fewer min/km",
  );
});

test("more ascent raises hill severity at fixed distance and time", () => {
  const gentle = calculateRouteDemand(routePreview());
  const repeatedClimbs = calculateRouteDemand(routePreview({
    profile: [
      [0, 300],
      [4, 700],
      [8, 300],
      [12, 700],
      [16, 300],
    ],
  }));

  assert.ok(repeatedClimbs.features.ascentM > gentle.features.ascentM);
  assert.ok(repeatedClimbs.features.hillSeverity > gentle.features.hillSeverity);
  assert.ok(repeatedClimbs.metrics.hill.center >= gentle.metrics.hill.center);
});

test("longer duration raises the endurance-duration requirement", () => {
  const short = calculateRouteDemand(routePreview({
    survey: { movingHours: 2 },
  }));
  const long = calculateRouteDemand(routePreview({
    survey: { movingHours: 12 },
  }));

  assert.ok(long.features.enduranceSeverity > short.features.enduranceSeverity);
});

test("age and sex select reference tables without changing active calories", () => {
  const male = calculateRouteDemand(routePreview({
    survey: { activity: "trail-run", sex: "male", ageYears: 25 },
  }));
  const female = calculateRouteDemand(routePreview({
    survey: { activity: "trail-run", sex: "female", ageYears: 55 },
  }));

  assert.equal(male.metrics.activeCalories.center, female.metrics.activeCalories.center);
  assert.equal(male.features.grossOxygenMlKgMin, female.features.grossOxygenMlKgMin);
  assert.notEqual(male.metrics.endurance.ageBand, female.metrics.endurance.ageBand);
});

test("higher altitude raises required VO2 without changing active calories", () => {
  const low = calculateRouteDemand(routePreview());
  const high = calculateRouteDemand(routePreview({
    profile: [
      [0, 2500],
      [8, 2900],
      [16, 2500],
    ],
  }));

  assert.ok(high.metrics.vo2Max.center > low.metrics.vo2Max.center);
  assert.equal(high.metrics.activeCalories.center, low.metrics.activeCalories.center);
});

test("missing elevation is explicit and never reuses illustrative terrain", () => {
  const analysis = calculateRouteDemand(routePreview({ profile: null, distanceKm: 16 }));

  assert.equal(analysis.status, "estimated");
  assert.equal(analysis.confidence, "low");
  assert.ok(analysis.warnings.includes("missing-elevation"));
  assert.equal(analysis.metrics.hill.status, "unavailable");
  assert.equal(analysis.features.highestElevationM, 0);
  assertFiniteEstimate(analysis.metrics.vo2Max);
  assertFiniteEstimate(analysis.metrics.activeCalories);
  assertFiniteEstimate(analysis.metrics.recovery);
});

test("lactate-threshold pace is only returned for a sufficiently long trail run", () => {
  const hike = calculateRouteDemand(routePreview());
  const shortRun = calculateRouteDemand(routePreview({
    survey: { activity: "trail-run", movingHours: 0, movingMinutes: 15 },
  }));
  const run = calculateRouteDemand(routePreview({
    survey: { activity: "trail-run", movingHours: 1 },
  }));

  assert.equal(hike.metrics.lactateThreshold.status, "unavailable");
  assert.equal(shortRun.metrics.lactateThreshold.status, "unavailable");
  assert.notEqual(run.metrics.lactateThreshold.status, "unavailable");
});

test("extreme and insufficient routes stay bounded and avoid NaN", () => {
  const extreme = calculateRouteDemand(routePreview({
    survey: {
      activity: "trail-run",
      bodyWeightKg: 60,
      packWeightKg: 60,
      movingHours: 4,
    },
    profile: [
      [0, 1000],
      [50, 9000],
      [100, 1000],
      [150, 9000],
      [200, 1000],
    ],
  }));
  Object.values(extreme.metrics).forEach(assertFiniteEstimate);
  assert.ok(extreme.metrics.recovery.high <= 96);
  if (extreme.metrics.hill.status !== "unavailable") {
    assert.ok(extreme.metrics.hill.low >= 1);
    assert.ok(extreme.metrics.hill.high <= 100);
  }

  const insufficient = calculateRouteDemand(routePreview({ distanceKm: 0, profile: [] }));
  assert.equal(insufficient.status, "insufficient-route");
  Object.values(insufficient.metrics).forEach(assertFiniteEstimate);
});
