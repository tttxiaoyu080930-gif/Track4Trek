"use client";

import { useEffect, useRef } from "react";
import type {
  ErrorEvent as MapLibreErrorEvent,
  ExpressionSpecification,
  GeoJSONSource,
  Map as MapLibreMap,
  MapSourceDataEvent,
  Marker,
  StyleSpecification,
} from "maplibre-gl";
import type { PreviewGeographicPoint } from "../_lib/route-data";
import { THEME_CHANGE_EVENT, type Track4TrekTheme } from "./theme-system";
import type { Track4TrekLanguage } from "./language-system";

export type TerrainMapStatus = "idle" | "loading" | "ready" | "error";
export type TerrainDisplayMode = "contour" | "real";

type MapLibreTerrainMapProps = {
  segments: PreviewGeographicPoint[][];
  language: Track4TrekLanguage;
  displayMode: TerrainDisplayMode;
  onStatusChange: (status: TerrainMapStatus, reason?: "timeout" | "initialization") => void;
  onIntroComplete: () => void;
};

type TimelinePoint = PreviewGeographicPoint & {
  unwrappedLongitude: number;
  distanceFromSegmentStartM: number;
};

type TimelineSegment = {
  points: TimelinePoint[];
  distanceM: number;
};

type RouteFeature = {
  type: "Feature";
  properties: Record<string, never>;
  geometry: {
    type: "MultiLineString";
    coordinates: number[][][];
  };
};

const BASEMAP_SOURCE = "track4trek-basemap";
const BASEMAP_LAYER = "track4trek-basemap-raster";
const BASEMAP_TILES = ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"];
const TERRAIN_TILES = ["https://tiles.mapterhorn.com/{z}/{x}/{y}.webp"];
const TERRAIN_SOURCE = "track4trek-terrain";
const HILLSHADE_SOURCE = "track4trek-hillshade-dem";
const HILLSHADE_LAYER = "track4trek-terrain-hillshade";
const CONTOUR_SOURCE = "track4trek-real-contours";
const CONTOUR_LAYER = "track4trek-real-contours-line";
const ROUTE_SOURCE = "track4trek-route";
const ROUTE_LAYER = "track4trek-route-line";
const TERRAIN_MAX_ZOOM = 12;
const TERRAIN_EXAGGERATION = 1.18;
const HILLSHADE_EXAGGERATION = 0.54;
const CONTOUR_THRESHOLDS = {
  8: [200, 1000],
  10: [100, 500],
  12: [50, 250],
  14: [20, 100],
};

type ContourModule = typeof import("maplibre-contour").default;
type SharedDemSource = InstanceType<ContourModule["DemSource"]>;

let sharedDemSource: SharedDemSource | null = null;
let sharedDemProtocolsRegistered = false;

function terrainDemSource(contourModule: ContourModule) {
  sharedDemSource ??= new contourModule.DemSource({
    id: "track4trek-dem",
    url: TERRAIN_TILES[0],
    encoding: "terrarium",
    maxzoom: TERRAIN_MAX_ZOOM,
    worker: true,
    cacheSize: 64,
    timeoutMs: 8_000,
  });
  return sharedDemSource;
}

function distanceMeters(a: PreviewGeographicPoint, b: PreviewGeographicPoint) {
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
  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(1 - h, 0)));
}

function buildTimeline(segments: PreviewGeographicPoint[][]) {
  const timeline: TimelineSegment[] = [];
  let totalDistanceM = 0;
  let routeReferenceLongitude: number | null = null;

  segments.forEach((segment) => {
    if (segment.length < 2) return;
    const points: TimelinePoint[] = [];
    let segmentDistanceM = 0;
    let previousLongitude = segment[0].longitude;

    if (routeReferenceLongitude != null) {
      while (previousLongitude - routeReferenceLongitude > 180) previousLongitude -= 360;
      while (previousLongitude - routeReferenceLongitude < -180) previousLongitude += 360;
    } else {
      routeReferenceLongitude = previousLongitude;
    }

    segment.forEach((point, index) => {
      let unwrappedLongitude = index === 0 ? previousLongitude : point.longitude;
      if (index > 0) {
        while (unwrappedLongitude - previousLongitude > 180) unwrappedLongitude -= 360;
        while (unwrappedLongitude - previousLongitude < -180) unwrappedLongitude += 360;
        segmentDistanceM += distanceMeters(segment[index - 1], point);
      }
      previousLongitude = unwrappedLongitude;
      points.push({
        ...point,
        unwrappedLongitude,
        distanceFromSegmentStartM: segmentDistanceM,
      });
    });

    timeline.push({ points, distanceM: segmentDistanceM });
    totalDistanceM += segmentDistanceM;
  });

  return { segments: timeline, totalDistanceM };
}

