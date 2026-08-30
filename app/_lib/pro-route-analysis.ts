import type {
  PreviewElevationPoint,
  PreviewGeographicPoint,
  RoutePreview,
} from "./route-data";

export type GradeDistribution = {
  steepDescent: number;
  descent: number;
  level: number;
  climb: number;
  steepClimb: number;
};

export type ProSegmentAnalysis = {
  index: number;
  pointCount: number;
  distanceKm: number;
  start: PreviewGeographicPoint;
  finish: PreviewGeographicPoint;
  lowestM: number | null;
  highestM: number | null;
  ascentM: number | null;
  descentM: number | null;
};

export type ProRouteAnalysis = {
  fileName: string;
  sourceKind: RoutePreview["source"]["kind"];
  pathKind: "track" | "route" | "sample";
  pointCount: number;
  sampledCoordinateCount: number;
  trackCount: number;
  segmentCount: number;
  waypointCount: number;
  hasElevation: boolean;
  hasTime: boolean;
  distanceKm: number;
  ascentM: number | null;
  descentM: number | null;
  ascentPerKm: number | null;
  descentPerKm: number | null;
  lowestM: number | null;
  highestM: number | null;
  meanElevationM: number | null;
  medianElevationM: number | null;
  elevationStdDevM: number | null;
  elevationRangeM: number | null;
  netElevationM: number | null;
  elevationCoveragePct: number;
  steepestAscentPct: number | null;
  steepestDescentPct: number | null;
  p90AscentPct: number | null;
  p90DescentPct: number | null;
  longestClimbGainM: number;
  longestClimbDistanceKm: number;
  highestAtKm: number | null;
  lowestAtKm: number | null;
  gradeDistribution: GradeDistribution;
  segments: ProSegmentAnalysis[];
  start: PreviewGeographicPoint | null;
  finish: PreviewGeographicPoint | null;
  center: { latitude: number; longitude: number } | null;
  initialBearingDeg: number | null;
  endpointGapKm: number | null;
  isLoop: boolean | null;
  northSouthExtentKm: number | null;
  eastWestExtentKm: number | null;
  boundary: RoutePreview["stats"]["boundingBox"];
};

function round(value: number, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function percentile(values: number[], fraction: number) {
  if (!values.length) return null;
  const sorted = values.toSorted((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.round((sorted.length - 1) * fraction)),
  );
  return sorted[index];
}

function distanceKm(a: PreviewGeographicPoint, b: PreviewGeographicPoint) {
  const earthRadiusKm = 6371.0088;
  const latitudeA = (a.latitude * Math.PI) / 180;
  const latitudeB = (b.latitude * Math.PI) / 180;
  const deltaLatitude = ((b.latitude - a.latitude) * Math.PI) / 180;
  const deltaLongitude = ((b.longitude - a.longitude) * Math.PI) / 180;
  const h =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(deltaLongitude / 2) ** 2;
  const bounded = Math.min(Math.max(h, 0), 1);
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(bounded), Math.sqrt(1 - bounded));
}

