export type ArchiveBoundingBox = {
  south: number;
  west: number;
  north: number;
  east: number;
};

export type ArchivePlace = {
  id: string;
  name: string;
  context: string;
  latitude: number;
  longitude: number;
  boundingBox: ArchiveBoundingBox;
};

export type ArchiveRoute = {
  relationId: number;
  name: string;
  reference: string | null;
  network: string | null;
  operator: string | null;
  distance: string | null;
  center: { latitude: number; longitude: number } | null;
};

export type ArchiveCoordinate = {
  latitude: number;
  longitude: number;
  elevationM?: number | null;
};

type PhotonFeature = {
  geometry?: { coordinates?: unknown };
  properties?: Record<string, unknown>;
};

type OsmRelationMember = {
  type?: unknown;
  ref?: unknown;
  role?: unknown;
};

type OsmRelation = {
  type?: unknown;
  id?: unknown;
  tags?: Record<string, unknown>;
  members?: OsmRelationMember[];
  center?: { lat?: unknown; lon?: unknown };
};

type OsmWay = {
  type?: unknown;
  id?: unknown;
  nodes?: unknown[];
  geometry?: Array<{ lat?: unknown; lon?: unknown }>;
};

type OsmNode = {
  type?: unknown;
  id?: unknown;
  lat?: unknown;
  lon?: unknown;
};

const MAX_SEARCH_SPAN_DEGREES = 1.2;
const CONNECTION_EPSILON = 0.000002;
const PLACE_TYPE_PRIORITY: Record<string, number> = {
  city: 0,
  town: 1,
  village: 2,
  hamlet: 3,
  district: 4,
  borough: 5,
  municipality: 6,
  locality: 7,
  other: 8,
  island: 9,
  county: 10,
  state: 11,
  country: 12,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null;
}

function finiteNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function round(value: number, decimals = 6) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function normalizeArchiveBoundingBox(
  value: unknown,
  fallbackLatitude?: number,
  fallbackLongitude?: number,
): ArchiveBoundingBox | null {
  let west: number | null = null;
  let south: number | null = null;
  let east: number | null = null;
  let north: number | null = null;

  if (Array.isArray(value) && value.length >= 4) {
    west = finiteNumber(value[0]);
    south = finiteNumber(value[1]);
    east = finiteNumber(value[2]);
    north = finiteNumber(value[3]);
  } else if (isRecord(value)) {
    south = finiteNumber(value.south);
    west = finiteNumber(value.west);
    north = finiteNumber(value.north);
    east = finiteNumber(value.east);
  }

  const fallbackLat = finiteNumber(fallbackLatitude);
  const fallbackLon = finiteNumber(fallbackLongitude);
  if (south == null || west == null || north == null || east == null) {
    if (fallbackLat == null || fallbackLon == null) return null;
    south = fallbackLat - 0.18;
    north = fallbackLat + 0.18;
    west = fallbackLon - 0.24;
    east = fallbackLon + 0.24;
  }

  if (south > north) [south, north] = [north, south];
  if (west > east) [west, east] = [east, west];
  if (south < -90 || north > 90 || west < -180 || east > 180) return null;

  const centerLatitude = fallbackLat ?? (south + north) / 2;
  const centerLongitude = fallbackLon ?? (west + east) / 2;
  const halfLatitude = Math.min(Math.max((north - south) / 2, 0.04), MAX_SEARCH_SPAN_DEGREES / 2);
  const halfLongitude = Math.min(Math.max((east - west) / 2, 0.04), MAX_SEARCH_SPAN_DEGREES / 2);

  return {
    south: round(clamp(centerLatitude - halfLatitude, -90, 90), 5),
    west: round(clamp(centerLongitude - halfLongitude, -180, 180), 5),
    north: round(clamp(centerLatitude + halfLatitude, -90, 90), 5),
    east: round(clamp(centerLongitude + halfLongitude, -180, 180), 5),
  };
}

