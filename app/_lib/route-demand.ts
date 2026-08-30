import type { ProfileSex, RoutePreview, TripActivity } from "./route-data";

export const ROUTE_DEMAND_MODEL_VERSION = "route-demand-v0.1" as const;

export type EstimateStatus = "estimated" | "outside-model" | "unavailable";
export type EstimateConfidence = "medium" | "low";
export type DemandReasonCode =
  | "insufficient-route"
  | "missing-elevation"
  | "partial-elevation"
  | "grade-clamped"
  | "walking-speed-outside-study"
  | "pack-ratio-outside-study"
  | "altitude-outside-study"
  | "unsupported-age-reference"
  | "running-threshold-not-applicable"
  | "threshold-duration-too-short"
  | "no-heart-rate"
  | "no-training-history"
  | "heuristic-unvalidated";

export type DialProjection = {
  domainMin: number;
  domainMax: number;
  startPct: number;
  endPct: number;
  clippedLow: boolean;
  clippedHigh: boolean;
};

type NumericEstimate = {
  status: Exclude<EstimateStatus, "unavailable">;
  center: number;
  low: number;
  high: number;
  confidence: EstimateConfidence;
  reasons: DemandReasonCode[];
  dial: DialProjection;
};

type UnavailableEstimate = {
  status: "unavailable";
  confidence: "low";
  reasons: DemandReasonCode[];
  dial: null;
};

export type HillCategory =
  | "recreational"
  | "challenger"
  | "trained"
  | "skilled"
  | "expert"
  | "elite";

export type EnduranceCategory =
  | "recreational"
  | "intermediate"
  | "trained"
  | "well-trained"
  | "expert"
  | "superior"
  | "elite";

export type Vo2Category =
  | "poor"
  | "fair"
  | "good"
  | "excellent"
  | "superior"
  | "reference-unavailable";

export type RouteDemandAnalysis = {
  modelVersion: typeof ROUTE_DEMAND_MODEL_VERSION;
  status: "estimated" | "insufficient-route";
  activity: TripActivity;
  fileName: string;
  profile: {
    sex: ProfileSex;
    ageYears: number;
  };
  confidence: EstimateConfidence;
  warnings: DemandReasonCode[];
  features: {
    distanceKm: number;
    movingMinutes: number;
    averageSpeedMps: number;
    ascentM: number;
    ascentPerKm: number;
    verticalSpeedMPerHour: number;
    longestClimbM: number;
    p90PositiveGrade: number;
    uphillDistanceShare: number;
    meanElevationM: number;
    highestElevationM: number;
    elevationCoverage: number;
    grossOxygenMlKgMin: number;
    activeCaloriesCenter: number;
    hillSeverity: number;
    enduranceSeverity: number;
  };
  metrics: {
    hill: (NumericEstimate & { category: HillCategory }) | UnavailableEstimate;
    endurance:
      | (NumericEstimate & {
          category: EnduranceCategory;
          ageBand: string;
          rangeKind: "less-than" | "between" | "at-least";
          referenceLow: number | null;
          referenceHigh: number | null;
        })
      | (UnavailableEstimate & { category: EnduranceCategory; ageBand: null });
    vo2Max: NumericEstimate & { category: Vo2Category; ageBand: string | null };
    lactateThreshold:
      | (NumericEstimate & { unit: "min-km" })
      | (UnavailableEstimate & { unit: "min-km" });
    activeCalories: NumericEstimate & { unit: "kcal" };
    recovery: NumericEstimate & { unit: "hours" };
  };
};

type AnalysisSegment = {
  distanceM: number;
  gradePercent: number;
  riseM: number;
  meanElevationM: number;
};

type EnduranceReferenceRow = {
  minAge: number;
  maxAge: number;
  label: string;
  starts: readonly [number, number, number, number, number, number, number];
};

const HILL_BANDS: ReadonlyArray<{
  category: HillCategory;
  low: number;
  high: number;
}> = [
  { category: "recreational", low: 1, high: 24 },
  { category: "challenger", low: 25, high: 49 },
  { category: "trained", low: 50, high: 69 },
  { category: "skilled", low: 70, high: 84 },
  { category: "expert", low: 85, high: 94 },
  { category: "elite", low: 95, high: 100 },
];

