"use client";

import { useEffect, useRef, useState } from "react";

type TerrainPoint = { x: number; y: number; z: number };
type ScreenPoint = { x: number; y: number };
type ContourSegment = { a: TerrainPoint; b: TerrainPoint; level: number };
type ContourPalette = {
  name: string;
  low: readonly [number, number, number];
  high: readonly [number, number, number];
  outline: readonly [number, number, number];
};

const contourPalettes = {
  Lime: { name: "Lime", low: [96, 180, 72], high: [226, 255, 123], outline: [2, 18, 31] },
  Ice: { name: "Ice", low: [62, 175, 224], high: [197, 247, 255], outline: [2, 17, 32] },
  Amber: { name: "Amber", low: [232, 126, 43], high: [255, 238, 104], outline: [25, 12, 2] },
  Magenta: { name: "Magenta", low: [226, 59, 168], high: [255, 190, 239], outline: [24, 4, 29] },
  Ink: { name: "Ink", low: [4, 24, 52], high: [8, 83, 140], outline: [245, 252, 255] },
} as const satisfies Record<string, ContourPalette>;

const LANDSCAPE_CHANGE_EVENT = "track4trek:landscape-change";
const HIGHEST_ALTITUDE_METERS = 934;
const LOWEST_ALTITUDE_METERS = 340;
const terrainPeak: TerrainPoint = { x: -0.034, y: -0.095, z: 1.03 };

function resolveContourPalette(name: unknown): ContourPalette {
  if (typeof name === "string" && name in contourPalettes) {
    return contourPalettes[name as keyof typeof contourPalettes];
  }
  return contourPalettes.Lime;
}

function blendColor(
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  progress: number,
): [number, number, number] {
  return [
    Math.round(from[0] + (to[0] - from[0]) * progress),
    Math.round(from[1] + (to[1] - from[1]) * progress),
    Math.round(from[2] + (to[2] - from[2]) * progress),
  ];
}

function blendContourPalette(
  from: ContourPalette,
  to: ContourPalette,
  progress: number,
): ContourPalette {
  return {
    name: to.name,
    low: blendColor(from.low, to.low, progress),
    high: blendColor(from.high, to.high, progress),
    outline: blendColor(from.outline, to.outline, progress),
  };
}

const routeFacts = [
  { label: "Total distance", value: "4.7", unit: "km" },
  {
    label: "Elevation range",
    value: `${LOWEST_ALTITUDE_METERS}–${HIGHEST_ALTITUDE_METERS}`,
    unit: "m",
  },
  { label: "Total ascent", value: "+690", unit: "m" },
  { label: "Total descent", value: "−640", unit: "m" },
  { label: "Highest elevation", value: String(HIGHEST_ALTITUDE_METERS), unit: "m" },
] as const;

const routePath = [
  { x: -0.88, y: 0.62 },
  { x: -0.72, y: 0.48 },
  { x: -0.57, y: 0.31 },
  { x: -0.45, y: 0.14 },
  { x: -0.29, y: 0.04 },
  { x: -0.12, y: -0.12 },
  { x: 0.03, y: -0.27 },
  { x: 0.2, y: -0.31 },
  { x: 0.36, y: -0.43 },
  { x: 0.53, y: -0.55 },
  { x: 0.73, y: -0.68 },
] as const;

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
  context.strokeText(`${altitude} m`, labelX, labelY);
  context.fillText(`${altitude} m`, labelX, labelY);
  context.restore();
}

