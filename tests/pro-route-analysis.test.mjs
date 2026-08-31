import assert from "node:assert/strict";
import test from "node:test";

import { calculateProRouteAnalysis } from "../app/_lib/pro-route-analysis.ts";

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

const BASE_PROFILE = [
  { distanceKm: 0, elevationM: 100 },
  { distanceKm: 1, elevationM: 250, gradePercent: 15 },
  { distanceKm: 2, elevationM: 400, gradePercent: 15 },
  { distanceKm: 3, elevationM: 300, gradePercent: -10 },
  { distanceKm: 4, elevationM: 100, gradePercent: -20 },
];

const BASE_SEGMENTS = [
  [
    { longitude: 113, latitude: 22, elevationM: 100 },
    { longitude: 113.01, latitude: 22, elevationM: 250 },
    { longitude: 113.02, latitude: 22, elevationM: 400 },
    { longitude: 113.03, latitude: 22, elevationM: 300 },
    { longitude: 113.04, latitude: 22, elevationM: 100 },
  ],
];

function makePreview({
  fileName = "fixture.gpx",
  survey = {},
  source = {},
  stats = {},
  elevationProfile = BASE_PROFILE,
  geographicSegments = BASE_SEGMENTS,
} = {}) {
  const points = geographicSegments.flat();
  const elevations = points
    .map((point) => point.elevationM)
    .filter((value) => value != null && Number.isFinite(value));
  const highest = elevations.length ? Math.max(...elevations) : null;
  const lowest = elevations.length ? Math.min(...elevations) : null;

  const preview = {
    version: 4,
    fileName,
    createdAt: "2026-08-30T00:00:00.000Z",
    survey: { ...BASE_SURVEY, ...survey },
    source: {
      kind: "uploaded-gpx",
      pointCount: points.length,
      trackCount: 1,
      segmentCount: geographicSegments.length,
      waypointCount: 2,
      hasElevation: elevations.length > 0,
      hasTime: true,
      ...source,
    },
    stats: {
      totalDistanceKm: 4,
      totalAscentM: highest == null ? null : 300,
      totalDescentM: lowest == null ? null : 300,
      lowestElevationM: lowest,
      highestElevationM: highest,
      elevationRangeM: lowest == null || highest == null ? null : highest - lowest,
      requiredPaceMinPerKm: 60,
      requiredVerticalSpeedMPerHour: 75,
      boundingBox: {
        north: 22.01,
        south: 22,
        east: 113.04,
        west: 113,
      },
      ...stats,
    },
    mapPath: [],
    elevationProfile,
    geographicSegments,
  };

  // A null option represents a legacy preview with no stored profile field.
  if (elevationProfile === null) delete preview.elevationProfile;
  return preview;
}

test("pro route analysis is deterministic and reports elevation extrema", () => {
  const preview = makePreview();
  const first = calculateProRouteAnalysis(preview);
  const second = calculateProRouteAnalysis(preview);

  assert.deepEqual(first, second);
  assert.equal(first.pathKind, "track");
  assert.equal(first.pointCount, 5);
  assert.equal(first.sampledCoordinateCount, 5);
  assert.equal(first.distanceKm, 4);
  assert.equal(first.highestM, 400);
  assert.equal(first.lowestM, 100);
  assert.equal(first.highestAtKm, 2);
  assert.equal(first.lowestAtKm, 0);
  assert.equal(first.meanElevationM, 230);
  assert.equal(first.medianElevationM, 250);
  assert.equal(first.elevationRangeM, 300);
  assert.equal(first.elevationCoveragePct, 100);
  assert.equal(first.netElevationM, 0);
});

test("pro route analysis preserves separated GPX segments and their summaries", () => {
  const segments = [
    [
      { longitude: 113, latitude: 22, elevationM: 100 },
      { longitude: 113.01, latitude: 22, elevationM: 180 },
      { longitude: 113.02, latitude: 22, elevationM: 140 },
    ],
    [
      { longitude: 113.1, latitude: 22.1, elevationM: 220 },
      { longitude: 113.11, latitude: 22.1, elevationM: 300 },
    ],
  ];
  const analysis = calculateProRouteAnalysis(makePreview({
    geographicSegments: segments,
    elevationProfile: [
      { distanceKm: 0, elevationM: 100 },
      { distanceKm: 1, elevationM: 180 },
      { distanceKm: 2, elevationM: 140 },
      { distanceKm: 3, elevationM: 220 },
      { distanceKm: 4, elevationM: 300 },
    ],
    source: {
      pointCount: 5,
      segmentCount: 2,
    },
    stats: {
      totalDistanceKm: 4,
      totalAscentM: 160,
      totalDescentM: 40,
      lowestElevationM: 100,
      highestElevationM: 300,
      elevationRangeM: 200,
      boundingBox: {
        north: 22.1,
        south: 22,
        east: 113.11,
        west: 113,
      },
    },
  }));

  assert.equal(analysis.segmentCount, 2);
  assert.equal(analysis.segments.length, 2);
  assert.deepEqual(analysis.segments.map((segment) => segment.index), [1, 2]);
  assert.deepEqual(analysis.segments.map((segment) => segment.pointCount), [3, 2]);
  assert.ok(analysis.segments.every((segment) => segment.distanceKm > 0));
  assert.equal(analysis.segments[0].lowestM, 100);
  assert.equal(analysis.segments[0].highestM, 180);
  assert.equal(analysis.segments[0].ascentM, 80);
  assert.equal(analysis.segments[0].descentM, 40);
  assert.deepEqual(analysis.start, segments[0][0]);
  assert.deepEqual(analysis.finish, segments[1][1]);
});