const ENDURANCE_CATEGORIES: readonly EnduranceCategory[] = [
  "recreational",
  "intermediate",
  "trained",
  "well-trained",
  "expert",
  "superior",
  "elite",
];

const ENDURANCE_REFERENCE: Record<ProfileSex, readonly EnduranceReferenceRow[]> = {
  male: [
    { minAge: 18, maxAge: 20, label: "18–20", starts: [0, 5000, 5700, 6300, 7000, 7600, 8300] },
    { minAge: 21, maxAge: 39, label: "21–39", starts: [0, 5100, 5800, 6600, 7300, 8100, 8800] },
    { minAge: 40, maxAge: 44, label: "40–44", starts: [0, 5100, 5800, 6500, 7200, 7900, 8600] },
    { minAge: 45, maxAge: 49, label: "45–49", starts: [0, 5000, 5700, 6400, 7000, 7700, 8400] },
    { minAge: 50, maxAge: 54, label: "50–54", starts: [0, 4900, 5500, 6100, 6800, 7400, 8000] },
    { minAge: 55, maxAge: 59, label: "55–59", starts: [0, 4600, 5100, 5700, 6200, 6800, 7300] },
    { minAge: 60, maxAge: 64, label: "60–64", starts: [0, 4300, 4800, 5300, 5700, 6200, 6700] },
    { minAge: 65, maxAge: 69, label: "65–69", starts: [0, 4100, 4500, 4900, 5400, 5800, 6200] },
    { minAge: 70, maxAge: 74, label: "70–74", starts: [0, 3800, 4200, 4600, 4900, 5300, 5700] },
    { minAge: 75, maxAge: 79, label: "75–79", starts: [0, 3600, 3900, 4300, 4600, 5000, 5300] },
    { minAge: 80, maxAge: Number.POSITIVE_INFINITY, label: "80+", starts: [0, 3300, 3600, 4000, 4300, 4700, 5000] },
  ],
  female: [
    { minAge: 18, maxAge: 20, label: "18–20", starts: [0, 4600, 5100, 5500, 6000, 6400, 6900] },
    { minAge: 21, maxAge: 39, label: "21–39", starts: [0, 4700, 5200, 5700, 6300, 6800, 7300] },
    { minAge: 40, maxAge: 44, label: "40–44", starts: [0, 4700, 5200, 5700, 6200, 6700, 7200] },
    { minAge: 45, maxAge: 49, label: "45–49", starts: [0, 4600, 5100, 5600, 6100, 6600, 7100] },
    { minAge: 50, maxAge: 54, label: "50–54", starts: [0, 4500, 5000, 5400, 5900, 6300, 6800] },
    { minAge: 55, maxAge: 59, label: "55–59", starts: [0, 4300, 4700, 5100, 5600, 6000, 6400] },
    { minAge: 60, maxAge: 64, label: "60–64", starts: [0, 4100, 4500, 4900, 5300, 5700, 6100] },
    { minAge: 65, maxAge: 69, label: "65–69", starts: [0, 3800, 4200, 4600, 4900, 5300, 5700] },
    { minAge: 70, maxAge: 74, label: "70–74", starts: [0, 3700, 4100, 4400, 4800, 5100, 5500] },
    { minAge: 75, maxAge: 79, label: "75–79", starts: [0, 3500, 3800, 4200, 4500, 4900, 5200] },
    { minAge: 80, maxAge: Number.POSITIVE_INFINITY, label: "80+", starts: [0, 3200, 3500, 3800, 4100, 4400, 4700] },
  ],
};

const VO2_REFERENCE: Record<ProfileSex, readonly (readonly [number, number, number, number])[]> = {
  male: [
    [41.7, 45.4, 51.1, 55.4],
    [40.5, 44.0, 48.3, 54.0],
    [38.5, 42.4, 46.4, 52.5],
    [35.6, 39.2, 43.4, 48.9],
    [32.3, 35.5, 39.5, 45.7],
    [29.4, 32.3, 36.7, 42.1],
  ],
  female: [
    [36.1, 39.5, 43.9, 49.6],
    [34.4, 37.8, 42.4, 47.4],
    [33.0, 36.3, 39.7, 45.3],
    [30.1, 33.0, 36.7, 41.1],
    [27.5, 30.0, 33.0, 37.8],
    [25.9, 28.1, 30.9, 36.7],
  ],
};

