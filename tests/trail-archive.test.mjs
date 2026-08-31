import assert from "node:assert/strict";
import test from "node:test";

import {
  archiveFileName,
  buildArchiveGpx,
  buildArchiveRouteQuery,
  connectArchiveWays,
  normalizeArchiveBoundingBox,
  parseArchiveRelation,
  parseArchiveRoutes,
  parsePhotonPlaces,
  sampleArchiveSegments,
} from "../app/_lib/trail-archive.ts";

test("Photon places become bounded, deduplicated archive search areas", () => {
  const places = parsePhotonPlaces({
    features: [
      {
        geometry: { coordinates: [0.12, 52.2] },
        properties: {
          osm_id: 123,
          osm_type: "R",
          type: "city",
          name: "Cambridge",
          state: "England",
          country: "United Kingdom",
          extent: [-5, 48, 5, 57],
        },
      },
      {
        geometry: { coordinates: [0.12, 52.2] },
        properties: { osm_id: 123, osm_type: "R", type: "city", name: "Duplicate" },
      },
      {
        geometry: { coordinates: [0.13, 52.21] },
        properties: { osm_id: 999, osm_type: "N", type: "house", name: "Cambridge UK Ltd" },
      },
    ],
  });

  assert.equal(places.length, 1);
  assert.equal(places[0].name, "Cambridge");
  assert.match(places[0].context, /England/);
  assert.ok(places[0].boundingBox.north - places[0].boundingBox.south <= 1.2);
  assert.ok(places[0].boundingBox.east - places[0].boundingBox.west <= 1.2);
});

test("archive bounding boxes reject malformed values and clamp huge regions", () => {
  assert.equal(normalizeArchiveBoundingBox({ south: "x", west: 1, north: 2, east: 3 }), null);
  const box = normalizeArchiveBoundingBox({ south: -20, west: -40, north: 40, east: 60 });
  assert.deepEqual(box, { south: 9.4, west: 9.4, north: 10.6, east: 10.6 });
  assert.match(buildArchiveRouteQuery(box), /route.*hiking\|foot/);
  assert.match(buildArchiveRouteQuery(box), /9\.40000,9\.40000,10\.60000,10\.60000/);
});

test("Overpass route metadata is sanitized, sorted, and bounded", () => {
  const routes = parseArchiveRoutes({
    elements: [
      { type: "way", id: 1, tags: { name: "Not a relation" } },
      { type: "relation", id: 20, tags: { name: "Local Walk", network: "lwn" } },
      {
        type: "relation",
        id: 10,
        tags: { name: "National Trail", ref: "NT", network: "nwn", distance: "80 km" },
        center: { lat: 52.1, lon: 0.2 },
      },
    ],
  });

  assert.deepEqual(routes.map((route) => route.relationId), [10, 20]);
  assert.equal(routes[0].reference, "NT");
  assert.deepEqual(routes[0].center, { latitude: 52.1, longitude: 0.2 });
});

test("relation member ways connect in either direction while disconnected geometry stays separate", () => {
  const relation = parseArchiveRelation({
    elements: [{
      type: "relation",
      id: 99,
      tags: { type: "route", route: "hiking", name: "Ridge & River" },
      members: [
        { type: "way", ref: 1, role: "" },
        { type: "way", ref: 2, role: "" },
        { type: "way", ref: 3, role: "backward" },
      ],
    }],
  }, 99);
  const segments = connectArchiveWays(relation.ways, {
    elements: [
      { type: "way", id: 1, geometry: [{ lat: 1, lon: 1 }, { lat: 1, lon: 2 }] },
      { type: "way", id: 2, geometry: [{ lat: 1, lon: 3 }, { lat: 1, lon: 2 }] },
      { type: "way", id: 3, geometry: [{ lat: 5, lon: 6 }, { lat: 5, lon: 5 }] },
    ],
  });

  assert.equal(segments.length, 2);
  assert.equal(segments[0].length, 3);
  assert.deepEqual(segments[0].map((point) => point.longitude), [1, 2, 3]);
  assert.deepEqual(segments[1].map((point) => point.longitude), [5, 6]);
});

test("OpenStreetMap full relation node references become way geometry", () => {
  const members = [{ id: 7, role: "" }];
  const segments = connectArchiveWays(members, {
    elements: [
      { type: "node", id: 100, lat: 48.1, lon: 11.5 },
      { type: "node", id: 101, lat: 48.2, lon: 11.6 },
      { type: "way", id: 7, nodes: [100, 101] },
    ],
  });
  assert.deepEqual(segments, [[
    { latitude: 48.1, longitude: 11.5 },
    { latitude: 48.2, longitude: 11.6 },
  ]]);
});

test("archive sampling remains bounded and GPX output escapes names", () => {
  const longSegment = Array.from({ length: 1_000 }, (_, index) => ({
    latitude: 40 + index / 100_000,
    longitude: -105 + index / 100_000,
    elevationM: 2_000 + index,
  }));
  const segments = sampleArchiveSegments([longSegment], 100);
  assert.equal(segments[0].length, 100);
  assert.deepEqual(segments[0][0], longSegment[0]);
  assert.deepEqual(segments[0].at(-1), longSegment.at(-1));

  const gpx = buildArchiveGpx("Ridge & <River>", 99, segments);
  assert.match(gpx, /<gpx version="1\.1"/);
  assert.match(gpx, /Ridge &amp; &lt;River&gt;/);
  assert.equal((gpx.match(/<trkpt\b/g) ?? []).length, 100);
  assert.match(gpx, /<ele>2000<\/ele>/);
  assert.match(gpx, /OpenStreetMap contributors/);
  assert.equal(archiveFileName(' Ridge: "River" / Test '), "Ridge- -River- - Test.gpx");
});

test("non-hiking and malformed relations are rejected", () => {
  assert.throws(() => parseArchiveRelation({ elements: [] }, 1), /unavailable/);
  assert.throws(() => parseArchiveRelation({
    elements: [{
      type: "relation",
      id: 1,
      tags: { type: "route", route: "bicycle", name: "Bike route" },
      members: [{ type: "way", ref: 2 }],
    }],
  }, 1), /not a hiking route/);
});
