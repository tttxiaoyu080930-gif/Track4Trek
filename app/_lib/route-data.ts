export const ROUTE_PREVIEW_STORAGE_KEY = "track4trek:route-preview";

export type TripActivity = "day-hike" | "trail-run" | "backpacking";
export type ProfileSex = "male" | "female";

export type SurveyInput = {
  activity: TripActivity;
  sex: ProfileSex;
  ageYears: number;
  bodyWeightKg: number;
  heightCm: number;
  packWeightKg: number;
  movingHours: number;
  movingMinutes: number;
};

export type RoutePoint = {
  latitude: number;
  longitude: number;
  elevation: number | null;
  time: string | null;
};

export type PreviewMapPoint = {
  x: number;
  y: number;
  elevation: number | null;
};

export type PreviewElevationPoint = {
  distanceKm: number;
  elevationM: number;
  gradePercent?: number | null;
};

export type PreviewGeographicPoint = {
  longitude: number;
  latitude: number;
  elevationM: number | null;
};

export type RoutePreview = {
  version: 1 | 2 | 3;
  fileName: string;
  createdAt: string;
  survey: SurveyInput;
  source: {
    kind: "uploaded-gpx" | "sample";
    pointCount: number;
    trackCount: number;
    segmentCount?: number;
    waypointCount: number;
    hasElevation: boolean;
    hasTime: boolean;
  };
  stats: {
    totalDistanceKm: number;
    totalAscentM: number | null;
    totalDescentM: number | null;
    lowestElevationM: number | null;
    highestElevationM: number | null;
    elevationRangeM: number | null;
    requiredPaceMinPerKm: number | null;
    requiredVerticalSpeedMPerHour: number | null;
    boundingBox: {
      north: number;
      south: number;
      east: number;
      west: number;
    } | null;
  };
  mapPath: PreviewMapPoint[];
  elevationProfile?: PreviewElevationPoint[];
  geographicSegments?: PreviewGeographicPoint[][];
};

const MIN_ELEVATION_CHANGE_METERS = 3;

function textContent(parent: Element, tagName: string) {
  return (
    parent.getElementsByTagNameNS("*", tagName)[0]?.textContent?.trim() ??
    parent.getElementsByTagName(tagName)[0]?.textContent?.trim() ??
    null
  );
}

function parseOptionalNumber(value: string | null) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pointFromElement(element: Element): RoutePoint | null {
  const latitude = parseOptionalNumber(element.getAttribute("lat"));
  const longitude = parseOptionalNumber(element.getAttribute("lon"));
  if (
    latitude == null ||
    longitude == null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) return null;

  return {
    latitude,
    longitude,
    elevation: parseOptionalNumber(textContent(element, "ele")),
    time: textContent(element, "time"),
  };
}

function distanceMeters(a: RoutePoint, b: RoutePoint) {
  const earthRadiusMeters = 6371008.8;
  const latA = (a.latitude * Math.PI) / 180;
  const latB = (b.latitude * Math.PI) / 180;
  const deltaLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const deltaLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const sinLat = Math.sin(deltaLat / 2);
  const sinLon = Math.sin(deltaLon / 2);
  const h =
    sinLat * sinLat +
    Math.cos(latA) * Math.cos(latB) * sinLon * sinLon;
  const boundedH = Math.min(Math.max(h, 0), 1);
  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(boundedH), Math.sqrt(1 - boundedH));
}