function clamp(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(Math.max(value, minimum), maximum);
}

function clamp01(value: number) {
  return clamp(value, 0, 1);
}

function ramp(value: number, start: number, end: number) {
  return clamp01((value - start) / Math.max(end - start, Number.EPSILON));
}

function round(value: number, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function roundTo(value: number, step: number) {
  return Math.round(value / step) * step;
}

function uniqueReasons(reasons: DemandReasonCode[]) {
  return [...new Set(reasons)];
}

function projectDial(
  low: number,
  high: number,
  domainMin: number,
  domainMax: number,
  invert = false,
): DialProjection {
  const safeLow = Math.min(low, high);
  const safeHigh = Math.max(low, high);
  const span = Math.max(domainMax - domainMin, Number.EPSILON);
  const project = (value: number) => {
    const normalized = ((value - domainMin) / span) * 100;
    return invert ? 100 - normalized : normalized;
  };
  const projectedLow = project(safeLow);
  const projectedHigh = project(safeHigh);

  return {
    domainMin,
    domainMax,
    startPct: round(clamp(Math.min(projectedLow, projectedHigh), 0, 100), 2),
    endPct: round(clamp(Math.max(projectedLow, projectedHigh), 0, 100), 2),
    clippedLow: safeLow < domainMin,
    clippedHigh: safeHigh > domainMax,
  };
}

function buildSegments(preview: RoutePreview) {
  const points = [...(preview.elevationProfile ?? [])]
    .filter(
      (point) =>
        Number.isFinite(point.distanceKm) &&
        point.distanceKm >= 0 &&
        Number.isFinite(point.elevationM),
    )
    .sort((a, b) => a.distanceKm - b.distanceKm);
  const segments: AnalysisSegment[] = [];

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const distanceM = (end.distanceKm - start.distanceKm) * 1000;
    if (!Number.isFinite(distanceM) || distanceM <= 0) continue;

    const storedGrades = [start.gradePercent, end.gradePercent].filter(
      (value): value is number => value != null && Number.isFinite(value),
    );
    const riseM = end.elevationM - start.elevationM;
    const gradePercent = storedGrades.length
      ? storedGrades.reduce((total, value) => total + value, 0) / storedGrades.length
      : (riseM / distanceM) * 100;

    segments.push({
      distanceM,
      gradePercent,
      riseM,
      meanElevationM: (start.elevationM + end.elevationM) / 2,
    });
  }

  const routeDistanceM = Math.max(preview.stats.totalDistanceKm * 1000, 0);
  const coveredDistanceM = segments.reduce((total, segment) => total + segment.distanceM, 0);
  if (routeDistanceM > coveredDistanceM + 1) {
    segments.push({
      distanceM: routeDistanceM - coveredDistanceM,
      gradePercent: 0,
      riseM: 0,
      meanElevationM:
        preview.stats.lowestElevationM != null && preview.stats.highestElevationM != null
          ? (preview.stats.lowestElevationM + preview.stats.highestElevationM) / 2
          : 0,
    });
  }

  if (segments.length === 0 && routeDistanceM > 0) {
    segments.push({
      distanceM: routeDistanceM,
      gradePercent: 0,
      riseM: 0,
      meanElevationM: 0,
    });
  }

  const profileDistanceM = points.length >= 2
    ? Math.max((points.at(-1)!.distanceKm - points[0].distanceKm) * 1000, 0)
    : 0;

  return {
    segments,
    routeDistanceM,
    elevationCoverage:
      routeDistanceM > 0 ? clamp(profileDistanceM / routeDistanceM, 0, 1) : 0,
    hasElevationProfile: points.length >= 2,
  };
}

function weightedPercentile(
  values: Array<{ value: number; weight: number }>,
  percentile: number,
) {
  if (!values.length) return 0;
  const sorted = values.toSorted((a, b) => a.value - b.value);
  const totalWeight = sorted.reduce((total, entry) => total + entry.weight, 0);
  const target = totalWeight * clamp01(percentile);
  let cumulative = 0;
  for (const entry of sorted) {
    cumulative += entry.weight;
    if (cumulative >= target) return entry.value;
  }
  return sorted.at(-1)!.value;
}