function routeFeatureAtProgress(
  timeline: ReturnType<typeof buildTimeline>,
  progress: number,
): RouteFeature {
  const targetDistance = timeline.totalDistanceM * Math.min(Math.max(progress, 0), 1);
  const coordinates: number[][][] = [];
  let consumedDistance = 0;

  for (const segment of timeline.segments) {
    const segmentTarget = targetDistance - consumedDistance;
    if (segmentTarget < 0) break;

    if (segmentTarget >= segment.distanceM) {
      coordinates.push(
        segment.points.map((point) => [point.unwrappedLongitude, point.latitude]),
      );
      consumedDistance += segment.distanceM;
      continue;
    }

    const partial: number[][] = [[
      segment.points[0].unwrappedLongitude,
      segment.points[0].latitude,
    ]];
    for (let index = 1; index < segment.points.length; index += 1) {
      const point = segment.points[index];
      const previous = segment.points[index - 1];
      if (point.distanceFromSegmentStartM <= segmentTarget) {
        partial.push([point.unwrappedLongitude, point.latitude]);
        continue;
      }

      const interval = Math.max(
        point.distanceFromSegmentStartM - previous.distanceFromSegmentStartM,
        0.001,
      );
      const ratio = Math.min(
        Math.max((segmentTarget - previous.distanceFromSegmentStartM) / interval, 0),
        1,
      );
      partial.push([
        previous.unwrappedLongitude +
          (point.unwrappedLongitude - previous.unwrappedLongitude) * ratio,
        previous.latitude + (point.latitude - previous.latitude) * ratio,
      ]);
      break;
    }

    if (partial.length === 1) partial.push([...partial[0]]);
    coordinates.push(partial);
    break;
  }

  if (coordinates.length === 0 && timeline.segments[0]) {
    const first = timeline.segments[0].points[0];
    coordinates.push([
      [first.unwrappedLongitude, first.latitude],
      [first.unwrappedLongitude, first.latitude],
    ]);
  }

  return {
    type: "Feature",
    properties: {},
    geometry: { type: "MultiLineString", coordinates },
  };
}

function routeBounds(timeline: ReturnType<typeof buildTimeline>) {
  const points = timeline.segments.flatMap((segment) => segment.points);
  return points.reduce(
    (bounds, point) => ({
      west: Math.min(bounds.west, point.unwrappedLongitude),
      south: Math.min(bounds.south, point.latitude),
      east: Math.max(bounds.east, point.unwrappedLongitude),
      north: Math.max(bounds.north, point.latitude),
    }),
    {
      west: Number.POSITIVE_INFINITY,
      south: Number.POSITIVE_INFINITY,
      east: Number.NEGATIVE_INFINITY,
      north: Number.NEGATIVE_INFINITY,
    },
  );
}

function mapTheme(): Track4TrekTheme {
  return document.documentElement.dataset.track4trekTheme === "light" ? "light" : "dark";
}

function routeColor(theme: Track4TrekTheme) {
  return theme === "light" ? "#c55e31" : "#f2a15c";
}

function contourColor(theme: Track4TrekTheme) {
  return theme === "light" ? "#315d69" : "#a8e0e6";
}

function fastMapStyle(theme: Track4TrekTheme): StyleSpecification {
  const dark = theme === "dark";

  return {
    version: 8,
    sources: {
      [BASEMAP_SOURCE]: {
        type: "raster",
        tiles: BASEMAP_TILES,
        tileSize: 256,
        maxzoom: 19,
        attribution:
          '<a href="https://www.openstreetmap.org/copyright">&copy; OpenStreetMap contributors</a>',
      },
    },
    layers: [
      {
        id: "track4trek-map-background",
        type: "background",
        paint: { "background-color": dark ? "#07111c" : "#edf2f4" },
      },
      {
        id: BASEMAP_LAYER,
        type: "raster",
        source: BASEMAP_SOURCE,
        paint: dark
          ? {
              "raster-brightness-min": 0.04,
              "raster-brightness-max": 0.5,
              "raster-contrast": 0.2,
              "raster-saturation": -0.72,
              "raster-fade-duration": 0,
            }
          : {
              "raster-brightness-min": 0.08,
              "raster-brightness-max": 0.96,
              "raster-contrast": 0.06,
              "raster-saturation": -0.18,
              "raster-fade-duration": 0,
            },
      },
    ],
  };
}