function round(value: number, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function normalizeForPreview(points: RoutePoint[]): PreviewMapPoint[] {
  if (points.length === 0) return [];

  const sampleStep = Math.max(1, Math.floor(points.length / 80));
  const sampled = points.filter((_, index) => index % sampleStep === 0);
  if (sampled.at(-1) !== points.at(-1)) sampled.push(points.at(-1)!);

  const latitudes = sampled.map((point) => point.latitude);
  let previousLongitude = sampled[0].longitude;
  const longitudes = sampled.map((point, index) => {
    let longitude = point.longitude;
    if (index > 0) {
      while (longitude - previousLongitude > 180) longitude -= 360;
      while (longitude - previousLongitude < -180) longitude += 360;
    }
    previousLongitude = longitude;
    return longitude;
  });
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLon = Math.min(...longitudes);
  const maxLon = Math.max(...longitudes);
  const latSpan = Math.max(maxLat - minLat, 0.000001);
  const lonSpan = Math.max(maxLon - minLon, 0.000001);
  const dominantSpan = Math.max(latSpan, lonSpan);

  return sampled.map((point, index) => ({
    x: ((longitudes[index] - minLon) / dominantSpan - lonSpan / dominantSpan / 2) * 1.85,
    y: -((point.latitude - minLat) / dominantSpan - latSpan / dominantSpan / 2) * 1.85,
    elevation: point.elevation,
  }));
}

function buildGeographicSegments(segments: RoutePoint[][]): PreviewGeographicPoint[][] {
  const validSegments = segments.filter((segment) => segment.length >= 2);
  const totalPointCount = validSegments.reduce((total, segment) => total + segment.length, 0);
  const targetPointCount = Math.min(Math.max(totalPointCount, 2), 1200);

  return validSegments.map((segment) => {
    const segmentBudget = Math.max(
      2,
      Math.round((segment.length / Math.max(totalPointCount, 1)) * targetPointCount),
    );
    if (segment.length <= segmentBudget) {
      return segment.map((point) => ({
        longitude: round(point.longitude, 6),
        latitude: round(point.latitude, 6),
        elevationM: point.elevation == null ? null : round(point.elevation, 1),
      }));
    }

    const highestIndex = segment.reduce((selected, point, index) => {
      if (point.elevation == null) return selected;
      const selectedElevation = segment[selected].elevation;
      return selectedElevation == null || point.elevation > selectedElevation ? index : selected;
    }, 0);
    const lowestIndex = segment.reduce((selected, point, index) => {
      if (point.elevation == null) return selected;
      const selectedElevation = segment[selected].elevation;
      return selectedElevation == null || point.elevation < selectedElevation ? index : selected;
    }, 0);
    const retainedIndices = new Set([0, segment.length - 1, highestIndex, lowestIndex]);
    const uniformSlots = Math.max(2, Math.min(segmentBudget, segment.length));
    for (let slot = 0; slot < uniformSlots; slot += 1) {
      retainedIndices.add(Math.round((slot * (segment.length - 1)) / (uniformSlots - 1)));
    }

    return [...retainedIndices]
      .sort((a, b) => a - b)
      .map((index) => ({
        longitude: round(segment[index].longitude, 6),
        latitude: round(segment[index].latitude, 6),
        elevationM:
          segment[index].elevation == null ? null : round(segment[index].elevation, 1),
      }));
  });
}

function buildElevationProfile(segments: RoutePoint[][]): PreviewElevationPoint[] {
  if (!segments.some((segment) => segment.length >= 2)) return [];

  let cumulativeDistanceMeters = 0;
  const locatedElevations: Array<{
    distanceMeters: number;
    elevationM: number;
    segmentIndex: number;
  }> = [];

  segments.forEach((segment, segmentIndex) => {
    segment.forEach((point, index) => {
      if (index > 0) cumulativeDistanceMeters += distanceMeters(segment[index - 1], point);
      if (point.elevation == null) return;

      locatedElevations.push({
        distanceMeters: cumulativeDistanceMeters,
        elevationM: round(point.elevation, 1),
        segmentIndex,
      });
    });
  });

  const profile = locatedElevations.map<PreviewElevationPoint>((point, index) => {
    let left = index;
    let right = index;

    while (left > 0) {
      const candidate = locatedElevations[left - 1];
      if (candidate.segmentIndex !== point.segmentIndex) break;
      left -= 1;
      if (point.distanceMeters - candidate.distanceMeters >= 25) break;
    }
    while (right < locatedElevations.length - 1) {
      const candidate = locatedElevations[right + 1];
      if (candidate.segmentIndex !== point.segmentIndex) break;
      right += 1;
      if (candidate.distanceMeters - point.distanceMeters >= 25) break;
    }

    const windowDistance =
      locatedElevations[right].distanceMeters - locatedElevations[left].distanceMeters;
    const elevationChange =
      locatedElevations[right].elevationM - locatedElevations[left].elevationM;
    const rawGrade = windowDistance > 0 ? (elevationChange / windowDistance) * 100 : null;
    const gradePercent =
      windowDistance >= 20 &&
      windowDistance <= 1000 &&
      rawGrade != null &&
      Math.abs(rawGrade) <= 100
        ? round(rawGrade, 1)
        : null;

    return {
      distanceKm: round(point.distanceMeters / 1000, 4),
      elevationM: point.elevationM,
      gradePercent,
    };
  });

  if (profile.length <= 180) return profile;

  const sampleStep = Math.max(1, Math.ceil(profile.length / 180));
  const highestIndex = profile.reduce(
    (selected, point, index) => point.elevationM > profile[selected].elevationM ? index : selected,
    0,
  );
  const lowestIndex = profile.reduce(
    (selected, point, index) => point.elevationM < profile[selected].elevationM ? index : selected,
    0,
  );
  const validGradeIndices = profile
    .map((point, index) => ({ index, gradePercent: point.gradePercent }))
    .filter(
      (point): point is { index: number; gradePercent: number } =>
        point.gradePercent != null && Number.isFinite(point.gradePercent),
    );
  const steepestAscentIndex = validGradeIndices.reduce(
    (selected, point) => point.gradePercent > selected.gradePercent ? point : selected,
    validGradeIndices[0],
  )?.index;
  const steepestDescentIndex = validGradeIndices.reduce(
    (selected, point) => point.gradePercent < selected.gradePercent ? point : selected,
    validGradeIndices[0],
  )?.index;
  const retainedIndices = new Set([
    0,
    profile.length - 1,
    highestIndex,
    lowestIndex,
    steepestAscentIndex,
    steepestDescentIndex,
  ].filter((index): index is number => index != null));
  for (let index = 0; index < profile.length; index += sampleStep) retainedIndices.add(index);

  return [...retainedIndices]
    .sort((a, b) => a - b)
    .map((index) => profile[index]);
}

function buildStats(segments: RoutePoint[][], survey: SurveyInput): RoutePreview["stats"] {
  const points = segments.flat();
  let distance = 0;
  let ascent = 0;
  let descent = 0;
  const elevations = points
    .map((point) => point.elevation)
    .filter((value): value is number => value != null);

  segments.forEach((segment) => {
    for (let index = 1; index < segment.length; index += 1) {
      distance += distanceMeters(segment[index - 1], segment[index]);

      const previousElevation = segment[index - 1].elevation;
      const currentElevation = segment[index].elevation;
      if (previousElevation != null && currentElevation != null) {
        const difference = currentElevation - previousElevation;
        if (Math.abs(difference) >= MIN_ELEVATION_CHANGE_METERS) {
          if (difference > 0) ascent += difference;
          else descent += Math.abs(difference);
        }
      }
    }
  });

  const movingMinutes = survey.movingHours * 60 + survey.movingMinutes;
  const distanceKm = distance / 1000;
  const lowestElevationM = elevations.length ? Math.min(...elevations) : null;
  const highestElevationM = elevations.length ? Math.max(...elevations) : null;
  const boundingLatitudes = points.map((point) => point.latitude);
  const boundingLongitudes = points.map((point) => point.longitude);

  return {
    totalDistanceKm: round(distanceKm),
    totalAscentM: elevations.length ? Math.round(ascent) : null,
    totalDescentM: elevations.length ? Math.round(descent) : null,
    lowestElevationM: lowestElevationM == null ? null : Math.round(lowestElevationM),
    highestElevationM: highestElevationM == null ? null : Math.round(highestElevationM),
    elevationRangeM:
      lowestElevationM == null || highestElevationM == null
        ? null
        : Math.round(highestElevationM - lowestElevationM),
    requiredPaceMinPerKm:
      movingMinutes > 0 && distanceKm > 0 ? round(movingMinutes / distanceKm, 1) : null,
    requiredVerticalSpeedMPerHour:
      movingMinutes > 0 && elevations.length
        ? Math.round(ascent / (movingMinutes / 60))
        : null,
    boundingBox: points.length
      ? {
          north: round(Math.max(...boundingLatitudes), 5),
          south: round(Math.min(...boundingLatitudes), 5),
          east: round(Math.max(...boundingLongitudes), 5),
          west: round(Math.min(...boundingLongitudes), 5),
        }
      : null,
  };
}

export function parseGpxRoute(fileName: string, gpxText: string, survey: SurveyInput): RoutePreview {
  const document = new DOMParser().parseFromString(gpxText, "application/xml");
  const parseError = document.getElementsByTagName("parsererror")[0];
  if (parseError) {
    throw new Error("This GPX file could not be read.");
  }

  const trackElements = Array.from(document.getElementsByTagNameNS("*", "trk"));
  const waypointCount = document.getElementsByTagNameNS("*", "wpt").length;
  const trackSegments = Array.from(document.getElementsByTagNameNS("*", "trkseg"))
    .map((segment) =>
      Array.from(segment.getElementsByTagNameNS("*", "trkpt"))
        .map(pointFromElement)
        .filter((point): point is RoutePoint => point != null),
    )
    .filter((segment) => segment.length >= 2);
  const trackPoints = Array.from(document.getElementsByTagNameNS("*", "trkpt"))
    .map(pointFromElement)
    .filter((point): point is RoutePoint => point != null);
  const routePoints = Array.from(document.getElementsByTagNameNS("*", "rtept"))
    .map(pointFromElement)
    .filter((point): point is RoutePoint => point != null);
  const segments = trackSegments.length
    ? trackSegments
    : trackPoints.length >= 2
      ? [trackPoints]
      : routePoints.length >= 2
        ? [routePoints]
        : [];
  const points = segments.flat();

  if (points.length < 2) {
    throw new Error("This file needs at least two GPX track or route points.");
  }
  const previewSegment = segments.reduce(
    (longest, segment) => segment.length > longest.length ? segment : longest,
    segments[0],
  );

  return {
    version: 3,
    fileName,
    createdAt: new Date().toISOString(),
    survey,
    source: {
      kind: "uploaded-gpx",
      pointCount: points.length,
      trackCount: trackElements.length,
      segmentCount: segments.length,
      waypointCount,
      hasElevation: points.some((point) => point.elevation != null),
      hasTime: points.some((point) => point.time != null),
    },
    stats: buildStats(segments, survey),
    mapPath: normalizeForPreview(previewSegment),
    elevationProfile: buildElevationProfile(segments),
    geographicSegments: buildGeographicSegments(segments),
  };
}

export function createSampleRoutePreview(survey: SurveyInput): RoutePreview {
  const points: RoutePoint[] = [
    { latitude: 22.2522, longitude: 113.8829, elevation: 340, time: null },
    { latitude: 22.2551, longitude: 113.8876, elevation: 420, time: null },
    { latitude: 22.2593, longitude: 113.8924, elevation: 575, time: null },
    { latitude: 22.264, longitude: 113.8996, elevation: 760, time: null },
    { latitude: 22.2671, longitude: 113.9051, elevation: 934, time: null },
    { latitude: 22.2705, longitude: 113.9113, elevation: 820, time: null },
    { latitude: 22.2742, longitude: 113.9182, elevation: 650, time: null },
    { latitude: 22.2784, longitude: 113.9256, elevation: 480, time: null },
    { latitude: 22.2821, longitude: 113.9324, elevation: 360, time: null },
  ];

  return {
    version: 3,
    fileName: "Lantau_Ridge_sample.gpx",
    createdAt: new Date().toISOString(),
    survey,
    source: {
      kind: "sample",
      pointCount: points.length,
      trackCount: 1,
      segmentCount: 1,
      waypointCount: 0,
      hasElevation: true,
      hasTime: false,
    },
    stats: buildStats([points], survey),
    mapPath: normalizeForPreview(points),
    elevationProfile: buildElevationProfile([points]),
    geographicSegments: buildGeographicSegments([points]),
  };
}

export function saveRoutePreview(preview: RoutePreview) {
  window.localStorage.setItem(ROUTE_PREVIEW_STORAGE_KEY, JSON.stringify(preview));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isOptionalElevation(value: unknown) {
  return value == null || isFiniteNumber(value);
}

function isStoredMapPoint(value: unknown): value is PreviewMapPoint {
  return isRecord(value) &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    isOptionalElevation(value.elevation);
}

function isStoredGeographicPoint(value: unknown): value is PreviewGeographicPoint {
  return isRecord(value) &&
    isFiniteNumber(value.longitude) &&
    value.longitude >= -180 &&
    value.longitude <= 180 &&
    isFiniteNumber(value.latitude) &&
    value.latitude >= -90 &&
    value.latitude <= 90 &&
    isOptionalElevation(value.elevationM);
}

function isStoredRoutePreview(value: unknown): value is RoutePreview {
  if (!isRecord(value) || value.version !== 3) return false;
  if (typeof value.fileName !== "string" || typeof value.createdAt !== "string") return false;
  if (!isRecord(value.survey) || !isRecord(value.source) || !isRecord(value.stats)) return false;
  if (!Array.isArray(value.mapPath) || !value.mapPath.every(isStoredMapPoint)) return false;

  const activity = value.survey.activity;
  const sex = value.survey.sex;
  if (
    !["day-hike", "trail-run", "backpacking"].includes(String(activity)) ||
    !["male", "female"].includes(String(sex)) ||
    !isFiniteNumber(value.survey.ageYears) ||
    !Number.isInteger(value.survey.ageYears) ||
    value.survey.ageYears < 13 ||
    value.survey.ageYears > 100 ||
    !isFiniteNumber(value.survey.bodyWeightKg) ||
    value.survey.bodyWeightKg < 30 ||
    value.survey.bodyWeightKg > 250 ||
    !isFiniteNumber(value.survey.heightCm) ||
    value.survey.heightCm < 120 ||
    value.survey.heightCm > 230 ||
    !isFiniteNumber(value.survey.packWeightKg) ||
    value.survey.packWeightKg < 0 ||
    value.survey.packWeightKg > 60 ||
    !isFiniteNumber(value.survey.movingHours) ||
    !Number.isInteger(value.survey.movingHours) ||
    value.survey.movingHours < 0 ||
    value.survey.movingHours > 48 ||
    !isFiniteNumber(value.survey.movingMinutes) ||
    !Number.isInteger(value.survey.movingMinutes) ||
    value.survey.movingMinutes < 0 ||
    value.survey.movingMinutes > 59 ||
    value.survey.movingHours * 60 + value.survey.movingMinutes < 1 ||
    value.survey.movingHours * 60 + value.survey.movingMinutes > 48 * 60
  ) return false;

  if (
    !["uploaded-gpx", "sample"].includes(String(value.source.kind)) ||
    !isFiniteNumber(value.source.pointCount) ||
    !isFiniteNumber(value.source.trackCount) ||
    !isFiniteNumber(value.source.waypointCount) ||
    typeof value.source.hasElevation !== "boolean" ||
    typeof value.source.hasTime !== "boolean"
  ) return false;

  if (
    !isFiniteNumber(value.stats.totalDistanceKm) ||
    !isOptionalElevation(value.stats.totalAscentM) ||
    !isOptionalElevation(value.stats.totalDescentM) ||
    !isOptionalElevation(value.stats.lowestElevationM) ||
    !isOptionalElevation(value.stats.highestElevationM) ||
    !isOptionalElevation(value.stats.elevationRangeM) ||
    !isOptionalElevation(value.stats.requiredPaceMinPerKm) ||
    !isOptionalElevation(value.stats.requiredVerticalSpeedMPerHour)
  ) return false;

  if (value.geographicSegments != null) {
    if (!Array.isArray(value.geographicSegments)) return false;
    if (!value.geographicSegments.every(
      (segment) => Array.isArray(segment) && segment.every(isStoredGeographicPoint),
    )) return false;
  }

  return true;
}

export function readRoutePreview() {
  const raw = window.localStorage.getItem(ROUTE_PREVIEW_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    return isStoredRoutePreview(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