function longestContinuousClimb(segments: AnalysisSegment[]) {
  let longest = 0;
  let currentGain = 0;
  let currentDip = 0;

  for (const segment of segments) {
    if (segment.riseM > 0 && segment.gradePercent >= 1) {
      currentGain += segment.riseM;
      currentDip = 0;
      longest = Math.max(longest, currentGain);
      continue;
    }

    if (segment.riseM < 0) {
      currentDip += Math.abs(segment.riseM);
      if (currentDip > 20) {
        currentGain = 0;
        currentDip = 0;
      }
    }
  }

  return longest;
}

function minettiRunningCost(decimalGrade: number) {
  const i = clamp(decimalGrade, -0.45, 0.45);
  const cost =
    155.4 * i ** 5 -
    30.4 * i ** 4 -
    43.3 * i ** 3 +
    46.3 * i ** 2 +
    19.5 * i +
    3.6;
  return clamp(cost, 0.5, 80);
}

function calculateMetabolicDemand(
  preview: RoutePreview,
  segments: AnalysisSegment[],
  movingMinutes: number,
  averageSpeedMps: number,
) {
  const bodyKg = preview.survey.bodyWeightKg;
  const rawPackRatio = preview.survey.packWeightKg / bodyKg;
  const modeledPackKg = Math.min(preview.survey.packWeightKg, bodyKg * 0.5);
  const loadRatio = 1 + modeledPackKg / bodyKg;
  const totalDistanceM = Math.max(
    segments.reduce((total, segment) => total + segment.distanceM, 0),
    1,
  );
  const reasons: DemandReasonCode[] = [];
  let activeCalories = 0;
  let weightedGrossOxygen = 0;
  let gradeWasClamped = false;

  if (rawPackRatio > 0.31) reasons.push("pack-ratio-outside-study");

  for (const segment of segments) {
    const segmentMinutes = movingMinutes * (segment.distanceM / totalDistanceM);

    if (preview.survey.activity === "trail-run") {
      const decimalGrade = segment.gradePercent / 100;
      if (decimalGrade < -0.45 || decimalGrade > 0.45) gradeWasClamped = true;
      const cost = minettiRunningCost(decimalGrade);
      const segmentEnergyJ = cost * segment.distanceM * (bodyKg + modeledPackKg);
      const netPowerPerBodyKg = cost * averageSpeedMps * loadRatio;
      const grossOxygen = 3.5 + (netPowerPerBodyKg * 60) / 20.9;
      activeCalories += segmentEnergyJ / 4184;
      weightedGrossOxygen += grossOxygen * segmentMinutes;
      continue;
    }

    const modeledGrade = clamp(segment.gradePercent, -10.5, 15.8);
    if (modeledGrade !== segment.gradePercent) gradeWasClamped = true;
    const grossOxygen = modeledGrade >= 0
      ? 3.05 + loadRatio * (
          0.32 * modeledGrade +
          3.28 +
          (1 + 0.19 * modeledGrade) * 2.66 * averageSpeedMps ** 2
        )
      : 3.05 + 0.73 * loadRatio * (3.28 + 2.66 * averageSpeedMps ** 2);
    activeCalories +=
      (Math.max(grossOxygen - 3.05, 0) * bodyKg * segmentMinutes * 4.8) / 1000;
    weightedGrossOxygen += grossOxygen * segmentMinutes;
  }

  if (gradeWasClamped) reasons.push("grade-clamped");
  if (
    preview.survey.activity !== "trail-run" &&
    (averageSpeedMps < 0.4 || averageSpeedMps > 1.6)
  ) {
    reasons.push("walking-speed-outside-study");
  }

  return {
    activeCalories: Math.max(activeCalories, 0),
    grossOxygenMlKgMin: Math.max(weightedGrossOxygen / Math.max(movingMinutes, 1), 3.05),
    reasons,
  };
}