function markerElement(kind: "start" | "finish" | "high" | "low", label: string) {
  const marker = document.createElement("div");
  marker.className = `real-map-marker real-map-marker-${kind}`;
  marker.setAttribute("role", "img");
  marker.setAttribute("aria-label", label);
  const dot = document.createElement("i");
  const text = document.createElement("span");
  text.textContent = label;
  marker.append(dot, text);
  return marker;
}

function extremaPoints(timeline: ReturnType<typeof buildTimeline>) {
  const points = timeline.segments.flatMap((segment) => segment.points).filter(
    (point): point is TimelinePoint & { elevationM: number } =>
      point.elevationM != null && Number.isFinite(point.elevationM),
  );
  if (!points.length) return { highest: null, lowest: null };

  return {
    highest: points.reduce((selected, point) =>
      point.elevationM > selected.elevationM ? point : selected,
    ),
    lowest: points.reduce((selected, point) =>
      point.elevationM < selected.elevationM ? point : selected,
    ),
  };
}

export function MapLibreTerrainMap({
  segments,
  language,
  displayMode,
  onStatusChange,
  onIntroComplete,
}: MapLibreTerrainMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const statusCallbackRef = useRef(onStatusChange);
  const introCallbackRef = useRef(onIntroComplete);
  const displayModeRef = useRef(displayMode);
  const applyDisplayModeRef = useRef<(mode: TerrainDisplayMode) => void>(() => undefined);

  useEffect(() => {
    statusCallbackRef.current = onStatusChange;
    introCallbackRef.current = onIntroComplete;
  }, [onIntroComplete, onStatusChange]);

  useEffect(() => {
    displayModeRef.current = displayMode;
    applyDisplayModeRef.current(displayMode);
  }, [displayMode]);

  useEffect(() => {
    const container = containerRef.current;
    const timeline = buildTimeline(segments);
    if (!container || timeline.segments.length === 0) {
      statusCallbackRef.current("idle");
      return;
    }

    let disposed = false;
    let map: MapLibreMap | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let animationFrame: number | undefined;
    let contourAnimationFrame: number | undefined;
    let contourAnimationTimeout: number | undefined;
    let drapeRefreshTimeout: number | undefined;
    let loadTimeout: number | undefined;
    let introTimeout: number | undefined;
    let terrainTimeout: number | undefined;
    let terrainInstalled = false;
    let introStarted = false;
    let introScheduled = false;
    let introComplete = false;
    let mapRevealed = false;
    let contoursReady = false;
    let currentRouteData = routeFeatureAtProgress(timeline, 0);
    const markers: Marker[] = [];
    const cleanupListeners: Array<() => void> = [];

    statusCallbackRef.current("loading");

    const initialize = async () => {
      try {
        const [maplibregl, contourLibrary] = await Promise.all([
          import("maplibre-gl"),
          import("maplibre-contour"),
        ]);
        if (disposed) return;
        maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
        const demSource = terrainDemSource(contourLibrary.default);
        if (!sharedDemProtocolsRegistered) {
          demSource.setupMaplibre(maplibregl);
          sharedDemProtocolsRegistered = true;
        }

        let activeTheme = mapTheme();
        map = new maplibregl.Map({
          container,
          style: fastMapStyle(activeTheme),
          center: [timeline.segments[0].points[0].unwrappedLongitude, timeline.segments[0].points[0].latitude],
          zoom: 11,
          pitch: 64,
          bearing: -28,
          maxPitch: 82,
          scrollZoom: false,
          fadeDuration: 0,
          maxTileCacheZoomLevels: 2,
          pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
          renderWorldCopies: false,
          locale: language === "zh"
            ? {
                "AttributionControl.ToggleAttribution": "显示或隐藏地图来源",
                "Map.Title": "三维路线地图",
                "Marker.Title": "地图标记",
                "NavigationControl.ResetBearing": "拖动以旋转地图，点击以恢复朝北",
                "NavigationControl.ZoomIn": "放大",
                "NavigationControl.ZoomOut": "缩小",
              }
            : undefined,
          canvasContextAttributes: { antialias: false },
        });
        const handleMapError = (event: MapLibreErrorEvent) => {
          console.warn("[Track4Trek terrain] MapLibre resource error:", event.error.message);
        };
        map.on("error", handleMapError);
        cleanupListeners.push(() => map?.off("error", handleMapError));
        map.getCanvas().setAttribute(
          "aria-label",
          language === "zh"
            ? "真实三维地形路线图。开场动画结束后，可拖动或使用左右方向键旋转。"
            : "Real three-dimensional terrain route map. After the intro, drag or use the left and right arrow keys to rotate.",
        );
        map.dragPan.disable();
        map.addControl(
          new maplibregl.NavigationControl({
            showZoom: true,
            showCompass: true,
            visualizePitch: true,
          }),
          "bottom-right",
        );

        const installRouteLayer = () => {
          if (!map || !map.getStyle()) return;
          if (!map.getSource(ROUTE_SOURCE)) {
            map.addSource(ROUTE_SOURCE, { type: "geojson", data: currentRouteData });
          }
          if (!map.getLayer(ROUTE_LAYER)) {
            map.addLayer({
              id: ROUTE_LAYER,
              type: "line",
              source: ROUTE_SOURCE,
              layout: {
                "line-cap": "round",
                "line-join": "round",
              },
              paint: {
                "line-color": routeColor(activeTheme),
                "line-width": ["interpolate", ["linear"], ["zoom"], 8, 2.4, 13, 4.4, 17, 6],
                "line-opacity": 0.96,
              },
            });
          }
        };

        const installTerrainLayers = () => {
          if (!map || !map.getStyle() || terrainInstalled) return;
          if (!map.getSource(TERRAIN_SOURCE)) {
            map.addSource(TERRAIN_SOURCE, {
              type: "raster-dem",
              tiles: [demSource.sharedDemProtocolUrl],
              tileSize: 512,
              encoding: "terrarium",
              maxzoom: TERRAIN_MAX_ZOOM,
              attribution: '<a href="https://mapterhorn.com/attribution">&copy; Mapterhorn</a>',
            });
          }
          if (!map.getSource(CONTOUR_SOURCE)) {
            map.addSource(CONTOUR_SOURCE, {
              type: "vector",
              tiles: [demSource.contourProtocolUrl({
                thresholds: CONTOUR_THRESHOLDS,
                overzoom: 1,
                contourLayer: "contours",
                elevationKey: "ele",
                levelKey: "level",
              })],
              maxzoom: 12,
            });
          }
          if (!map.getSource(HILLSHADE_SOURCE)) {
            map.addSource(HILLSHADE_SOURCE, {
              type: "raster-dem",
              tiles: [demSource.sharedDemProtocolUrl],
              tileSize: 512,
              encoding: "terrarium",
              maxzoom: TERRAIN_MAX_ZOOM,
            });
          }
          const beforeRoute = map.getLayer(ROUTE_LAYER) ? ROUTE_LAYER : undefined;
          if (!map.getLayer(HILLSHADE_LAYER)) {
            map.addLayer({
              id: HILLSHADE_LAYER,
              type: "hillshade",
              source: HILLSHADE_SOURCE,
              paint: {
                "hillshade-accent-color": activeTheme === "light" ? "#7c9498" : "#17394a",
                "hillshade-highlight-color": activeTheme === "light" ? "#ffffff" : "#d8f1ef",
                "hillshade-shadow-color": activeTheme === "light" ? "#789096" : "#020b13",
                "hillshade-exaggeration": 0,
              },
            }, beforeRoute);
          }
          if (!map.getLayer(CONTOUR_LAYER)) {
            map.addLayer({
              id: CONTOUR_LAYER,
              type: "line",
              source: CONTOUR_SOURCE,
              "source-layer": "contours",
              layout: {
                "line-cap": "round",
                "line-join": "round",
                visibility: displayModeRef.current === "contour" ? "visible" : "none",
              },
              paint: {
                "line-color": contourColor(activeTheme),
                "line-width": ["match", ["get", "level"], 1, 1.7, 0.82],
                "line-opacity": 0,
              },
            }, beforeRoute);
          }
          map.setTerrain({ source: TERRAIN_SOURCE, exaggeration: TERRAIN_EXAGGERATION });
          terrainInstalled = true;
          contoursReady = false;
          container.dataset.contours = "loading";
          applyDisplayModeRef.current(displayModeRef.current);
        };

        const scheduleTerrainLayers = (delay = 500) => {
          if (terrainInstalled || disposed) return;
          if (terrainTimeout !== undefined) window.clearTimeout(terrainTimeout);
          terrainTimeout = window.setTimeout(() => {
            terrainTimeout = undefined;
            installTerrainLayers();
          }, delay);
        };

        const clearContourAnimation = () => {
          if (contourAnimationFrame !== undefined) {
            window.cancelAnimationFrame(contourAnimationFrame);
            contourAnimationFrame = undefined;
          }
          if (contourAnimationTimeout !== undefined) {
            window.clearTimeout(contourAnimationTimeout);
            contourAnimationTimeout = undefined;
          }
          container.classList.remove("is-contour-revealing");
        };

        const setBasemapVisibility = (visible: boolean) => {
          if (!map?.getLayer(BASEMAP_LAYER)) return;
          map.setLayoutProperty(BASEMAP_LAYER, "visibility", visible ? "visible" : "none");
        };

        const refreshTerrainDrape = () => {
          if (!map || !terrainInstalled || !map.getSource(TERRAIN_SOURCE)) return;
          map.setTerrain(null);
          window.requestAnimationFrame(() => {
            if (!map || disposed || !terrainInstalled || !map.getSource(TERRAIN_SOURCE)) return;
            map.setTerrain({ source: TERRAIN_SOURCE, exaggeration: TERRAIN_EXAGGERATION });
            map.triggerRepaint();
          });
        };

        const scheduleTerrainDrapeRefresh = () => {
          if (drapeRefreshTimeout !== undefined) window.clearTimeout(drapeRefreshTimeout);
          drapeRefreshTimeout = window.setTimeout(() => {
            drapeRefreshTimeout = undefined;
            if (displayModeRef.current === "real") refreshTerrainDrape();
          }, 680);
        };

        const finalContourOpacity: ExpressionSpecification = [
          "match",
          ["get", "level"],
          1,
          0.94,
          0.62,
        ];

        const animateContourReveal = () => {
          if (!map || !contoursReady || !map.getLayer(CONTOUR_LAYER)) return;
          clearContourAnimation();
          const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          if (reducedMotion) {
            map.setPaintProperty(CONTOUR_LAYER, "line-opacity-transition", { duration: 0 });
            map.setPaintProperty(CONTOUR_LAYER, "line-opacity", finalContourOpacity);
            if (map.getLayer(BASEMAP_LAYER)) {
              map.setPaintProperty(BASEMAP_LAYER, "raster-opacity-transition", { duration: 0 });
              map.setPaintProperty(BASEMAP_LAYER, "raster-opacity", 0);
              setBasemapVisibility(false);
            }
            if (map.getLayer(HILLSHADE_LAYER)) {
              map.setPaintProperty(HILLSHADE_LAYER, "hillshade-exaggeration-transition", { duration: 0 });
              map.setPaintProperty(HILLSHADE_LAYER, "hillshade-exaggeration", HILLSHADE_EXAGGERATION);
            }
            return;
          }

          map.setPaintProperty(CONTOUR_LAYER, "line-opacity-transition", { duration: 0 });
          map.setPaintProperty(CONTOUR_LAYER, "line-opacity", 0);
          if (map.getLayer(BASEMAP_LAYER)) {
            setBasemapVisibility(true);
            map.setPaintProperty(BASEMAP_LAYER, "raster-opacity-transition", { duration: 0 });
            map.setPaintProperty(BASEMAP_LAYER, "raster-opacity", 1);
          }
          if (map.getLayer(HILLSHADE_LAYER)) {
            map.setPaintProperty(HILLSHADE_LAYER, "hillshade-exaggeration-transition", { duration: 0 });
            map.setPaintProperty(HILLSHADE_LAYER, "hillshade-exaggeration", 0);
          }
          contourAnimationFrame = window.requestAnimationFrame(() => {
            contourAnimationFrame = undefined;
            if (!map || disposed || displayModeRef.current !== "contour") return;
            map.setPaintProperty(CONTOUR_LAYER, "line-opacity-transition", {
              duration: 1_900,
              delay: 80,
            });
            map.setPaintProperty(CONTOUR_LAYER, "line-opacity", finalContourOpacity);
            if (map.getLayer(BASEMAP_LAYER)) {
              map.setPaintProperty(BASEMAP_LAYER, "raster-opacity-transition", {
                duration: 1_650,
                delay: 120,
              });
              map.setPaintProperty(BASEMAP_LAYER, "raster-opacity", 0);
            }
            if (map.getLayer(HILLSHADE_LAYER)) {
              map.setPaintProperty(HILLSHADE_LAYER, "hillshade-exaggeration-transition", {
                duration: 1_650,
                delay: 120,
              });
              map.setPaintProperty(
                HILLSHADE_LAYER,
                "hillshade-exaggeration",
                HILLSHADE_EXAGGERATION,
              );
            }
            container.classList.add("is-contour-revealing");
            contourAnimationTimeout = window.setTimeout(() => {
              contourAnimationTimeout = undefined;
              if (map && displayModeRef.current === "contour") {
                setBasemapVisibility(false);
                map.triggerRepaint();
              }
              container.classList.remove("is-contour-revealing");
            }, 2_100);
          });
        };

        const applyDisplayMode = (mode: TerrainDisplayMode, replayContour = false) => {
          if (!map || !map.getStyle()) return;
          const wantsContours = mode === "contour";
          const showContours = wantsContours && contoursReady && map.getLayer(CONTOUR_LAYER);
          if (wantsContours && drapeRefreshTimeout !== undefined) {
            window.clearTimeout(drapeRefreshTimeout);
            drapeRefreshTimeout = undefined;
          }
          if (!wantsContours) clearContourAnimation();
          if (map.getLayer(BASEMAP_LAYER)) {
            setBasemapVisibility(true);
            map.setPaintProperty(BASEMAP_LAYER, "raster-opacity-transition", { duration: 650 });
            map.setPaintProperty(BASEMAP_LAYER, "raster-opacity", showContours ? 0 : 1);
          }
          if (map.getLayer(HILLSHADE_LAYER)) {
            map.setPaintProperty(HILLSHADE_LAYER, "hillshade-exaggeration-transition", {
              duration: 650,
            });
            map.setPaintProperty(
              HILLSHADE_LAYER,
              "hillshade-exaggeration",
              showContours ? HILLSHADE_EXAGGERATION : 0,
            );
          }
          if (map.getLayer(CONTOUR_LAYER)) {
            map.setLayoutProperty(CONTOUR_LAYER, "visibility", wantsContours ? "visible" : "none");
            if (!wantsContours) {
              map.setPaintProperty(CONTOUR_LAYER, "line-opacity-transition", { duration: 0 });
              map.setPaintProperty(CONTOUR_LAYER, "line-opacity", finalContourOpacity);
            }
          }
          container.dataset.displayMode = wantsContours ? "contour" : "real";
          map.getCanvas().setAttribute(
            "aria-label",
            language === "zh"
              ? wantsContours
                ? "根据真实高程数据生成的三维等高线路线图。可拖动或使用左右方向键旋转。"
                : "真实三维地形路线图。可拖动或使用左右方向键旋转。"
              : wantsContours
                ? "Three-dimensional contour route map derived from real elevation data. Drag or use the left and right arrow keys to rotate."
                : "Real three-dimensional terrain route map. Drag or use the left and right arrow keys to rotate.",
          );
          if (showContours && replayContour) {
            animateContourReveal();
          } else if (showContours) {
            setBasemapVisibility(false);
          } else if (!wantsContours) {
            scheduleTerrainDrapeRefresh();
          }
        };
        applyDisplayModeRef.current = (mode) => applyDisplayMode(mode, mode === "contour");

        const markContoursReady = () => {
          if (!map || contoursReady || !map.getLayer(CONTOUR_LAYER)) return;
          contoursReady = true;
          container.dataset.contours = "ready";
          applyDisplayMode(displayModeRef.current, displayModeRef.current === "contour");
          if (!mapRevealed) revealMap();
        };

        const revealMap = () => {
          if (!map || disposed || mapRevealed || !introStarted) return;
          const basemapReady = Boolean(
            map.getSource(BASEMAP_SOURCE) && map.isSourceLoaded(BASEMAP_SOURCE),
          );
          if (!basemapReady && !(displayModeRef.current === "contour" && contoursReady)) return;
          mapRevealed = true;
          statusCallbackRef.current("ready");
        };

        const handleSourceData = (event: MapSourceDataEvent) => {
          if (event.sourceId === BASEMAP_SOURCE) revealMap();
          if (event.sourceId === CONTOUR_SOURCE) {
            container.dataset.contourEvent = event.sourceDataType ?? "unknown";
            if (event.sourceDataType === "content" || event.isSourceLoaded) {
              markContoursReady();
            }
          }
        };
        map.on("sourcedata", handleSourceData);
        cleanupListeners.push(() => map?.off("sourcedata", handleSourceData));

        const handleIdle = () => {
          if (map?.getSource(CONTOUR_SOURCE) && map.isSourceLoaded(CONTOUR_SOURCE)) {
            markContoursReady();
          }
          revealMap();
        };
        map.on("idle", handleIdle);
        cleanupListeners.push(() => map?.off("idle", handleIdle));

        const startPoint = timeline.segments[0].points[0];
        const lastSegment = timeline.segments.at(-1)!;
        const finishPoint = lastSegment.points.at(-1)!;
        const startLabel = language === "zh" ? "起点" : "START";
        const finishLabel = language === "zh" ? "终点" : "FINISH";
        markers.push(
          new maplibregl.Marker({ element: markerElement("start", startLabel), anchor: "center" })
            .setLngLat([startPoint.unwrappedLongitude, startPoint.latitude])
            .addTo(map),
          new maplibregl.Marker({ element: markerElement("finish", finishLabel), anchor: "center" })
            .setLngLat([finishPoint.unwrappedLongitude, finishPoint.latitude])
            .addTo(map),
        );

        const { highest, lowest } = extremaPoints(timeline);
        if (highest) {
          const label = language === "zh"
            ? `最高点 ${Math.round(highest.elevationM)} 米`
            : `HIGH ${Math.round(highest.elevationM)} m`;
          markers.push(
            new maplibregl.Marker({ element: markerElement("high", label), anchor: "bottom" })
              .setLngLat([highest.unwrappedLongitude, highest.latitude])
              .addTo(map),
          );
        }
        if (lowest) {
          const label = language === "zh"
            ? `最低点 ${Math.round(lowest.elevationM)} 米`
            : `LOW ${Math.round(lowest.elevationM)} m`;
          markers.push(
            new maplibregl.Marker({ element: markerElement("low", label), anchor: "top" })
              .setLngLat([lowest.unwrappedLongitude, lowest.latitude])
              .addTo(map),
          );
        }

        const beginIntro = () => {
          if (!map || disposed || introStarted) return;
          introStarted = true;
          installRouteLayer();
          const bounds = routeBounds(timeline);
          const compact = container.clientWidth < 720;
          map.fitBounds(
            [[bounds.west, bounds.south], [bounds.east, bounds.north]],
            {
              padding: compact
                ? { top: 92, right: 34, bottom: 104, left: 34 }
                : { top: 92, right: 110, bottom: 92, left: 110 },
              maxZoom: 14.5,
              pitch: 64,
              bearing: -24,
              duration: 0,
            },
          );
          scheduleTerrainLayers(180);
          map.once("idle", revealMap);

          const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          if (reducedMotion) {
            currentRouteData = routeFeatureAtProgress(timeline, 1);
            void (map.getSource(ROUTE_SOURCE) as GeoJSONSource | undefined)?.setData(currentRouteData);
            map.jumpTo({ pitch: 66, bearing: 8 });
            introComplete = true;
            container.classList.add("is-map-intro-complete");
            introCallbackRef.current();
            revealMap();
            return;
          }

          map.easeTo({
            bearing: 12,
            pitch: 68,
            duration: 3000,
            easing: (progress) => 1 - (1 - progress) ** 3,
          });
          const animationStart = performance.now();
          let lastRouteUpdate = 0;
          const animateRoute = (now: number) => {
            if (!map || disposed) return;
            const elapsed = now - animationStart;
            const progress = Math.min(elapsed / 2700, 1);
            if (now - lastRouteUpdate >= 50 || progress >= 1) {
              lastRouteUpdate = now;
              currentRouteData = routeFeatureAtProgress(timeline, 1 - (1 - progress) ** 3);
              void (map.getSource(ROUTE_SOURCE) as GeoJSONSource | undefined)?.setData(currentRouteData);
            }

            if (elapsed >= 2200) container.classList.add("is-map-intro-complete");
            if (elapsed >= 3000) {
              currentRouteData = routeFeatureAtProgress(timeline, 1);
              void (map.getSource(ROUTE_SOURCE) as GeoJSONSource | undefined)?.setData(currentRouteData);
              introComplete = true;
              introCallbackRef.current();
              revealMap();
              return;
            }
            animationFrame = window.requestAnimationFrame(animateRoute);
          };
          animationFrame = window.requestAnimationFrame(animateRoute);
        };

        const handleStyleReady = () => {
          if (!map || disposed) return;
          terrainInstalled = false;
          installRouteLayer();
          if (introStarted) {
            scheduleTerrainLayers(120);
            revealMap();
            return;
          }
          if (introScheduled) return;
          introScheduled = true;
          map.once("render", beginIntro);
          introTimeout = window.setTimeout(beginIntro, 160);
        };
        map.on("style.load", handleStyleReady);
        map.on("load", handleStyleReady);
        cleanupListeners.push(() => {
          map?.off("style.load", handleStyleReady);
          map?.off("load", handleStyleReady);
        });
        if (map.isStyleLoaded()) window.queueMicrotask(handleStyleReady);

        const handleThemeChange = (event: Event) => {
          if (!map) return;
          const theme = (event as CustomEvent<{ theme?: Track4TrekTheme }>).detail?.theme ?? mapTheme();
          activeTheme = theme;
          terrainInstalled = false;
          contoursReady = false;
          mapRevealed = false;
          clearContourAnimation();
          container.classList.remove("is-contour-revealing");
          container.dataset.contours = "loading";
          statusCallbackRef.current("loading");
          if (terrainTimeout !== undefined) window.clearTimeout(terrainTimeout);
          map.setStyle(fastMapStyle(theme));
        };
        window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);
        cleanupListeners.push(() => window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange));

        let dragging = false;
        let previousX = 0;
        const handlePointerDown = (event: PointerEvent) => {
          if (!map || !introComplete || event.pointerType === "touch" || event.button !== 0) return;
          dragging = true;
          previousX = event.clientX;
          container.setPointerCapture(event.pointerId);
          container.classList.add("is-map-rotating");
        };
        const handlePointerMove = (event: PointerEvent) => {
          if (!map || !dragging) return;
          const deltaX = event.clientX - previousX;
          previousX = event.clientX;
          map.setBearing(map.getBearing() + deltaX * 0.28);
        };
        const endRotation = (event: PointerEvent) => {
          if (!dragging) return;
          dragging = false;
          container.classList.remove("is-map-rotating");
          if (container.hasPointerCapture(event.pointerId)) container.releasePointerCapture(event.pointerId);
        };
        const handleKeyDown = (event: KeyboardEvent) => {
          if (!map || !introComplete || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
          event.preventDefault();
          map.easeTo({
            bearing: map.getBearing() + (event.key === "ArrowLeft" ? -8 : 8),
            duration: 180,
          });
        };
        container.addEventListener("pointerdown", handlePointerDown);
        container.addEventListener("pointermove", handlePointerMove);
        container.addEventListener("pointerup", endRotation);
        container.addEventListener("pointercancel", endRotation);
        container.addEventListener("keydown", handleKeyDown);
        cleanupListeners.push(() => {
          container.removeEventListener("pointerdown", handlePointerDown);
          container.removeEventListener("pointermove", handlePointerMove);
          container.removeEventListener("pointerup", endRotation);
          container.removeEventListener("pointercancel", endRotation);
          container.removeEventListener("keydown", handleKeyDown);
        });

        resizeObserver = new ResizeObserver(() => map?.resize());
        resizeObserver.observe(container);
        loadTimeout = window.setTimeout(() => {
          if (disposed || mapRevealed) return;
          console.error("[Track4Trek terrain] Basemap loading timed out before a complete frame was available.");
          statusCallbackRef.current("error", "timeout");
          introCallbackRef.current();
        }, 5000);
      } catch (error) {
        if (!disposed) {
          console.error("[Track4Trek terrain] Map initialization failed.", error);
          statusCallbackRef.current("error", "initialization");
          introCallbackRef.current();
        }
      }
    };

    void initialize();

    return () => {
      disposed = true;
      cleanupListeners.forEach((cleanup) => cleanup());
      resizeObserver?.disconnect();
      markers.forEach((marker) => marker.remove());
      if (animationFrame !== undefined) window.cancelAnimationFrame(animationFrame);
      if (contourAnimationFrame !== undefined) window.cancelAnimationFrame(contourAnimationFrame);
      if (contourAnimationTimeout !== undefined) window.clearTimeout(contourAnimationTimeout);
      if (drapeRefreshTimeout !== undefined) window.clearTimeout(drapeRefreshTimeout);
      if (loadTimeout !== undefined) window.clearTimeout(loadTimeout);
      if (introTimeout !== undefined) window.clearTimeout(introTimeout);
      if (terrainTimeout !== undefined) window.clearTimeout(terrainTimeout);
      applyDisplayModeRef.current = () => undefined;
      container.classList.remove("is-contour-revealing");
      map?.remove();
    };
  }, [language, segments]);

  return (
    <div
      className="trail-real-map"
      ref={containerRef}
      data-map-engine="MapLibre GL JS"
      data-basemap-source="OpenStreetMap"
      data-terrain-source="Mapterhorn"
      data-contour-source="Mapterhorn DEM"
      data-contours="idle"
    />
  );
}
