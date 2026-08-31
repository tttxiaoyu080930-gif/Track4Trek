import assert from "node:assert/strict";
import test from "node:test";

import { calculateRouteDemand } from "../app/_lib/route-demand.ts";
import {
  maximumMovingMinutesForPlan,
  minimumMovingMinutesForPlan,
  readRoutePreview,
  ROUTE_PREVIEW_STORAGE_KEY,
} from "../app/_lib/route-data.ts";

const BASE_SURVEY = {
  activity: "day-hike",
  tripMode: "single-day",
  plannedDays: 1,
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
    version: 4,
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

test("explicit single-day plans preserve the legacy calculator result", () => {
  const explicit = routePreview();
  const legacyShape = routePreview();
  delete legacyShape.survey.tripMode;
  delete legacyShape.survey.plannedDays;

  assert.deepEqual(calculateRouteDemand(explicit), calculateRouteDemand(legacyShape));
});

test("multi-day routes use separate balanced stages instead of one continuous effort", () => {
  const route = {
    survey: { movingHours: 48 },
    profile: [
      [0, 600],
      [20, 1800],
      [40, 900],
      [60, 2500],
      [80, 1300],
      [100, 2900],
    ],
  };
  const continuous = calculateRouteDemand(routePreview({
    ...route,
    survey: { ...route.survey, tripMode: "single-day", plannedDays: 1 },
  }));
  const expedition = calculateRouteDemand(routePreview({
    ...route,
    survey: { ...route.survey, tripMode: "multi-day", plannedDays: 5 },
  }));

  assert.equal(expedition.endurancePlan.method, "balanced-modeled-effort");
  assert.equal(expedition.endurancePlan.stages.length, 5);
  assert.ok(
    expedition.features.enduranceSeverity < continuous.features.enduranceSeverity,
    "a five-day plan should not be modeled as a continuous 48-hour effort",
  );
  assert.ok(expedition.features.enduranceSeverity > 0);
});

test("multi-day stage totals are conserved and overnight carry stays bounded", () => {
  const analysis = calculateRouteDemand(routePreview({
    survey: { tripMode: "multi-day", plannedDays: 7, movingHours: 56 },
    profile: [
      [0, 400],
      [15, 1400],
      [30, 750],
      [50, 2200],
      [70, 900],
      [90, 2600],
    ],
  }));
  const stages = analysis.endurancePlan.stages;
  const sum = (key) => stages.reduce((total, stage) => total + stage[key], 0);
  const maxRaw = Math.max(...stages.map((stage) => stage.rawSeverity));
  const maxAdjusted = Math.max(...stages.map((stage) => stage.adjustedSeverity));

  assert.equal(stages.length, 7);
  assert.ok(Math.abs(sum("distanceKm") - analysis.features.distanceKm) <= 0.08);
  assert.ok(Math.abs(sum("movingMinutes") - analysis.features.movingMinutes) <= 0.8);
  assert.ok(Math.abs(sum("ascentM") - analysis.features.ascentM) <= 7);
  assert.ok(
    Math.abs(sum("activeCalories") - analysis.features.activeCaloriesCenter) <= 70,
  );
  assert.ok(maxAdjusted >= maxRaw);
  assert.ok(maxAdjusted <= 1);
  assert.ok(stages.every((stage) => stage.carry >= 0 && stage.carry <= 0.35));
  assert.ok(stages.every((stage) => {
    const distanceShare = stage.distanceKm / analysis.features.distanceKm;
    const timeShare = stage.movingMinutes / analysis.features.movingMinutes;
    return Math.abs(distanceShare - timeShare) <= 0.001;
  }), "daily time must preserve the whole-route target pace");
  assert.equal(
    analysis.endurancePlan.limitingDay,
    stages.find((stage) => stage.adjustedSeverity === maxAdjusted)?.day,
  );
});

test("moving-time limits follow the selected single-day or multi-day plan", () => {
  assert.equal(minimumMovingMinutesForPlan("single-day", 1), 15);
  assert.equal(maximumMovingMinutesForPlan("single-day", 1), 48 * 60);
  assert.equal(minimumMovingMinutesForPlan("multi-day", 5), 75);
  assert.equal(maximumMovingMinutesForPlan("multi-day", 5), 5 * 24 * 60);
  assert.equal(minimumMovingMinutesForPlan("multi-day", 30), 450);
  assert.equal(maximumMovingMinutesForPlan("multi-day", 30), 480 * 60);
});

test("stored route previews reject moving times outside the selected plan", () => {
  const originalWindow = globalThis.window;
  let raw = "";
  globalThis.window = {
    localStorage: {
      getItem: () => raw,
      setItem: (_key, value) => { raw = value; },
    },
  };

  try {
    const invalidPlans = [
      routePreview({ survey: { movingHours: 49 } }),
      routePreview({
        survey: {
          tripMode: "multi-day",
          plannedDays: 30,
          movingHours: 7,
          movingMinutes: 0,
        },
      }),
      routePreview({
        survey: {
          tripMode: "multi-day",
          plannedDays: 2,
          movingHours: 49,
        },
      }),
    ];

    for (const preview of invalidPlans) {
      raw = JSON.stringify(preview);
      assert.equal(readRoutePreview(), null);
    }
  } finally {
    globalThis.window = originalWindow;
  }
});

test("multi-day stages do not invent Garmin reference numbers for unsupported ages", () => {
  const analysis = calculateRouteDemand(routePreview({
    survey: {
      ageYears: 16,
      tripMode: "multi-day",
      plannedDays: 3,
      movingHours: 18,
    },
  }));

  assert.equal(analysis.metrics.endurance.status, "unavailable");
  assert.ok(analysis.endurancePlan.stages.every(
    (stage) => stage.referenceLow == null && stage.referenceHigh == null,
  ));
});

test("legacy v3 previews migrate to an explicit single-day plan", () => {
  const legacy = routePreview();
  legacy.version = 3;
  delete legacy.survey.tripMode;
  delete legacy.survey.plannedDays;
  const storage = new Map([[ROUTE_PREVIEW_STORAGE_KEY, JSON.stringify(legacy)]]);
  const originalWindow = globalThis.window;
  globalThis.window = {
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
  };

  try {
    const migrated = readRoutePreview();
    assert.equal(migrated?.version, 4);
    assert.equal(migrated?.survey.tripMode, "single-day");
    assert.equal(migrated?.survey.plannedDays, 1);
  } finally {
    globalThis.window = originalWindow;
  }
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