export function parsePhotonPlaces(payload: unknown): ArchivePlace[] {
  if (!isRecord(payload) || !Array.isArray(payload.features)) return [];

  const candidates: Array<{ place: ArchivePlace; priority: number }> = [];
  const seen = new Set<string>();
  for (const rawFeature of payload.features as PhotonFeature[]) {
    const properties = rawFeature.properties;
    const coordinates = rawFeature.geometry?.coordinates;
    if (!properties || !Array.isArray(coordinates) || coordinates.length < 2) continue;

    const longitude = finiteNumber(coordinates[0]);
    const latitude = finiteNumber(coordinates[1]);
    if (
      latitude == null || longitude == null ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180
    ) continue;

    const placeType = textValue(properties.type)?.toLowerCase() ?? "";
    if (placeType && PLACE_TYPE_PRIORITY[placeType] == null) continue;
    const name = textValue(properties.name) ?? textValue(properties.city) ??
      textValue(properties.county) ?? textValue(properties.state) ??
      textValue(properties.country);
    if (!name) continue;
    const osmId = finiteNumber(properties.osm_id);
    const osmType = textValue(properties.osm_type) ?? "place";
    const id = osmId == null
      ? `${name}-${latitude.toFixed(4)}-${longitude.toFixed(4)}`
      : `${osmType}-${osmId}`;
    if (seen.has(id)) continue;

    const contextParts = [
      textValue(properties.city),
      textValue(properties.county),
      textValue(properties.state),
      textValue(properties.country),
    ].filter((part): part is string => Boolean(part) && part !== name);
    const boundingBox = normalizeArchiveBoundingBox(
      properties.extent,
      latitude,
      longitude,
    );
    if (!boundingBox) continue;

    seen.add(id);
    candidates.push({
      priority: PLACE_TYPE_PRIORITY[placeType] ?? 9,
      place: {
        id,
        name,
        context: [...new Set(contextParts)].slice(0, 3).join(", "),
        latitude: round(latitude),
        longitude: round(longitude),
        boundingBox,
      },
    });
  }
  return candidates
    .toSorted((a, b) => a.priority - b.priority)
    .slice(0, 6)
    .map((candidate) => candidate.place);
}

export function buildArchiveRouteQuery(boundingBox: ArchiveBoundingBox) {
  const box = normalizeArchiveBoundingBox(boundingBox);
  if (!box) throw new Error("A valid archive search area is required.");
  const values = [box.south, box.west, box.north, box.east]
    .map((value) => value.toFixed(5))
    .join(",");
  return `[out:json][timeout:12];relation["type"="route"]["route"~"^(hiking|foot)$"]["name"](${values});out tags center 40;`;
}

export function parseArchiveRoutes(payload: unknown): ArchiveRoute[] {
  if (!isRecord(payload) || !Array.isArray(payload.elements)) return [];

  const routes: ArchiveRoute[] = [];
  const seen = new Set<number>();
  for (const rawElement of payload.elements as OsmRelation[]) {
    if (rawElement.type !== "relation") continue;
    const relationId = finiteNumber(rawElement.id);
    const tags = rawElement.tags;
    const name = textValue(tags?.name);
    if (relationId == null || !Number.isInteger(relationId) || relationId <= 0 || !name) continue;
    if (seen.has(relationId)) continue;

    const centerLatitude = finiteNumber(rawElement.center?.lat);
    const centerLongitude = finiteNumber(rawElement.center?.lon);
    seen.add(relationId);
    routes.push({
      relationId,
      name,
      reference: textValue(tags?.ref),
      network: textValue(tags?.network),
      operator: textValue(tags?.operator),
      distance: textValue(tags?.distance),
      center: centerLatitude == null || centerLongitude == null
        ? null
        : { latitude: round(centerLatitude), longitude: round(centerLongitude) },
    });
  }

  return routes
    .toSorted((a, b) => {
      const networkOrder = (value: string | null) =>
        ({ iwn: 0, nwn: 1, rwn: 2, lwn: 3 })[value ?? ""] ?? 4;
      return networkOrder(a.network) - networkOrder(b.network) ||
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    })
    .slice(0, 40);
}