function initialBearing(a: PreviewGeographicPoint, b: PreviewGeographicPoint) {
  const latitudeA = (a.latitude * Math.PI) / 180;
  const latitudeB = (b.latitude * Math.PI) / 180;
  const deltaLongitude = ((b.longitude - a.longitude) * Math.PI) / 180;
  const y = Math.sin(deltaLongitude) * Math.cos(latitudeB);
  const x =
    Math.cos(latitudeA) * Math.sin(latitudeB) -
    Math.sin(latitudeA) * Math.cos(latitudeB) * Math.cos(deltaLongitude);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function analyzeSegments(segments: PreviewGeographicPoint[][]): ProSegmentAnalysis[] {
  return segments
    .filter((segment) => segment.length >= 2)
    .map((segment, index) => {
      let distance = 0;
      let ascent = 0;
      let descent = 0;
      const elevations = segment
        .map((point) => point.elevationM)
        .filter((value): value is number => value != null && Number.isFinite(value));

      for (let pointIndex = 1; pointIndex < segment.length; pointIndex += 1) {
        distance += distanceKm(segment[pointIndex - 1], segment[pointIndex]);
        const previousElevation = segment[pointIndex - 1].elevationM;
        const currentElevation = segment[pointIndex].elevationM;
        if (previousElevation == null || currentElevation == null) continue;
        const change = currentElevation - previousElevation;
        if (change > 0) ascent += change;
        else if (change < 0) descent += Math.abs(change);
      }

      return {
        index: index + 1,
        pointCount: segment.length,
        distanceKm: round(distance, 2),
        start: segment[0],
        finish: segment.at(-1)!,
        lowestM: elevations.length ? round(Math.min(...elevations)) : null,
        highestM: elevations.length ? round(Math.max(...elevations)) : null,
        ascentM: elevations.length ? round(ascent) : null,
        descentM: elevations.length ? round(descent) : null,
      };
    });
}

function validElevationPoints(preview: RoutePreview) {
  return (preview.elevationProfile ?? [])
    .filter(
      (point) =>
        Number.isFinite(point.distanceKm) &&
        point.distanceKm >= 0 &&
        Number.isFinite(point.elevationM),
    )
    .toSorted((a, b) => a.distanceKm - b.distanceKm);
}

function gradeAtPoint(
  point: PreviewElevationPoint,
  previous: PreviewElevationPoint | undefined,
) {
  if (point.gradePercent != null && Number.isFinite(point.gradePercent)) {
    return point.gradePercent;
  }
  if (!previous) return null;
  const horizontalMeters = (point.distanceKm - previous.distanceKm) * 1000;
  if (horizontalMeters < 20) return null;
  const grade = ((point.elevationM - previous.elevationM) / horizontalMeters) * 100;
  return Number.isFinite(grade) && Math.abs(grade) <= 100 ? grade : null;
}

function analyzeGrades(points: PreviewElevationPoint[]): {
  grades: number[];
  distribution: GradeDistribution;
  longestClimbGainM: number;
  longestClimbDistanceKm: number;
} {
  const weighted = {
    steepDescent: 0,
    descent: 0,
    level: 0,
    climb: 0,
    steepClimb: 0,
  };
  const grades: number[] = [];
  let totalDistance = 0;
  let currentGain = 0;
  let currentDistance = 0;
  let longestClimbGainM = 0;
  let longestClimbDistanceKm = 0;

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const point = points[index];
    const segmentDistanceKm = Math.max(point.distanceKm - previous.distanceKm, 0);
    if (segmentDistanceKm <= 0) continue;
    totalDistance += segmentDistanceKm;
    const grade = gradeAtPoint(point, previous);
    if (grade != null) {
      grades.push(grade);
      if (grade < -10) weighted.steepDescent += segmentDistanceKm;
      else if (grade < -3) weighted.descent += segmentDistanceKm;
      else if (grade <= 3) weighted.level += segmentDistanceKm;
      else if (grade <= 10) weighted.climb += segmentDistanceKm;
      else weighted.steepClimb += segmentDistanceKm;
    }

    const elevationChange = point.elevationM - previous.elevationM;
    if (elevationChange > 0 && (grade ?? 0) >= 1) {
      currentGain += elevationChange;
      currentDistance += segmentDistanceKm;
      if (currentGain > longestClimbGainM) {
        longestClimbGainM = currentGain;
        longestClimbDistanceKm = currentDistance;
      }
    } else if (elevationChange < -3 || (grade ?? 0) < 0) {
      currentGain = 0;
      currentDistance = 0;
    } else if (currentGain > 0) {
      currentDistance += segmentDistanceKm;
    }
  }

  const normalize = (value: number) =>
    totalDistance > 0 ? round((value / totalDistance) * 100, 1) : 0;

  return {
    grades,
    distribution: {
      steepDescent: normalize(weighted.steepDescent),
      descent: normalize(weighted.descent),
      level: normalize(weighted.level),
      climb: normalize(weighted.climb),
      steepClimb: normalize(weighted.steepClimb),
    },
    longestClimbGainM: round(longestClimbGainM),
    longestClimbDistanceKm: round(longestClimbDistanceKm, 2),
  };
}