function hillBandForSeverity(severity: number) {
  const index = severity < 0.16
    ? 0
    : severity < 0.32
      ? 1
      : severity < 0.48
        ? 2
        : severity < 0.64
          ? 3
          : severity < 0.8
            ? 4
            : 5;
  return HILL_BANDS[index];
}

function enduranceCategoryIndex(severity: number) {
  if (severity < 0.2) return 0;
  if (severity < 0.34) return 1;
  if (severity < 0.48) return 2;
  if (severity < 0.63) return 3;
  if (severity < 0.77) return 4;
  if (severity < 0.9) return 5;
  return 6;
}

function enduranceReferenceRow(sex: ProfileSex, ageYears: number) {
  return ENDURANCE_REFERENCE[sex].find(
    (row) => ageYears >= row.minAge && ageYears <= row.maxAge,
  ) ?? null;
}

function vo2Reference(sex: ProfileSex, ageYears: number) {
  if (ageYears < 20 || ageYears >= 80) return null;
  const index = Math.min(Math.floor((ageYears - 20) / 10), 5);
  return {
    ageBand: `${20 + index * 10}–${29 + index * 10}`,
    thresholds: VO2_REFERENCE[sex][index],
  };
}

function vo2Category(
  center: number,
  thresholds: readonly [number, number, number, number] | null,
): Vo2Category {
  if (!thresholds) return "reference-unavailable";
  const [fair, good, excellent, superior] = thresholds;
  if (center >= superior) return "superior";
  if (center >= excellent) return "excellent";
  if (center >= good) return "good";
  if (center >= fair) return "fair";
  return "poor";
}

function unavailable(reasons: DemandReasonCode[]): UnavailableEstimate {
  return {
    status: "unavailable",
    confidence: "low",
    reasons: uniqueReasons(reasons),
    dial: null,
  };
}

function emptyAnalysis(preview: RoutePreview): RouteDemandAnalysis {
  const reasons: DemandReasonCode[] = ["insufficient-route"];
  const empty = unavailable(reasons);
  const zeroEstimate: NumericEstimate = {
    status: "outside-model",
    center: 0,
    low: 0,
    high: 0,
    confidence: "low",
    reasons,
    dial: projectDial(0, 0, 0, 100),
  };

  return {
    modelVersion: ROUTE_DEMAND_MODEL_VERSION,
    status: "insufficient-route",
    activity: preview.survey.activity,
    fileName: preview.fileName,
    profile: {
      sex: preview.survey.sex,
      ageYears: preview.survey.ageYears,
    },
    confidence: "low",
    warnings: reasons,
    features: {
      distanceKm: 0,
      movingMinutes: 0,
      averageSpeedMps: 0,
      ascentM: 0,
      ascentPerKm: 0,
      verticalSpeedMPerHour: 0,
      longestClimbM: 0,
      p90PositiveGrade: 0,
      uphillDistanceShare: 0,
      meanElevationM: 0,
      highestElevationM: 0,
      elevationCoverage: 0,
      grossOxygenMlKgMin: 0,
      activeCaloriesCenter: 0,
      hillSeverity: 0,
      enduranceSeverity: 0,
    },
    metrics: {
      hill: empty,
      endurance: { ...empty, category: "recreational", ageBand: null },
      vo2Max: { ...zeroEstimate, category: "reference-unavailable", ageBand: null },
      lactateThreshold: { ...empty, unit: "min-km" },
      activeCalories: { ...zeroEstimate, unit: "kcal", dial: projectDial(0, 0, 0, 6000) },
      recovery: { ...zeroEstimate, unit: "hours", dial: projectDial(0, 0, 0, 96) },
    },
  };
}