export function parseArchiveRelation(payload: unknown, expectedId: number) {
  if (!isRecord(payload) || !Array.isArray(payload.elements)) {
    throw new Error("The route archive returned invalid relation data.");
  }
  const relation = (payload.elements as OsmRelation[]).find(
    (element) => element.type === "relation" && finiteNumber(element.id) === expectedId,
  );
  if (!relation || !relation.tags) throw new Error("This route relation is unavailable.");

  const routeKind = textValue(relation.tags.route);
  if (relation.tags.type !== "route" || !["hiking", "foot"].includes(routeKind ?? "")) {
    throw new Error("This OpenStreetMap relation is not a hiking route.");
  }
  const name = textValue(relation.tags.name) ?? textValue(relation.tags.ref) ??
    `OpenStreetMap route ${expectedId}`;
  const relationById = new Map<number, OsmRelation>();
  for (const element of payload.elements as OsmRelation[]) {
    const id = finiteNumber(element.id);
    if (element.type === "relation" && id != null) relationById.set(id, element);
  }
  const visitedRelations = new Set<number>();
  function collectWays(current: OsmRelation, depth: number): Array<{ id: number; role: string }> {
    const currentId = finiteNumber(current.id);
    if (currentId != null) {
      if (visitedRelations.has(currentId)) return [];
      visitedRelations.add(currentId);
    }
    if (depth > 4 || !Array.isArray(current.members)) return [];

    return current.members.flatMap((member) => {
      const memberId = finiteNumber(member.ref);
      if (memberId == null || !Number.isInteger(memberId) || memberId <= 0) return [];
      if (member.type === "way") {
        return [{ id: memberId, role: textValue(member.role) ?? "" }];
      }
      if (member.type === "relation") {
        const nested = relationById.get(memberId);
        return nested ? collectWays(nested, depth + 1) : [];
      }
      return [];
    });
  }
  const ways = collectWays(relation, 0);

  if (ways.length === 0) throw new Error("This route relation has no usable way members.");
  return { name, ways };
}

function sameCoordinate(a: ArchiveCoordinate, b: ArchiveCoordinate) {
  return Math.abs(a.latitude - b.latitude) <= CONNECTION_EPSILON &&
    Math.abs(a.longitude - b.longitude) <= CONNECTION_EPSILON;
}

function appendWithoutDuplicate(target: ArchiveCoordinate[], points: ArchiveCoordinate[]) {
  const start = target.length && points.length && sameCoordinate(target.at(-1)!, points[0]) ? 1 : 0;
  target.push(...points.slice(start));
}

function prependWithoutDuplicate(target: ArchiveCoordinate[], points: ArchiveCoordinate[]) {
  const end = target.length && points.length && sameCoordinate(points.at(-1)!, target[0])
    ? points.length - 1
    : points.length;
  target.unshift(...points.slice(0, end));
}