export function calculateProRouteAnalysis(preview: RoutePreview): ProRouteAnalysis {
  const elevationPoints = validElevationPoints(preview);
  const elevations = elevationPoints.map((point) => point.elevationM);
  const geometry = (preview.geographicSegments ?? []).filter((segment) => segment.length >= 2);
  const segmentAnalysis = analyzeSegments(geometry);
  const allCoordinates = geometry.flat();
  const start = geometry[0]?.[0] ?? null;
  const finish = geometry.at(-1)?.at(-1) ?? null;
  const routeDistanceKm = Math.max(preview.stats.totalDistanceKm, 0);
  const profileDistanceKm = elevationPoints.at(-1)?.distanceKm ?? 0;
  const meanElevationM = elevations.length
    ? elevations.reduce((total, value) => total + value, 0) / elevations.length
    : null;
  const medianElevationM = percentile(elevations, 0.5);
  const elevationStdDevM = meanElevationM == null
    ? null
    : Math.sqrt(
        elevations.reduce((total, value) => total + (value - meanElevationM) ** 2, 0) /
          Math.max(elevations.length, 1),
      );
  const gradeAnalysis = analyzeGrades(elevationPoints);
  const ascentGrades = gradeAnalysis.grades.filter((grade) => grade > 0);
  const descentGrades = gradeAnalysis.grades.filter((grade) => grade < 0);
  const highestPoint = elevationPoints.length
    ? elevationPoints.reduce((selected, point) =>
        point.elevationM > selected.elevationM ? point : selected,
      )
    : null;
  const lowestPoint = elevationPoints.length
    ? elevationPoints.reduce((selected, point) =>
        point.elevationM < selected.elevationM ? point : selected,
      )
    : null;
  const endpointGapKm = start && finish ? distanceKm(start, finish) : null;
  const boundary = preview.stats.boundingBox;
  const center = boundary
    ? {
        latitude: round((boundary.north + boundary.south) / 2, 5),
        longitude: round((boundary.east + boundary.west) / 2, 5),
      }
    : null;
  const northSouthExtentKm = boundary
    ? distanceKm(
        { latitude: boundary.south, longitude: center!.longitude, elevationM: null },
        { latitude: boundary.north, longitude: center!.longitude, elevationM: null },
      )
    : null;
  const eastWestExtentKm = boundary
    ? distanceKm(
        { latitude: center!.latitude, longitude: boundary.west, elevationM: null },
        { latitude: center!.latitude, longitude: boundary.east, elevationM: null },
      )
    : null;
  const firstBearingTarget = geometry[0]?.[1] ?? null;
  const firstElevation = elevationPoints[0]?.elevationM ?? null;
  const finalElevation = elevationPoints.at(-1)?.elevationM ?? null;

  return {
    fileName: preview.fileName,
    sourceKind: preview.source.kind,
    pathKind: preview.source.kind === "sample"
      ? "sample"
      : preview.source.trackCount > 0
        ? "track"
        : "route",
    pointCount: preview.source.pointCount,
    sampledCoordinateCount: allCoordinates.length,
    trackCount: preview.source.trackCount,
    segmentCount: preview.source.segmentCount ?? Math.max(geometry.length, 1),
    waypointCount: preview.source.waypointCount,
    hasElevation: preview.source.hasElevation,
    hasTime: preview.source.hasTime,
    distanceKm: round(routeDistanceKm, 2),
    ascentM: preview.stats.totalAscentM,
    descentM: preview.stats.totalDescentM,
    ascentPerKm: preview.stats.totalAscentM == null || routeDistanceKm <= 0
      ? null
      : round(preview.stats.totalAscentM / routeDistanceKm, 1),
    descentPerKm: preview.stats.totalDescentM == null || routeDistanceKm <= 0
      ? null
      : round(preview.stats.totalDescentM / routeDistanceKm, 1),
    lowestM: preview.stats.lowestElevationM,
    highestM: preview.stats.highestElevationM,
    meanElevationM: meanElevationM == null ? null : round(meanElevationM),
    medianElevationM: medianElevationM == null ? null : round(medianElevationM),
    elevationStdDevM: elevationStdDevM == null ? null : round(elevationStdDevM),
    elevationRangeM: preview.stats.elevationRangeM,
    netElevationM: firstElevation == null || finalElevation == null
      ? null
      : round(finalElevation - firstElevation),
    elevationCoveragePct: routeDistanceKm > 0
      ? round(Math.min(profileDistanceKm / routeDistanceKm, 1) * 100, 1)
      : 0,
    steepestAscentPct: ascentGrades.length ? round(Math.max(...ascentGrades), 1) : null,
    steepestDescentPct: descentGrades.length ? round(Math.min(...descentGrades), 1) : null,
    p90AscentPct: percentile(ascentGrades, 0.9),
    p90DescentPct: percentile(descentGrades, 0.1),
    longestClimbGainM: gradeAnalysis.longestClimbGainM,
    longestClimbDistanceKm: gradeAnalysis.longestClimbDistanceKm,
    highestAtKm: highestPoint == null ? null : round(highestPoint.distanceKm, 2),
    lowestAtKm: lowestPoint == null ? null : round(lowestPoint.distanceKm, 2),
    gradeDistribution: gradeAnalysis.distribution,
    segments: segmentAnalysis,
    start,
    finish,
    center,
    initialBearingDeg: start && firstBearingTarget
      ? round(initialBearing(start, firstBearingTarget))
      : null,
    endpointGapKm: endpointGapKm == null ? null : round(endpointGapKm, 2),
    isLoop: endpointGapKm == null || routeDistanceKm <= 0
      ? null
      : endpointGapKm <= Math.max(routeDistanceKm * 0.03, 0.1),
    northSouthExtentKm: northSouthExtentKm == null ? null : round(northSouthExtentKm, 2),
    eastWestExtentKm: eastWestExtentKm == null ? null : round(eastWestExtentKm, 2),
    boundary,
  };
}
