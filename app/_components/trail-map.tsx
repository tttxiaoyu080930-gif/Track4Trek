"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  readRoutePreview,
  type PreviewGeographicPoint,
  type PreviewMapPoint,
  type RoutePreview,
} from "../_lib/route-data";
import { useLanguage, type Track4TrekLanguage } from "./language-system";
import {
  MapLibreTerrainMap,
  type TerrainDisplayMode,
  type TerrainMapStatus,
} from "./maplibre-terrain-map";

type TerrainPoint = { x: number; y: number; z: number };
type ScreenPoint = { x: number; y: number };
type ContourSegment = { a: TerrainPoint; b: TerrainPoint; level: number };
type ContourPalette = {
  name: string;
  low: readonly [number, number, number];
  high: readonly [number, number, number];
  outline: readonly [number, number, number];
};
type VisualRoutePoint = { x: number; y: number; elevation: number | null };
type RouteFact = { label: string; value: string; unit: string };

const FIXED_CONTOUR_PALETTE: ContourPalette = {
  name: "Glacier slate",
  low: [44, 112, 139],
  high: [178, 226, 229],
  outline: [7, 24, 34],
};

const HIGHEST_ALTITUDE_METERS = 934;
const LOWEST_ALTITUDE_METERS = 340;
const terrainPeak: TerrainPoint = { x: -0.034, y: -0.095, z: 1.03 };

const fallbackRoutePath: VisualRoutePoint[] = [
  { x: -0.88, y: 0.62, elevation: 340 },
  { x: -0.72, y: 0.48, elevation: 420 },
  { x: -0.57, y: 0.31, elevation: 520 },
  { x: -0.45, y: 0.14, elevation: 620 },
  { x: -0.29, y: 0.04, elevation: 710 },
  { x: -0.12, y: -0.12, elevation: 934 },
  { x: 0.03, y: -0.27, elevation: 820 },
  { x: 0.2, y: -0.31, elevation: 710 },
  { x: 0.36, y: -0.43, elevation: 590 },
  { x: 0.53, y: -0.55, elevation: 470 },
  { x: 0.73, y: -0.68, elevation: 360 },
];

const fallbackGeographicSegments: PreviewGeographicPoint[][] = [[
  { latitude: 22.2522, longitude: 113.8829, elevationM: 340 },
  { latitude: 22.2551, longitude: 113.8876, elevationM: 420 },
  { latitude: 22.2593, longitude: 113.8924, elevationM: 575 },
  { latitude: 22.264, longitude: 113.8996, elevationM: 760 },
  { latitude: 22.2671, longitude: 113.9051, elevationM: 934 },
  { latitude: 22.2705, longitude: 113.9113, elevationM: 820 },
  { latitude: 22.2742, longitude: 113.9182, elevationM: 650 },
  { latitude: 22.2784, longitude: 113.9256, elevationM: 480 },
  { latitude: 22.2821, longitude: 113.9324, elevationM: 360 },
]];

function formatDistance(value: number) {
  return value >= 10 ? value.toFixed(0) : value.toFixed(1);
}