export function connectArchiveWays(
  wayMembers: Array<{ id: number; role: string }>,
  payload: unknown,
): ArchiveCoordinate[][] {
  if (!isRecord(payload) || !Array.isArray(payload.elements)) {
    throw new Error("The route archive returned invalid geometry.");
  }

  const geometryById = new Map<number, ArchiveCoordinate[]>();
  const nodeById = new Map<number, ArchiveCoordinate>();
  for (const rawElement of payload.elements as OsmNode[]) {
    if (rawElement.type !== "node") continue;
    const id = finiteNumber(rawElement.id);
    const latitude = finiteNumber(rawElement.lat);
    const longitude = finiteNumber(rawElement.lon);
    if (
      id == null || latitude == null || longitude == null ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180
    ) continue;
    nodeById.set(id, { latitude: round(latitude, 7), longitude: round(longitude, 7) });
  }
  for (const rawElement of payload.elements as OsmWay[]) {
    if (rawElement.type !== "way") continue;
    const id = finiteNumber(rawElement.id);
    if (id == null) continue;
    const rawPoints = Array.isArray(rawElement.geometry)
      ? rawElement.geometry.map((point) => ({ lat: point.lat, lon: point.lon }))
      : Array.isArray(rawElement.nodes)
        ? rawElement.nodes.map((nodeId) => {
            const point = nodeById.get(Number(nodeId));
            return point ? { lat: point.latitude, lon: point.longitude } : null;
          }).filter((point): point is { lat: number; lon: number } => point != null)
        : [];
    const points = rawPoints
      .map((point) => {
        const latitude = finiteNumber(point.lat);
        const longitude = finiteNumber(point.lon);
        if (
          latitude == null || longitude == null ||
          latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180
        ) return null;
        return { latitude: round(latitude, 7), longitude: round(longitude, 7) };
      })
      .filter((point): point is ArchiveCoordinate => point != null)
      .filter((point, index, points) => index === 0 || !sameCoordinate(point, points[index - 1]));
    if (points.length >= 2) geometryById.set(id, points);
  }

  const segments: ArchiveCoordinate[][] = [];
  for (const member of wayMembers) {
    const rawPoints = geometryById.get(member.id);
    if (!rawPoints) continue;
    const points = member.role.toLowerCase().includes("backward")
      ? rawPoints.toReversed()
      : rawPoints.slice();

    let merged = false;
    for (const segment of segments) {
      if (sameCoordinate(segment.at(-1)!, points[0])) {
        appendWithoutDuplicate(segment, points);
        merged = true;
        break;
      }
      if (sameCoordinate(segment.at(-1)!, points.at(-1)!)) {
        appendWithoutDuplicate(segment, points.toReversed());
        merged = true;
        break;
      }
      if (sameCoordinate(segment[0], points.at(-1)!)) {
        prependWithoutDuplicate(segment, points);
        merged = true;
        break;
      }
      if (sameCoordinate(segment[0], points[0])) {
        prependWithoutDuplicate(segment, points.toReversed());
        merged = true;
        break;
      }
    }
    if (!merged) segments.push(points);
  }

  return segments
    .filter((segment) => segment.length >= 2)
    .toSorted((a, b) => b.length - a.length);
}

export function sampleArchiveSegments(
  segments: ArchiveCoordinate[][],
  maximumPoints = 600,
) {
  const validSegments = segments.filter((segment) => segment.length >= 2);
  if (!validSegments.length) return [];
  if (validSegments.length > 80) {
    throw new Error("This route is too fragmented for a reliable preview.");
  }
  const totalPoints = validSegments.reduce((sum, segment) => sum + segment.length, 0);
  if (totalPoints <= maximumPoints) return validSegments.map((segment) => segment.slice());

  const minimumBudget = validSegments.length * 2;
  const target = Math.max(maximumPoints, minimumBudget);
  return validSegments.map((segment) => {
    const proportional = Math.floor((segment.length / totalPoints) * target);
    const budget = Math.max(2, Math.min(segment.length, proportional));
    const sampled: ArchiveCoordinate[] = [];
    for (let index = 0; index < budget; index += 1) {
      const sourceIndex = Math.round((index * (segment.length - 1)) / (budget - 1));
      const point = segment[sourceIndex];
      if (!sampled.length || !sameCoordinate(sampled.at(-1)!, point)) sampled.push(point);
    }
    return sampled;
  });
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function buildArchiveGpx(
  routeName: string,
  relationId: number,
  segments: ArchiveCoordinate[][],
) {
  const validSegments = segments.filter((segment) => segment.length >= 2);
  if (!validSegments.length) throw new Error("This route does not contain usable geometry.");
  const trackSegments = validSegments.map((segment) => {
    const points = segment.map((point) => {
      const elevation = point.elevationM;
      const elevationElement = elevation != null && Number.isFinite(elevation)
        ? `<ele>${round(elevation, 1)}</ele>`
        : "";
      return `<trkpt lat="${point.latitude.toFixed(7)}" lon="${point.longitude.toFixed(7)}">${elevationElement}</trkpt>`;
    }).join("");
    return `<trkseg>${points}</trkseg>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Track4Trek" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>${escapeXml(routeName)}</name><copyright author="OpenStreetMap contributors"><license>https://www.openstreetmap.org/copyright</license></copyright></metadata><trk><name>${escapeXml(routeName)}</name><number>${relationId}</number>${trackSegments}</trk></gpx>`;
}

export function archiveFileName(routeName: string) {
  const safe = routeName
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return `${safe || "openstreetmap-route"}.gpx`;
}