function drawTerrain(
  canvas: HTMLCanvasElement,
  routeProgress: number,
  elevationVisibility: number,
  yaw: number,
  palette: ContourPalette,
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
  context.beginPath();
  context.moveTo(projectedRoute[0].x, projectedRoute[0].y);
  for (let index = 1; index < projectedRoute.length; index += 1) {
    context.lineTo(projectedRoute[index].x, projectedRoute[index].y);
  }
  context.setLineDash([4, 8]);
  context.strokeStyle = "rgba(210, 235, 247, 0.19)";
  context.lineWidth = 2;
  context.stroke();
  context.setLineDash([]);

  const routeGradient = context.createLinearGradient(
    projectedRoute[0].x,
    projectedRoute[0].y,
    projectedRoute.at(-1)!.x,
    projectedRoute.at(-1)!.y,
  );
  routeGradient.addColorStop(0, "#5ce4ff");
  routeGradient.addColorStop(0.45, "#ffd05f");
  routeGradient.addColorStop(1, "#ff7448");

  traceRoute(context, projectedRoute, activeRoute.segmentIndex, activeRoute.segmentProgress);
  context.strokeStyle = "rgba(255, 133, 67, 0.38)";
  context.lineWidth = 18;
  context.shadowBlur = 24;
  context.shadowColor = "rgba(255, 119, 63, 0.72)";
  context.stroke();

  traceRoute(context, projectedRoute, activeRoute.segmentIndex, activeRoute.segmentProgress);
  context.strokeStyle = routeGradient;
  context.lineWidth = 5;
  context.shadowBlur = 10;
  context.stroke();
  context.restore();

  drawMarker(context, projectedRoute[0], "START", "#61dcff", "left");
  drawMarker(context, projectedRoute.at(-1)!, "FINISH", "#ff874d", "right");
  drawElevationMarker(
    context,
    project(terrainPeak, yaw, width, height),
    elevationVisibility,
    HIGHEST_ALTITUDE_METERS,
    "above",
  );
  drawElevationMarker(
    context,
    projectedRoute[0],
    elevationVisibility,
    LOWEST_ALTITUDE_METERS,
    "below-left",
  );

  if (routeProgress < 0.995) {
    context.save();
    context.fillStyle = "#ffffff";
    context.shadowBlur = 22;
    context.shadowColor = "#ff8a4d";
    context.beginPath();
    context.arc(activeRoute.point.x, activeRoute.point.y, 4.5, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
}

export function TrailMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visualStateRef = useRef({ routeProgress: 0, elevationVisibility: 0, yaw: -0.48 });
  const activePaletteRef = useRef<ContourPalette>(contourPalettes.Lime);
  const [presentationStage, setPresentationStage] = useState<"intro" | "detail">("intro");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    let animationFrame: number | undefined;
    let paletteAnimationFrame: number | undefined;
    let detailShown = false;
    let dragMode: "pointer" | "mouse" | null = null;
    let previousPointerX = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const animationStart = performance.now();
    const visualState = visualStateRef.current;
    activePaletteRef.current = resolveContourPalette(
      document.documentElement.dataset.track4trekContour,
    );
    visualState.routeProgress = reducedMotion ? 1 : 0;
    visualState.elevationVisibility = reducedMotion ? 1 : 0;
    visualState.yaw = reducedMotion ? 0.28 : -0.48;
    const drawCurrentTerrain = () => {
      drawTerrain(
        canvas,
        visualState.routeProgress,
        visualState.elevationVisibility,
        visualState.yaw,
        activePaletteRef.current,
      );
    };

    const handleLandscapeChange = (event: Event) => {
      const paletteName = (event as CustomEvent<{ contourPalette?: string }>).detail?.contourPalette;
      const nextPalette = resolveContourPalette(paletteName);
      if (nextPalette.name === activePaletteRef.current.name) return;
      if (paletteAnimationFrame !== undefined) {
        window.cancelAnimationFrame(paletteAnimationFrame);
      }
      const previousPalette = activePaletteRef.current;
      const transitionStart = performance.now();

      const transitionPalette = (now: number) => {
        if (disposed) return;
        const progress = Math.min((now - transitionStart) / 1100, 1);
        const easedProgress = progress * progress * (3 - 2 * progress);
        activePaletteRef.current = blendContourPalette(
          previousPalette,
          nextPalette,
          easedProgress,
        );
        drawCurrentTerrain();
        if (progress < 1) {
          paletteAnimationFrame = window.requestAnimationFrame(transitionPalette);
        } else {
          activePaletteRef.current = nextPalette;
          paletteAnimationFrame = undefined;
        }
      };

      paletteAnimationFrame = window.requestAnimationFrame(transitionPalette);
    };

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
    window.addEventListener(LANDSCAPE_CHANGE_EVENT, handleLandscapeChange);

    if (reducedMotion) {
      detailShown = true;
      animationFrame = window.requestAnimationFrame(() => {
        if (disposed) return;
        setPresentationStage("detail");
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
          setPresentationStage("detail");
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
      window.removeEventListener(LANDSCAPE_CHANGE_EVENT, handleLandscapeChange);
      if (animationFrame !== undefined) window.cancelAnimationFrame(animationFrame);
      if (paletteAnimationFrame !== undefined) window.cancelAnimationFrame(paletteAnimationFrame);
    };
  }, []);

  return (
    <section
      className={`trail-map-shell is-${presentationStage}-stage`}
      id="terrain-result"
      aria-labelledby="trail-map-title"
    >
      <h1 className="visually-hidden" id="trail-map-title">Sample trail map</h1>
      <p className="visually-hidden">
        A simplified three-dimensional contour terrain prototype with an animated route,
        start and finish markers, followed by illustrative route statistics.
      </p>
      <p className="visually-hidden" id="terrain-rotation-help">
        After the opening animation, drag horizontally or use the left and right arrow keys to rotate the terrain.
      </p>
      <p className="visually-hidden" id="terrain-contrast-help">
        Contour colors automatically adapt to the current landscape for contrast.
      </p>
      <p className="visually-hidden" id="terrain-elevation-help">
        Highest altitude: {HIGHEST_ALTITUDE_METERS} meters. Lowest altitude: {LOWEST_ALTITUDE_METERS} meters.
      </p>

      <div className="trail-map-stage">
        <canvas
          className="trail-map-canvas trail-contour-canvas"
          ref={canvasRef}
          role="img"
          tabIndex={0}
          data-contour-contrast="automatic"
          data-highest-altitude={HIGHEST_ALTITUDE_METERS}
          data-lowest-altitude={LOWEST_ALTITUDE_METERS}
          aria-label="Rotatable 3D contour terrain prototype with a bright route from start to finish"
          aria-describedby="terrain-rotation-help terrain-contrast-help terrain-elevation-help"
        >
          A simplified contour terrain model with a highlighted trail.
        </canvas>
      </div>

      <aside className="trail-route-facts" aria-label="Illustrative route summary">
        <dl>
          {routeFacts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd><strong>{fact.value}</strong><span>{fact.unit}</span></dd>
            </div>
          ))}
        </dl>
        <p>Prototype values</p>
      </aside>

      <a className="map-scroll-cue" href="#metrics" aria-label="Scroll to recommended metric ranges">
        <span />
      </a>
    </section>
  );
}