function formatPace(minutesPerKm: number | null) {
  if (minutesPerKm == null) return null;
  const minutes = Math.floor(minutesPerKm);
  const seconds = Math.round((minutesPerKm - minutes) * 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function factLabel(language: Track4TrekLanguage, english: string, chinese: string) {
  return language === "zh" ? chinese : english;
}

function fallbackRouteFacts(language: Track4TrekLanguage): RouteFact[] {
  return [
    { label: factLabel(language, "Total distance", "总距离"), value: "4.7", unit: "km" },
    {
      label: factLabel(language, "Elevation range", "海拔范围"),
      value: `${LOWEST_ALTITUDE_METERS}-${HIGHEST_ALTITUDE_METERS}`,
      unit: "m",
    },
    { label: factLabel(language, "Total ascent", "累计爬升"), value: "+690", unit: "m" },
    { label: factLabel(language, "Total descent", "累计下降"), value: "-640", unit: "m" },
    {
      label: factLabel(language, "Highest elevation", "最高海拔"),
      value: String(HIGHEST_ALTITUDE_METERS),
      unit: "m",
    },
  ];
}

function routeFactsFromPreview(
  preview: RoutePreview | null,
  language: Track4TrekLanguage,
): RouteFact[] {
  if (!preview) return fallbackRouteFacts(language);

  const stats = preview.stats;
  const unknown = language === "zh" ? "未知" : "unknown";
  return [
    {
      label: factLabel(language, "Total distance", "总距离"),
      value: formatDistance(stats.totalDistanceKm),
      unit: "km",
    },
    {
      label: factLabel(language, "Elevation range", "海拔范围"),
      value:
        stats.lowestElevationM == null || stats.highestElevationM == null
          ? unknown
          : `${stats.lowestElevationM}-${stats.highestElevationM}`,
      unit: stats.lowestElevationM == null || stats.highestElevationM == null ? "" : "m",
    },
    {
      label: factLabel(language, "Total ascent", "累计爬升"),
      value: stats.totalAscentM == null ? unknown : `+${stats.totalAscentM}`,
      unit: stats.totalAscentM == null ? "" : "m",
    },
    {
      label: factLabel(language, "Total descent", "累计下降"),
      value: stats.totalDescentM == null ? unknown : `-${stats.totalDescentM}`,
      unit: stats.totalDescentM == null ? "" : "m",
    },
    {
      label: factLabel(language, "Highest elevation", "最高海拔"),
      value: stats.highestElevationM == null ? unknown : String(stats.highestElevationM),
      unit: stats.highestElevationM == null ? "" : "m",
    },
    {
      label: factLabel(language, "Required pace", "所需配速"),
      value: formatPace(stats.requiredPaceMinPerKm) ?? unknown,
      unit: stats.requiredPaceMinPerKm == null ? "" : "/km",
    },
  ];
}

function mapPathFromPreview(path: PreviewMapPoint[] | undefined): VisualRoutePoint[] {
  return path != null && path.length >= 2 ? path : fallbackRoutePath;
}

function geographicSegmentsFromPreview(
  preview: RoutePreview | null,
  previewLoaded: boolean,
) {
  if (!previewLoaded) return [];
  const segments = preview?.geographicSegments?.filter((segment) => segment.length >= 2) ?? [];
  if (segments.length) return segments;
  if (!preview || preview.source.kind === "sample") return fallbackGeographicSegments;
  return [];
}

function elevationPoint(points: VisualRoutePoint[], mode: "highest" | "lowest") {
  const withElevation = points.filter((point) => point.elevation != null);
  if (withElevation.length === 0) return null;

  return withElevation.reduce((selected, point) => {
    if (mode === "highest") return point.elevation! > selected.elevation! ? point : selected;
    return point.elevation! < selected.elevation! ? point : selected;
  }, withElevation[0]);
}

function terrainHeight(x: number, y: number) {
  const peak = 0.72 * Math.exp(-((x + 0.08) ** 2 * 4.6 + (y + 0.08) ** 2 * 7.4));
  const westRidge = 0.43 * Math.exp(-((x + 0.67) ** 2 * 7.8 + (y - 0.05) ** 2 * 9.2));
  const eastRidge = 0.5 * Math.exp(-((x - 0.58) ** 2 * 6.1 + (y + 0.3) ** 2 * 8.6));
  const saddle = 0.22 * Math.exp(-((y + 0.16 * Math.sin((x + 0.2) * 4)) ** 2 * 17 + x ** 2 * 0.72));
  const texture = 0.025 * Math.sin(x * 12 + y * 4) * Math.cos(y * 10 - x * 3);
  return Math.min(Math.max(0.045 + peak + westRidge + eastRidge + saddle + texture, 0.035), 1);
}

function interpolateContour(
  a: { x: number; y: number; value: number },
  b: { x: number; y: number; value: number },
  level: number,
): TerrainPoint {
  const difference = b.value - a.value;
  const progress = Math.abs(difference) < 0.00001 ? 0.5 : (level - a.value) / difference;
  return {
    x: a.x + (b.x - a.x) * progress,
    y: a.y + (b.y - a.y) * progress,
    z: level,
  };
}

function buildContourSegments() {
  const segments: ContourSegment[] = [];
  const gridSize = 52;
  const terrainMin = -1.12;
  const terrainMax = 1.12;
  const contourLevels = Array.from({ length: 17 }, (_, index) => 0.1 + index * 0.05);

  for (const level of contourLevels) {
    for (let row = 0; row < gridSize; row += 1) {
      const y0 = terrainMin + (row / gridSize) * (terrainMax - terrainMin);
      const y1 = terrainMin + ((row + 1) / gridSize) * (terrainMax - terrainMin);

      for (let column = 0; column < gridSize; column += 1) {
        const x0 = terrainMin + (column / gridSize) * (terrainMax - terrainMin);
        const x1 = terrainMin + ((column + 1) / gridSize) * (terrainMax - terrainMin);
        const corners = [
          { x: x0, y: y0, value: terrainHeight(x0, y0) },
          { x: x1, y: y0, value: terrainHeight(x1, y0) },
          { x: x1, y: y1, value: terrainHeight(x1, y1) },
          { x: x0, y: y1, value: terrainHeight(x0, y1) },
        ];
        const edgePairs = [[0, 1], [1, 2], [2, 3], [3, 0]] as const;
        const intersections: TerrainPoint[] = [];

        for (const [startIndex, endIndex] of edgePairs) {
          const start = corners[startIndex];
          const end = corners[endIndex];
          if ((start.value < level) !== (end.value < level)) {
            intersections.push(interpolateContour(start, end, level));
          }
        }

        if (intersections.length === 2) {
          segments.push({ a: intersections[0], b: intersections[1], level });
        } else if (intersections.length === 4) {
          segments.push(
            { a: intersections[0], b: intersections[1], level },
            { a: intersections[2], b: intersections[3], level },
          );
        }
      }
    }
  }

  return segments;
}

const contourSegments = buildContourSegments();

function project(point: TerrainPoint, yaw: number, width: number, height: number): ScreenPoint {
  const cosine = Math.cos(yaw);
  const sine = Math.sin(yaw);
  const rotatedX = point.x * cosine - point.y * sine;
  const rotatedY = point.x * sine + point.y * cosine;
  const perspective = 1 / Math.max(0.7, 1 - rotatedY * 0.17);
  const scale = Math.min(width * 0.41, height * 0.72);

  return {
    x: width * 0.5 + rotatedX * scale * perspective,
    y: height * 0.7 + (rotatedY * 0.39 - point.z * 0.82) * scale * perspective,
  };
}

function pointAlongPath(points: ScreenPoint[], progress: number) {
  const boundedProgress = Math.min(Math.max(progress, 0), 1);
  const scaledProgress = boundedProgress * (points.length - 1);
  const segmentIndex = Math.min(Math.floor(scaledProgress), points.length - 2);
  const segmentProgress = scaledProgress - segmentIndex;
  const segmentStart = points[segmentIndex];
  const segmentEnd = points[segmentIndex + 1];

  return {
    point: {
      x: segmentStart.x + (segmentEnd.x - segmentStart.x) * segmentProgress,
      y: segmentStart.y + (segmentEnd.y - segmentStart.y) * segmentProgress,
    },
    segmentIndex,
    segmentProgress,
  };
}

function traceRoute(
  context: CanvasRenderingContext2D,
  points: ScreenPoint[],
  segmentIndex: number,
  segmentProgress: number,
) {
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (let index = 1; index <= segmentIndex; index += 1) {
    context.lineTo(points[index].x, points[index].y);
  }
  const segmentStart = points[segmentIndex];
  const segmentEnd = points[segmentIndex + 1];
  context.lineTo(
    segmentStart.x + (segmentEnd.x - segmentStart.x) * segmentProgress,
    segmentStart.y + (segmentEnd.y - segmentStart.y) * segmentProgress,
  );
}

function drawMarker(
  context: CanvasRenderingContext2D,
  point: ScreenPoint,
  label: string,
  color: string,
  align: "left" | "right",
) {
  context.save();
  context.shadowBlur = 18;
  context.shadowColor = color;
  context.fillStyle = color;
  context.beginPath();
  context.arc(point.x, point.y, 6, 0, Math.PI * 2);
  context.fill();
  context.shadowBlur = 0;
  context.lineWidth = 2;
  context.strokeStyle = "rgba(246, 252, 255, 0.92)";
  context.stroke();
  context.fillStyle = "rgba(236, 247, 255, 0.86)";
  context.font = "600 9px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.textAlign = align;
  context.fillText(label, point.x + (align === "left" ? 13 : -13), point.y - 10);
  context.restore();
}

function drawElevationMarker(
  context: CanvasRenderingContext2D,
  point: ScreenPoint,
  visibility: number,
  altitude: number,
  placement: "above" | "below-left",
  unitLabel: string,
) {
  if (visibility <= 0) return;

  const isAbove = placement === "above";
  const labelX = point.x + (isAbove ? 0 : -9);
  const labelY = point.y + (isAbove ? -13 - visibility * 5 : 13 + visibility * 5);
  context.save();
  context.globalAlpha = visibility;
  context.fillStyle = isAbove
    ? "rgba(247, 252, 255, 0.98)"
    : "rgba(154, 235, 255, 0.98)";
  context.strokeStyle = "rgba(2, 14, 29, 0.78)";
  context.lineWidth = 2;
  if (isAbove) {
    context.beginPath();
    context.arc(point.x, point.y, 3.2, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }

  context.font = "600 12px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.textAlign = isAbove ? "center" : "right";
  context.textBaseline = isAbove ? "bottom" : "top";
  context.lineJoin = "round";
  context.lineWidth = 3.5;
  context.strokeText(`${altitude} ${unitLabel}`, labelX, labelY);
  context.fillText(`${altitude} ${unitLabel}`, labelX, labelY);
  context.restore();
}

function drawTerrain(
  canvas: HTMLCanvasElement,
  routeProgress: number,
  elevationVisibility: number,
  yaw: number,
  palette: ContourPalette,
  routePath: VisualRoutePoint[],
  routePreview: RoutePreview | null,
  language: Track4TrekLanguage,
) {
  canvas.dataset.rotation = yaw.toFixed(3);
  canvas.dataset.contourPalette = palette.name;
  canvas.dataset.elevationVisibility = elevationVisibility.toFixed(3);
  const bounds = canvas.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;

  const density = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.round(bounds.width * density);
  const pixelHeight = Math.round(bounds.height * density);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  const context = canvas.getContext("2d");
  if (!context) return;
  const width = bounds.width;
  const height = bounds.height;
  context.setTransform(density, 0, 0, density, 0, 0);
  context.clearRect(0, 0, width, height);

  context.save();
  context.strokeStyle = `rgba(${palette.low[0]}, ${palette.low[1]}, ${palette.low[2]}, 0.12)`;
  context.lineWidth = 1;
  for (let gridLine = -1.5; gridLine <= 1.5; gridLine += 0.18) {
    const horizontalStart = project({ x: -1.55, y: gridLine, z: 0 }, yaw, width, height);
    const horizontalEnd = project({ x: 1.55, y: gridLine, z: 0 }, yaw, width, height);
    context.beginPath();
    context.moveTo(horizontalStart.x, horizontalStart.y);
    context.lineTo(horizontalEnd.x, horizontalEnd.y);
    context.stroke();

    const verticalStart = project({ x: gridLine, y: -1.55, z: 0 }, yaw, width, height);
    const verticalEnd = project({ x: gridLine, y: 1.55, z: 0 }, yaw, width, height);
    context.beginPath();
    context.moveTo(verticalStart.x, verticalStart.y);
    context.lineTo(verticalEnd.x, verticalEnd.y);
    context.stroke();
  }
  context.restore();

  for (let levelIndex = 0; levelIndex < 17; levelIndex += 1) {
    const level = 0.1 + levelIndex * 0.05;
    context.beginPath();
    for (const segment of contourSegments) {
      if (Math.abs(segment.level - level) > 0.001) continue;
      const start = project(segment.a, yaw, width, height);
      const end = project(segment.b, yaw, width, height);
      context.moveTo(start.x, start.y);
      context.lineTo(end.x, end.y);
    }
    const colorProgress = levelIndex / 16;
    const red = Math.round(palette.low[0] + (palette.high[0] - palette.low[0]) * colorProgress);
    const green = Math.round(palette.low[1] + (palette.high[1] - palette.low[1]) * colorProgress);
    const blue = Math.round(palette.low[2] + (palette.high[2] - palette.low[2]) * colorProgress);
    context.strokeStyle = `rgba(${palette.outline[0]}, ${palette.outline[1]}, ${palette.outline[2]}, 0.54)`;
    context.lineWidth = 3.2 + level * 1.25;
    context.stroke();
    context.strokeStyle = `rgba(${red}, ${green}, ${blue}, ${0.34 + levelIndex * 0.018})`;
    context.lineWidth = 1 + level * 1.15;
    context.stroke();
  }

  const projectedRoute = routePath.map((point) => project({
    x: point.x,
    y: point.y,
    z: terrainHeight(point.x, point.y) + 0.045,
  }, yaw, width, height));
  const activeRoute = pointAlongPath(projectedRoute, routeProgress);

  context.save();
  traceRoute(context, projectedRoute, activeRoute.segmentIndex, activeRoute.segmentProgress);
  context.strokeStyle = "#f0a35a";
  context.lineWidth = 4.25;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.shadowBlur = 0;
  context.stroke();
  context.restore();

  drawMarker(
    context,
    projectedRoute[0],
    language === "zh" ? "起点" : "START",
    "#61dcff",
    "left",
  );
  drawMarker(
    context,
    projectedRoute.at(-1)!,
    language === "zh" ? "终点" : "FINISH",
    "#ff874d",
    "right",
  );
  const highestAltitude = routePreview
    ? routePreview.stats.highestElevationM
    : HIGHEST_ALTITUDE_METERS;
  const lowestAltitude = routePreview
    ? routePreview.stats.lowestElevationM
    : LOWEST_ALTITUDE_METERS;
  const highestRoutePoint = elevationPoint(routePath, "highest");
  const lowestRoutePoint = elevationPoint(routePath, "lowest");

  if (highestAltitude != null) {
    drawElevationMarker(
      context,
      highestRoutePoint
        ? project({
            x: highestRoutePoint.x,
            y: highestRoutePoint.y,
            z: terrainHeight(highestRoutePoint.x, highestRoutePoint.y) + 0.06,
          }, yaw, width, height)
        : project(terrainPeak, yaw, width, height),
      elevationVisibility,
      highestAltitude,
      "above",
      language === "zh" ? "米" : "m",
    );
  }
  if (lowestAltitude != null) {
    drawElevationMarker(
      context,
      lowestRoutePoint
        ? project({
            x: lowestRoutePoint.x,
            y: lowestRoutePoint.y,
            z: terrainHeight(lowestRoutePoint.x, lowestRoutePoint.y) + 0.045,
          }, yaw, width, height)
        : projectedRoute[0],
      elevationVisibility,
      lowestAltitude,
      "below-left",
      language === "zh" ? "米" : "m",
    );
  }

}

export function TrailMap() {
  const { language, text } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const languageRef = useRef(language);
  const redrawTerrainRef = useRef<(() => void) | null>(null);
  const visualStateRef = useRef({ routeProgress: 0, elevationVisibility: 0, yaw: -0.48 });
  const activePaletteRef = useRef<ContourPalette>(FIXED_CONTOUR_PALETTE);
  const [presentationStage, setPresentationStage] = useState<"intro" | "detail">("intro");
  const [routePreview, setRoutePreview] = useState<RoutePreview | null>(null);
  const [routePreviewLoaded, setRoutePreviewLoaded] = useState(false);
  const [realMapStatus, setRealMapStatus] = useState<TerrainMapStatus>("idle");
  const [displayMode, setDisplayMode] = useState<TerrainDisplayMode>("contour");
  const [mapAttempt, setMapAttempt] = useState(0);
  const routePath = useMemo(
    () => mapPathFromPreview(routePreview?.mapPath),
    [routePreview],
  );
  const geographicSegments = useMemo(
    () => geographicSegmentsFromPreview(routePreview, routePreviewLoaded),
    [routePreview, routePreviewLoaded],
  );
  const hasRealMapData = geographicSegments.length > 0;
  const routeFacts = routeFactsFromPreview(routePreview, language);
  const highestAltitude = routePreview
    ? routePreview.stats.highestElevationM
    : HIGHEST_ALTITUDE_METERS;
  const lowestAltitude = routePreview
    ? routePreview.stats.lowestElevationM
    : LOWEST_ALTITUDE_METERS;
  const elevationSummary = highestAltitude == null || lowestAltitude == null
    ? text(
        "This GPX file does not include usable elevation data.",
        "此 GPX 文件未包含可用的海拔数据。",
      )
    : text(
        `Highest altitude: ${highestAltitude} meters. Lowest altitude: ${lowestAltitude} meters.`,
        `最高海拔：${highestAltitude} 米。最低海拔：${lowestAltitude} 米。`,
      );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setRoutePreview(readRoutePreview());
      setRoutePreviewLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleRealMapStatus = useCallback((status: TerrainMapStatus) => {
    setRealMapStatus(status);
    if (status === "error") setPresentationStage("detail");
  }, []);

  const handleRealMapIntroComplete = useCallback(() => {
    setPresentationStage("detail");
  }, []);

  useEffect(() => {
    languageRef.current = language;
    redrawTerrainRef.current?.();
  }, [language]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    let animationFrame: number | undefined;
    let detailShown = false;
    let dragMode: "pointer" | "mouse" | null = null;
    let previousPointerX = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const animateFallback = !hasRealMapData;
    const animationStart = performance.now();
    const visualState = visualStateRef.current;
    activePaletteRef.current = FIXED_CONTOUR_PALETTE;
    visualState.routeProgress = reducedMotion || !animateFallback ? 1 : 0;
    visualState.elevationVisibility = animateFallback && reducedMotion ? 1 : 0;
    visualState.yaw = reducedMotion || !animateFallback ? 0.28 : -0.48;
    const drawCurrentTerrain = () => {
      drawTerrain(
        canvas,
        visualState.routeProgress,
        visualState.elevationVisibility,
        visualState.yaw,
        activePaletteRef.current,
        routePath,
        routePreview,
        languageRef.current,
      );
    };
    redrawTerrainRef.current = drawCurrentTerrain;

    const resizeObserver = new ResizeObserver(() => {
      drawCurrentTerrain();
    });
    resizeObserver.observe(canvas);

    const handlePointerDown = (event: PointerEvent) => {
      if (!detailShown) return;
      dragMode = "pointer";
      previousPointerX = event.clientX;
      visualState.elevationVisibility = 0;
      canvas.setPointerCapture(event.pointerId);
      canvas.classList.add("is-rotating");
      drawCurrentTerrain();
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (dragMode !== "pointer" || event.buttons !== 1) return;
      const deltaX = event.clientX - previousPointerX;
      previousPointerX = event.clientX;
      visualState.yaw += deltaX * 0.008;
      drawCurrentTerrain();
    };

    const endPointerRotation = (event: PointerEvent) => {
      if (dragMode !== "pointer") return;
      dragMode = null;
      canvas.classList.remove("is-rotating");
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (!detailShown || dragMode !== null) return;
      dragMode = "mouse";
      previousPointerX = event.clientX;
      visualState.elevationVisibility = 0;
      canvas.classList.add("is-rotating");
      drawCurrentTerrain();
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (dragMode !== "mouse" || event.buttons !== 1) return;
      const deltaX = event.clientX - previousPointerX;
      previousPointerX = event.clientX;
      visualState.yaw += deltaX * 0.008;
      drawCurrentTerrain();
    };

    const endMouseRotation = () => {
      if (dragMode !== "mouse") return;
      dragMode = null;
      canvas.classList.remove("is-rotating");
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!detailShown || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
      event.preventDefault();
      visualState.elevationVisibility = 0;
      visualState.yaw += event.key === "ArrowLeft" ? -0.1 : 0.1;
      drawCurrentTerrain();
    };

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", endPointerRotation);
    canvas.addEventListener("pointercancel", endPointerRotation);
    canvas.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", endMouseRotation);
    canvas.addEventListener("keydown", handleKeyDown);

    if (!animateFallback) {
      detailShown = true;
      animationFrame = window.requestAnimationFrame(() => {
        if (!disposed) drawCurrentTerrain();
      });
    } else if (reducedMotion) {
      detailShown = true;
      animationFrame = window.requestAnimationFrame(() => {
        if (disposed) return;
        if (!hasRealMapData) setPresentationStage("detail");
        drawCurrentTerrain();
      });
    } else {
      const animate = (now: number) => {
        if (disposed) return;
        const elapsed = now - animationStart;
        const routeProgress = Math.min(elapsed / 2700, 1);
        const cameraProgress = Math.min(elapsed / 3000, 1);
        const peakEntrance = Math.min(Math.max((elapsed - 300) / 650, 0), 1);
        const peakExit = Math.min(Math.max((elapsed - 2050) / 650, 0), 1);
        const easedCameraProgress = 1 - Math.pow(1 - cameraProgress, 3);
        visualState.routeProgress = 1 - Math.pow(1 - routeProgress, 3);
        const easedPeakEntrance = peakEntrance * peakEntrance * (3 - 2 * peakEntrance);
        const easedPeakExit = peakExit * peakExit * (3 - 2 * peakExit);
        visualState.elevationVisibility = easedPeakEntrance * (1 - easedPeakExit);
        visualState.yaw = -0.48 + easedCameraProgress * 0.78;
        drawCurrentTerrain();

        if (elapsed >= 3000 && !detailShown) {
          detailShown = true;
          if (!hasRealMapData) setPresentationStage("detail");
        }

        if (elapsed < 3000) animationFrame = window.requestAnimationFrame(animate);
      };
      animationFrame = window.requestAnimationFrame(animate);
    }

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", endPointerRotation);
      canvas.removeEventListener("pointercancel", endPointerRotation);
      canvas.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", endMouseRotation);
      canvas.removeEventListener("keydown", handleKeyDown);
      if (redrawTerrainRef.current === drawCurrentTerrain) redrawTerrainRef.current = null;
      if (animationFrame !== undefined) window.cancelAnimationFrame(animationFrame);
    };
  }, [hasRealMapData, routePath, routePreview]);

  return (
    <section
      className={`trail-map-shell is-${presentationStage}-stage is-real-map-${realMapStatus}`}
      id="terrain-result"
      aria-labelledby="trail-map-title"
    >
      <h1 className="visually-hidden" id="trail-map-title">
        {text("Three-dimensional trail map", "三维路线地图")}
      </h1>
      <p className="visually-hidden">
        {text(
          "A real geographic three-dimensional terrain map with contours generated from Mapterhorn elevation data, an animated route, start and finish markers, and route statistics. A local contour model remains available only if online terrain fails.",
          "真实地理位置的三维地形地图，等高线由 Mapterhorn 高程数据生成，并包含路线动画、起终点标记和路线统计；仅在在线地形加载失败时显示本地等高线备用模型。",
        )}
      </p>
      <p className="visually-hidden" id="terrain-rotation-help">
        {text(
          "After the opening animation, drag horizontally or use the left and right arrow keys to rotate the terrain.",
          "开场动画结束后，可水平拖动，或使用左右方向键旋转地形。",
        )}
      </p>
      <p className="visually-hidden" id="terrain-contrast-help">
        {text(
          "Map rendering uses MapLibre GL JS, an OpenStreetMap basemap, and Mapterhorn terrain tiles.",
          "地图使用 MapLibre GL JS、OpenStreetMap 底图和 Mapterhorn 地形瓦片进行渲染。",
        )}
      </p>
      <p className="visually-hidden" id="terrain-elevation-help">
        {elevationSummary}
      </p>

      <div className="trail-map-stage">
        <MapLibreTerrainMap
          key={mapAttempt}
          segments={geographicSegments}
          language={language}
          displayMode={displayMode}
          onStatusChange={handleRealMapStatus}
          onIntroComplete={handleRealMapIntroComplete}
        />
        <canvas
          className="trail-map-canvas trail-contour-canvas"
          ref={canvasRef}
          role="application"
          aria-roledescription={text("interactive terrain map", "交互式地形地图")}
          tabIndex={realMapStatus === "ready" ? -1 : 0}
          aria-hidden={realMapStatus === "ready"}
          data-contour-contrast="fixed"
          data-highest-altitude={highestAltitude ?? undefined}
          data-lowest-altitude={lowestAltitude ?? undefined}
          aria-label={text(
            "Fallback rotatable contour terrain with a route from start to finish",
            "可旋转的备用等高线地形，以路线连接起点与终点",
          )}
          aria-describedby="terrain-rotation-help terrain-contrast-help terrain-elevation-help"
        >
          {text(
            "A local contour terrain fallback with a highlighted trail.",
            "突出显示路线的本地等高线备用模型。",
          )}
        </canvas>
        <p className="visually-hidden" aria-live="polite">
          {realMapStatus === "loading"
            ? text("Loading real terrain map.", "正在加载真实地形地图。")
            : realMapStatus === "ready"
              ? text("Real terrain map ready.", "真实地形地图已就绪。")
              : realMapStatus === "error"
                ? text(
                    "Online terrain is unavailable; showing the local contour fallback.",
                    "在线地形暂不可用；正在显示本地等高线备用模型。",
                  )
                : ""}
        </p>
        <div
          className="terrain-display-switch"
          role="group"
          aria-label={text("Terrain display", "地形显示")}
          data-terrain-mode-control
        >
          <button
            type="button"
            aria-pressed={displayMode === "contour"}
            disabled={!hasRealMapData || realMapStatus === "error"}
            onClick={() => setDisplayMode("contour")}
          >
            {text("Contour render", "等高线渲染")}
          </button>
          <button
            type="button"
            aria-pressed={displayMode === "real"}
            disabled={!hasRealMapData || realMapStatus === "error"}
            onClick={() => setDisplayMode("real")}
          >
            {text("Real map", "真实地图")}
          </button>
        </div>
      </div>

      {routePreviewLoaded && routePreview?.version === 1 && !hasRealMapData ? (
        <div className="trail-map-fallback-notice" role="status">
          <span>
            {text(
              "This saved route predates real terrain support.",
              "此已保存路线早于真实地形功能。",
            )}
          </span>
          <Link href="/#route-input">
            {text("Re-upload GPX", "重新上传 GPX")}
          </Link>
        </div>
      ) : null}

      {routePreviewLoaded && hasRealMapData && realMapStatus === "error" ? (
        <div className="trail-map-fallback-notice" role="status">
          <span>
            {text(
              "Online terrain could not load, so the local contour fallback is shown.",
              "在线地形无法加载，因此正在显示本地等高线备用模型。",
            )}
          </span>
          <button
            type="button"
            onClick={() => {
              setRealMapStatus("loading");
              setPresentationStage("intro");
              setMapAttempt((attempt) => attempt + 1);
            }}
          >
            {text("Retry terrain", "重试地形")}
          </button>
        </div>
      ) : null}

      <aside
        className="trail-route-facts"
        aria-label={text("Route summary", "路线概览")}
      >
        <dl>
          {routeFacts.map((fact) => (
            <div key={`${fact.value}-${fact.unit}`}>
              <dt>{fact.label}</dt>
              <dd><strong>{fact.value}</strong><span>{fact.unit}</span></dd>
            </div>
          ))}
        </dl>
        <p>{routePreview ? routePreview.fileName : text("Prototype values", "原型示例数据")}</p>
      </aside>

      <a
        className="map-scroll-cue"
        href="#metrics"
        aria-label={text("Scroll to recommended metric ranges", "滚动至建议指标范围")}
      >
        <span />
      </a>
    </section>
  );
}