test("grade distribution classifies level, climb and descent distance", () => {
  const profile = [
    { distanceKm: 0, elevationM: 100 },
    { distanceKm: 1, elevationM: 100, gradePercent: 0 },
    { distanceKm: 2, elevationM: 140, gradePercent: 4 },
    { distanceKm: 3, elevationM: 250, gradePercent: 11 },
    { distanceKm: 4, elevationM: 200, gradePercent: -4 },
    { distanceKm: 5, elevationM: 90, gradePercent: -11 },
  ];
  const analysis = calculateProRouteAnalysis(makePreview({
    elevationProfile: profile,
    stats: {
      totalDistanceKm: 5,
      totalAscentM: 150,
      totalDescentM: 160,
      lowestElevationM: 90,
      highestElevationM: 250,
      elevationRangeM: 160,
    },
  }));

  assert.deepEqual(analysis.gradeDistribution, {
    steepDescent: 20,
    descent: 20,
    level: 20,
    climb: 20,
    steepClimb: 20,
  });
  assert.equal(analysis.steepestAscentPct, 11);
  assert.equal(analysis.steepestDescentPct, -11);
  assert.equal(analysis.p90AscentPct, 11);
  assert.equal(analysis.p90DescentPct, -11);
  assert.equal(analysis.longestClimbGainM, 150);
  assert.equal(analysis.longestClimbDistanceKm, 2);
});

test("loop check distinguishes coincident endpoints from point-to-point routes", () => {
  const loopSegments = [[
    { longitude: 113, latitude: 22, elevationM: 100 },
    { longitude: 113.02, latitude: 22, elevationM: 200 },
    { longitude: 113, latitude: 22, elevationM: 100 },
  ]];
  const loop = calculateProRouteAnalysis(makePreview({
    geographicSegments: loopSegments,
    source: { pointCount: 3 },
    stats: {
      totalDistanceKm: 4,
      boundingBox: { north: 22, south: 22, east: 113.02, west: 113 },
    },
  }));
  const open = calculateProRouteAnalysis(makePreview());

  assert.equal(loop.endpointGapKm, 0);
  assert.equal(loop.isLoop, true);
  assert.ok(open.endpointGapKm > 0);
  assert.equal(open.isLoop, false);
});

test("missing elevation remains explicit and does not invent grade values", () => {
  const segments = [[
    { longitude: 113, latitude: 22, elevationM: null },
    { longitude: 113.01, latitude: 22, elevationM: null },
  ]];
  const analysis = calculateProRouteAnalysis(makePreview({
    geographicSegments: segments,
    elevationProfile: null,
    source: {
      pointCount: 2,
      trackCount: 0,
      segmentCount: 1,
      waypointCount: 0,
      hasElevation: false,
      hasTime: false,
    },
    stats: {
      totalDistanceKm: 1,
      totalAscentM: null,
      totalDescentM: null,
      lowestElevationM: null,
      highestElevationM: null,
      elevationRangeM: null,
      requiredPaceMinPerKm: null,
      requiredVerticalSpeedMPerHour: null,
      boundingBox: null,
    },
  }));

  assert.equal(analysis.pathKind, "route");
  assert.equal(analysis.hasElevation, false);
  assert.equal(analysis.hasTime, false);
  assert.equal(analysis.lowestM, null);
  assert.equal(analysis.highestM, null);
  assert.equal(analysis.meanElevationM, null);
  assert.equal(analysis.elevationCoveragePct, 0);
  assert.equal(analysis.steepestAscentPct, null);
  assert.equal(analysis.steepestDescentPct, null);
  assert.equal(analysis.longestClimbGainM, 0);
  assert.deepEqual(analysis.gradeDistribution, {
    steepDescent: 0,
    descent: 0,
    level: 0,
    climb: 0,
    steepClimb: 0,
  });
  assert.equal(analysis.segments[0].ascentM, null);
  assert.equal(analysis.segments[0].descentM, null);
});