export function calculateRouteDemand(preview: RoutePreview): RouteDemandAnalysis {
  const movingMinutes = preview.survey.movingHours * 60 + preview.survey.movingMinutes;
  const { segments, routeDistanceM, elevationCoverage, hasElevationProfile } =
    buildSegments(preview);
  if (routeDistanceM <= 0 || movingMinutes <= 0 || segments.length === 0) {
    return emptyAnalysis(preview);
  }

  const distanceKm = routeDistanceM / 1000;
  const movingHours = movingMinutes / 60;
  const averageSpeedMps = routeDistanceM / (movingMinutes * 60);
  const segmentDistanceM = segments.reduce((total, segment) => total + segment.distanceM, 0);
  const derivedAscentM = segments.reduce(
    (total, segment) => total + Math.max(segment.riseM, 0),
    0,
  );
  const ascentM = Math.max(preview.stats.totalAscentM ?? derivedAscentM, 0);
  const highestElevationM = Math.max(
    preview.stats.highestElevationM ??
      segments.reduce((highest, segment) => Math.max(highest, segment.meanElevationM), 0),
    0,
  );
  const meanElevationM = segmentDistanceM > 0
    ? segments.reduce(
        (total, segment) => total + segment.meanElevationM * segment.distanceM,
        0,
      ) / segmentDistanceM
    : 0;
  const ascentPerKm = ascentM / Math.max(distanceKm, 0.001);
  const verticalSpeedMPerHour = ascentM / Math.max(movingHours, 0.001);
  const longestClimbM = longestContinuousClimb(segments);
  const positiveGrades = segments
    .filter((segment) => segment.gradePercent > 0)
    .map((segment) => ({ value: segment.gradePercent, weight: segment.distanceM }));
  const p90PositiveGrade = weightedPercentile(positiveGrades, 0.9);
  const uphillDistanceShare = segments.reduce(
    (total, segment) => total + (segment.gradePercent > 2 ? segment.distanceM : 0),
    0,
  ) / Math.max(segmentDistanceM, 1);

  const warnings: DemandReasonCode[] = [];
  if (!hasElevationProfile) warnings.push("missing-elevation");
  else if (elevationCoverage < 0.85) warnings.push("partial-elevation");
  if (meanElevationM > 2800) warnings.push("altitude-outside-study");

  const metabolic = calculateMetabolicDemand(
    preview,
    segments,
    movingMinutes,
    averageSpeedMps,
  );
  warnings.push(...metabolic.reasons);
  const uniqueWarnings = uniqueReasons(warnings);
  const outsideModel = uniqueWarnings.some((reason) =>
    [
      "partial-elevation",
      "grade-clamped",
      "walking-speed-outside-study",
      "pack-ratio-outside-study",
      "altitude-outside-study",
    ].includes(reason),
  );
  const numericStatus: NumericEstimate["status"] = outsideModel
    ? "outside-model"
    : "estimated";
  const baseConfidence: EstimateConfidence =
    uniqueWarnings.length || !hasElevationProfile ? "low" : "medium";

  const hillSeverity = clamp01(
    0.25 * ramp(ascentPerKm, 15, 120) +
    0.23 * ramp(verticalSpeedMPerHour, 100, 800) +
    0.18 * ramp(longestClimbM, 80, 1200) +
    0.14 * ramp(p90PositiveGrade, 3, 20) +
    0.1 * ramp(uphillDistanceShare, 0.1, 0.65) +
    0.1 * ramp(highestElevationM, 1000, 3500),
  );
  const selectedHillBand = hillBandForSeverity(hillSeverity);
  const hill = hasElevationProfile
    ? {
        status: numericStatus,
        center: (selectedHillBand.low + selectedHillBand.high) / 2,
        low: selectedHillBand.low,
        high: selectedHillBand.high,
        confidence: "low" as const,
        reasons: uniqueReasons([
          ...uniqueWarnings,
          "no-training-history",
          "heuristic-unvalidated",
        ]),
        dial: projectDial(selectedHillBand.low, selectedHillBand.high, 0, 100),
        category: selectedHillBand.category,
      }
    : unavailable(["missing-elevation", "no-training-history", "heuristic-unvalidated"]);

  const caloriesPerBodyKg = metabolic.activeCalories / preview.survey.bodyWeightKg;
  const enduranceSeverity = clamp01(
    0.5 * clamp01(movingHours / 14) +
    0.3 * clamp01((distanceKm + ascentM / 100) / 70) +
    0.2 * clamp01(caloriesPerBodyKg / 70),
  );
  const enduranceIndex = enduranceCategoryIndex(enduranceSeverity);
  const enduranceCategory = ENDURANCE_CATEGORIES[enduranceIndex];
  const referenceRow = enduranceReferenceRow(
    preview.survey.sex,
    preview.survey.ageYears,
  );
  const endurance = referenceRow
    ? (() => {
        const referenceLow = enduranceIndex === 0 ? null : referenceRow.starts[enduranceIndex];
        const referenceHigh = enduranceIndex === 6
          ? null
          : referenceRow.starts[enduranceIndex + 1] - 1;
        const projectedLow = referenceLow ?? 0;
        const projectedHigh = referenceHigh ?? 10_000;
        const center = (projectedLow + projectedHigh) / 2;
        return {
          status: numericStatus,
          center,
          low: projectedLow,
          high: projectedHigh,
          confidence: "low" as const,
          reasons: uniqueReasons([
            ...uniqueWarnings,
            "no-training-history",
            "heuristic-unvalidated",
          ]),
          dial: projectDial(projectedLow, projectedHigh, 0, 10_000),
          category: enduranceCategory,
          ageBand: referenceRow.label,
          rangeKind: enduranceIndex === 0
            ? "less-than" as const
            : enduranceIndex === 6
              ? "at-least" as const
              : "between" as const,
          referenceLow,
          referenceHigh,
        };
      })()
    : {
        ...unavailable([
          "unsupported-age-reference",
          "no-training-history",
          "heuristic-unvalidated",
        ]),
        category: enduranceCategory,
        ageBand: null,
      };

  const durationReserve = clamp(
    (940 - clamp(movingMinutes, 10, 480)) / 1000,
    0.46,
    0.9,
  );
  const altitudeAvailability = clamp(
    1 - (0.063 * Math.max(meanElevationM - 300, 0)) / 1000,
    0.65,
    1,
  );
  let uncertainty = 0.15;
  if (!hasElevationProfile || elevationCoverage < 0.85) uncertainty += 0.08;
  if (metabolic.reasons.length) uncertainty += 0.05;
  if (meanElevationM > 2800) uncertainty += 0.05;
  uncertainty = clamp(uncertainty, 0.15, 0.35);

  const vo2Center = clamp(
    metabolic.grossOxygenMlKgMin / (durationReserve * altitudeAvailability),
    metabolic.grossOxygenMlKgMin,
    200,
  );
  const vo2Low = clamp(
    Math.max(metabolic.grossOxygenMlKgMin, vo2Center * (1 - uncertainty)),
    3.5,
    200,
  );
  const vo2High = clamp(vo2Center * (1 + uncertainty), vo2Low, 220);
  const vo2ReferenceRow = vo2Reference(preview.survey.sex, preview.survey.ageYears);
  const vo2Reasons = [...uniqueWarnings];
  if (!vo2ReferenceRow) vo2Reasons.push("unsupported-age-reference");
  const vo2Max = {
    status: numericStatus,
    center: round(vo2Center, 1),
    low: round(vo2Low, 1),
    high: round(vo2High, 1),
    confidence: baseConfidence,
    reasons: uniqueReasons(vo2Reasons),
    dial: projectDial(vo2Low, vo2High, 20, 80),
    category: vo2Category(vo2Center, vo2ReferenceRow?.thresholds ?? null),
    ageBand: vo2ReferenceRow?.ageBand ?? null,
  };

  let lactateThreshold: RouteDemandAnalysis["metrics"]["lactateThreshold"];
  if (preview.survey.activity !== "trail-run") {
    lactateThreshold = {
      ...unavailable(["running-threshold-not-applicable", "no-heart-rate"]),
      unit: "min-km",
    };
  } else if (movingMinutes < 20) {
    lactateThreshold = {
      ...unavailable(["threshold-duration-too-short", "no-heart-rate"]),
      unit: "min-km",
    };
  } else {
    const sustainableThresholdFraction = clamp(
      0.93 - 0.06 * Math.log2(Math.max(movingMinutes, 30) / 30),
      0.68,
      0.93,
    );
    const qThreshold = metabolic.grossOxygenMlKgMin /
      (sustainableThresholdFraction * altitudeAvailability);
    const thresholdUncertainty = clamp(
      0.12 + (metabolic.reasons.length ? 0.05 : 0) + (meanElevationM > 2800 ? 0.05 : 0),
      0.12,
      0.3,
    );
    const paceForOxygen = (oxygen: number) => {
      const speedMps = (Math.max(oxygen - 3.5, 0.1) * 20.9) / (60 * 3.6);
      return 1000 / (60 * Math.max(speedMps, 0.05));
    };
    const fasterPace = paceForOxygen(qThreshold * (1 + thresholdUncertainty));
    const slowerPace = paceForOxygen(qThreshold * (1 - thresholdUncertainty));
    const centerPace = paceForOxygen(qThreshold);
    lactateThreshold = {
      status: numericStatus,
      center: round(centerPace, 2),
      low: round(Math.min(fasterPace, slowerPace), 2),
      high: round(Math.max(fasterPace, slowerPace), 2),
      confidence: baseConfidence,
      reasons: uniqueReasons([...uniqueWarnings, "no-heart-rate"]),
      dial: projectDial(
        Math.min(fasterPace, slowerPace),
        Math.max(fasterPace, slowerPace),
        3,
        12,
        true,
      ),
      unit: "min-km",
    };
  }

  const calorieUncertainty = clamp(
    0.15 + (!hasElevationProfile || elevationCoverage < 0.85 ? 0.08 : 0) +
      (metabolic.reasons.length ? 0.05 : 0),
    0.15,
    0.4,
  );
  const calorieCenter = roundTo(metabolic.activeCalories, 10);
  const calorieLow = Math.max(0, roundTo(metabolic.activeCalories * (1 - calorieUncertainty), 10));
  const calorieHigh = Math.max(calorieLow, roundTo(metabolic.activeCalories * (1 + calorieUncertainty), 10));
  const activeCalories = {
    status: numericStatus,
    center: calorieCenter,
    low: calorieLow,
    high: calorieHigh,
    confidence: baseConfidence,
    reasons: uniqueWarnings,
    dial: projectDial(calorieLow, calorieHigh, 0, 6000),
    unit: "kcal" as const,
  };

  const recoveryCenter = clamp(
    6 +
      0.65 * caloriesPerBodyKg +
      0.75 * movingHours +
      4 * ramp(meanElevationM, 1500, 3500),
    6,
    72,
  );
  const recoveryLow = clamp(recoveryCenter * 0.6, 0, 96);
  const recoveryHigh = clamp(recoveryCenter * 1.6 + 6, recoveryLow, 96);
  const recovery = {
    status: "outside-model" as const,
    center: Math.round(recoveryCenter),
    low: Math.round(recoveryLow),
    high: Math.round(recoveryHigh),
    confidence: "low" as const,
    reasons: uniqueReasons([
      ...uniqueWarnings,
      "no-heart-rate",
      "no-training-history",
      "heuristic-unvalidated",
    ]),
    dial: projectDial(recoveryLow, recoveryHigh, 0, 96),
    unit: "hours" as const,
  };

  return {
    modelVersion: ROUTE_DEMAND_MODEL_VERSION,
    status: "estimated",
    activity: preview.survey.activity,
    fileName: preview.fileName,
    profile: {
      sex: preview.survey.sex,
      ageYears: preview.survey.ageYears,
    },
    confidence: baseConfidence,
    warnings: uniqueWarnings,
    features: {
      distanceKm: round(distanceKm, 2),
      movingMinutes,
      averageSpeedMps: round(averageSpeedMps, 3),
      ascentM: round(ascentM),
      ascentPerKm: round(ascentPerKm, 1),
      verticalSpeedMPerHour: round(verticalSpeedMPerHour),
      longestClimbM: round(longestClimbM),
      p90PositiveGrade: round(p90PositiveGrade, 1),
      uphillDistanceShare: round(uphillDistanceShare, 3),
      meanElevationM: round(meanElevationM),
      highestElevationM: round(highestElevationM),
      elevationCoverage: round(elevationCoverage, 3),
      grossOxygenMlKgMin: round(metabolic.grossOxygenMlKgMin, 1),
      activeCaloriesCenter: calorieCenter,
      hillSeverity: round(hillSeverity, 3),
      enduranceSeverity: round(enduranceSeverity, 3),
    },
    metrics: {
      hill,
      endurance,
      vo2Max,
      lactateThreshold,
      activeCalories,
      recovery,
    },
  };
}
