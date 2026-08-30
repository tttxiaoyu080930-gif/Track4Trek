"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  readRoutePreview,
  type PreviewElevationPoint,
  type RoutePreview,
} from "../_lib/route-data";
import { useLanguage } from "./language-system";
import { THEME_CHANGE_EVENT } from "./theme-system";

type ElevationChartMode = "elevation" | "grade";

type ElevationProfileData = {
  points: PreviewElevationPoint[];
  distanceKm: number;
  ascentM: number;
  lowestM: number;
  highestM: number;
  fromGpx: boolean;
};

type PreparedProfilePoint = PreviewElevationPoint & {
  gradePercent: number | null;
};

type ChartLabels = {
  highest: (elevationM: number, distanceKm: number) => string;
  lowest: (elevationM: number, distanceKm: number) => string;
  steepestAscent: (gradePercent: number, distanceKm: number) => string;
  steepestDescent: (gradePercent: number, distanceKm: number) => string;
};

const FALLBACK_ELEVATIONS = [
  340, 365, 410, 455, 520, 610, 735, 845, 934, 890, 810, 745, 680, 610, 535,
  470, 415, 370, 360,
];

const FALLBACK_PROFILE: ElevationProfileData = {
  points: FALLBACK_ELEVATIONS.map((elevationM, index) => ({
    distanceKm: (18.4 * index) / (FALLBACK_ELEVATIONS.length - 1),
    elevationM,
  })),
  distanceKm: 18.4,
  ascentM: 690,
  lowestM: 340,
  highestM: 934,
  fromGpx: false,
};

function profileFromPreview(preview: RoutePreview | null): ElevationProfileData {
  if (!preview) return FALLBACK_PROFILE;

  let points =
    preview.elevationProfile?.filter(
      (point) => Number.isFinite(point.distanceKm) && Number.isFinite(point.elevationM),
    ) ?? [];
  if (points.length < 2) {
    const elevations = preview.mapPath
      .map((point) => point.elevation)
      .filter((value): value is number => value != null);
    const distanceKm = Math.max(preview.stats.totalDistanceKm, 0.001);
    points = elevations.map((elevationM, index) => ({
      distanceKm: (distanceKm * index) / Math.max(elevations.length - 1, 1),
      elevationM,
    }));
  }

  if (points.length < 2) return FALLBACK_PROFILE;

  const elevations = points.map((point) => point.elevationM);
  return {
    points,
    distanceKm: preview.stats.totalDistanceKm || points.at(-1)?.distanceKm || 0,
    ascentM: preview.stats.totalAscentM ?? 0,
    lowestM: preview.stats.lowestElevationM ?? Math.round(Math.min(...elevations)),
    highestM: preview.stats.highestElevationM ?? Math.round(Math.max(...elevations)),
    fromGpx: true,
  };
}

function prepareProfilePoints(points: PreviewElevationPoint[]): PreparedProfilePoint[] {
  const sorted = [...points]
    .filter(
      (point) =>
        Number.isFinite(point.distanceKm) &&
        point.distanceKm >= 0 &&
        Number.isFinite(point.elevationM),
    )
    .sort((a, b) => a.distanceKm - b.distanceKm);
  const unique: PreviewElevationPoint[] = [];

  sorted.forEach((point) => {
    const previous = unique.at(-1);
    if (previous && Math.abs(previous.distanceKm - point.distanceKm) < 0.000001) {
      unique[unique.length - 1] = {
        ...point,
        elevationM: (previous.elevationM + point.elevationM) / 2,
        gradePercent: point.gradePercent ?? previous.gradePercent,
      };
      return;
    }
    unique.push({ ...point });
  });

  return unique.map((point, index) => {
    if (Object.prototype.hasOwnProperty.call(point, "gradePercent")) {
      return {
        ...point,
        gradePercent:
          point.gradePercent != null && Number.isFinite(point.gradePercent)
            ? point.gradePercent
            : null,
      };
    }

    let left = index;
    let right = index;
    while (left > 0 && point.distanceKm - unique[left].distanceKm < 0.025) left -= 1;
    while (
      right < unique.length - 1 &&
      unique[right].distanceKm - point.distanceKm < 0.025
    ) {
      right += 1;
    }

    const horizontalMeters = (unique[right].distanceKm - unique[left].distanceKm) * 1000;
    const gradePercent =
      horizontalMeters >= 20 && horizontalMeters <= 1000
        ? ((unique[right].elevationM - unique[left].elevationM) / horizontalMeters) * 100
        : null;

    return {
      ...point,
      gradePercent:
        gradePercent != null && Math.abs(gradePercent) <= 100 ? gradePercent : null,
    };
  });
}

function resampleProfile(
  points: PreparedProfilePoint[],
  totalDistanceKm: number,
  targetCount: number,
): PreparedProfilePoint[] {
  if (points.length < 2) return points;

  const samples: PreparedProfilePoint[] = [];
  let segmentIndex = 0;

  for (let index = 0; index < targetCount; index += 1) {
    const distanceKm = (totalDistanceKm * index) / Math.max(targetCount - 1, 1);
    while (
      segmentIndex < points.length - 2 &&
      points[segmentIndex + 1].distanceKm < distanceKm
    ) {
      segmentIndex += 1;
    }

    const start = points[segmentIndex];
    const end = points[Math.min(segmentIndex + 1, points.length - 1)];
    const segmentDistance = Math.max(end.distanceKm - start.distanceKm, 0.000001);
    const ratio = Math.min(1, Math.max(0, (distanceKm - start.distanceKm) / segmentDistance));
    const startGrade = start.gradePercent;
    const endGrade = end.gradePercent;

    samples.push({
      distanceKm,
      elevationM: start.elevationM + (end.elevationM - start.elevationM) * ratio,
      gradePercent:
        startGrade != null && endGrade != null
          ? startGrade + (endGrade - startGrade) * ratio
          : null,
    });
  }

  return samples;
}

function formatSignedGrade(value: number | null) {
  if (value == null) return "—";
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}`;
}

function roundedRectangle(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

function drawMarkerLabel(
  context: CanvasRenderingContext2D,
  options: {
    x: number;
    y: number;
    label: string;
    color: string;
    left: number;
    right: number;
    top: number;
    bottom: number;
    isLight: boolean;
  },
) {
  const { x, y, label, color, left, right, top, bottom, isLight } = options;
  context.save();
  context.font = "600 10px ui-monospace, SFMono-Regular, Menlo, monospace";
  const labelWidth = Math.ceil(context.measureText(label).width) + 18;
  const labelHeight = 24;
  const canPlaceAbove = y - labelHeight - 13 >= top;
  const labelTop = canPlaceAbove
    ? y - labelHeight - 13
    : Math.min(y + 13, bottom - labelHeight);
  const labelLeft = Math.min(
    Math.max(x - labelWidth / 2, left),
    Math.max(left, right - labelWidth),
  );
  const stemEndY = canPlaceAbove ? labelTop + labelHeight : labelTop;

  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(x, stemEndY);
  context.strokeStyle = color;
  context.lineWidth = 1;
  context.stroke();

  context.beginPath();
  context.arc(x, y, 3.5, 0, Math.PI * 2);
  context.fillStyle = color;
  context.fill();

  roundedRectangle(context, labelLeft, labelTop, labelWidth, labelHeight, 7);
  context.fillStyle = isLight ? "rgba(247, 251, 250, 0.9)" : "rgba(4, 14, 27, 0.88)";
  context.fill();
  context.strokeStyle = isLight ? "rgba(25, 57, 72, 0.14)" : "rgba(226, 241, 248, 0.16)";
  context.stroke();

  context.fillStyle = isLight ? "rgba(17, 42, 56, 0.92)" : "rgba(239, 247, 251, 0.94)";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, labelLeft + labelWidth / 2, labelTop + labelHeight / 2 + 0.5);
  context.restore();
}

function drawElevationProfile(
  canvas: HTMLCanvasElement,
  profile: ElevationProfileData,
  mode: ElevationChartMode,
  labels: ChartLabels,
) {
  const bounds = canvas.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;

  const density = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(bounds.width * density);
  canvas.height = Math.round(bounds.height * density);

  const context = canvas.getContext("2d");
  if (!context) return;

  const isLight = document.documentElement.dataset.track4trekTheme === "light";
  const left = bounds.width < 620 ? 48 : 66;
  const right = bounds.width - (bounds.width < 620 ? 14 : 24);
  const top = 44;
  const bottom = bounds.height - 46;
  const plotWidth = Math.max(right - left, 1);
  const plotHeight = Math.max(bottom - top, 1);
  const totalDistance = Math.max(
    profile.distanceKm,
    profile.points.at(-1)?.distanceKm ?? 0,
    0.001,
  );
  const preparedPoints = prepareProfilePoints(profile.points);
  if (preparedPoints.length < 2) return;
  const targetCount = Math.max(72, Math.min(220, Math.round(plotWidth / 4)));
  const samples = resampleProfile(preparedPoints, totalDistance, targetCount);
  const textColor = isLight ? "rgba(24, 51, 66, 0.6)" : "rgba(224, 239, 248, 0.62)";
  const gridColor = isLight ? "rgba(25, 57, 72, 0.13)" : "rgba(218, 237, 246, 0.12)";
  const xForDistance = (distanceKm: number) =>
    left + (Math.max(0, Math.min(distanceKm, totalDistance)) / totalDistance) * plotWidth;

  context.setTransform(density, 0, 0, density, 0, 0);
  context.clearRect(0, 0, bounds.width, bounds.height);
  context.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.textBaseline = "middle";

  const gradeValues = preparedPoints
    .map((point) => point.gradePercent)
    .filter((value): value is number => value != null && Number.isFinite(value));
  const gradeMaximum = gradeValues.length ? Math.max(...gradeValues) : 0;
  const gradeMinimum = gradeValues.length ? Math.min(...gradeValues) : 0;
  const gradeDomain = Math.max(
    5,
    Math.ceil(Math.max(Math.abs(gradeMaximum), Math.abs(gradeMinimum)) / 5) * 5,
  );
  const elevationSpan = Math.max(profile.highestM - profile.lowestM, 1);
  const elevationMinimum = profile.lowestM - elevationSpan * 0.12;
  const elevationMaximum = profile.highestM + elevationSpan * 0.12;
  const elevationScaleSpan = elevationMaximum - elevationMinimum;

  for (let step = 0; step <= 4; step += 1) {
    const ratio = step / 4;
    const y = top + ratio * plotHeight;
    const gradeAxisValue = gradeDomain - ratio * gradeDomain * 2;
    const axisValue =
      mode === "elevation"
        ? `${Math.round(elevationMaximum - ratio * elevationScaleSpan)} m`
        : `${gradeAxisValue > 0 ? "+" : gradeAxisValue < 0 ? "−" : ""}${Math.abs(
            gradeAxisValue,
          ).toFixed(0)}%`;

    context.beginPath();
    context.moveTo(left, y);
    context.lineTo(right, y);
    context.strokeStyle = gridColor;
    context.lineWidth = mode === "grade" && step === 2 ? 1.5 : 1;
    context.stroke();
    context.fillStyle = textColor;
    context.textAlign = "right";
    context.fillText(axisValue, left - 10, y);
  }

  const horizontalSteps = bounds.width < 460 ? 2 : 4;
  for (let step = 0; step <= horizontalSteps; step += 1) {
    const ratio = step / horizontalSteps;
    const x = left + ratio * plotWidth;
    context.fillStyle = textColor;
    context.textAlign = step === 0 ? "left" : step === horizontalSteps ? "right" : "center";
    context.fillText(`${(totalDistance * ratio).toFixed(step === 0 ? 0 : 1)} km`, x, bottom + 25);
  }

  const spacing = plotWidth / Math.max(samples.length - 1, 1);
  const barWidth = Math.max(0.75, Math.min(1.35, spacing * 0.32));

  if (mode === "elevation") {
    samples.forEach((point) => {
      const normalizedElevation = Math.max(
        0,
        Math.min(1, (point.elevationM - profile.lowestM) / elevationSpan),
      );
      const y = top + ((elevationMaximum - point.elevationM) / elevationScaleSpan) * plotHeight;
      const x = xForDistance(point.distanceKm);
      const hue = 196 - normalizedElevation * 166;
      const lightness = isLight ? 42 + normalizedElevation * 5 : 62 + normalizedElevation * 5;
      context.fillStyle = `hsl(${hue} 72% ${lightness}% / ${isLight ? 0.82 : 0.9})`;
      context.fillRect(Math.round((x - barWidth / 2) * density) / density, y, barWidth, bottom - y);
    });

    const highest = preparedPoints.reduce((selected, point) =>
      point.elevationM > selected.elevationM ? point : selected,
    );
    const lowest = preparedPoints.reduce((selected, point) =>
      point.elevationM < selected.elevationM ? point : selected,
    );
    const yForElevation = (elevationM: number) =>
      top + ((elevationMaximum - elevationM) / elevationScaleSpan) * plotHeight;

    drawMarkerLabel(context, {
      x: xForDistance(highest.distanceKm),
      y: yForElevation(highest.elevationM),
      label: labels.highest(Math.round(highest.elevationM), highest.distanceKm),
      color: "#ffad68",
      left,
      right,
      top,
      bottom,
      isLight,
    });
    drawMarkerLabel(context, {
      x: xForDistance(lowest.distanceKm),
      y: yForElevation(lowest.elevationM),
      label: labels.lowest(Math.round(lowest.elevationM), lowest.distanceKm),
      color: "#72c9dc",
      left,
      right,
      top,
      bottom,
      isLight,
    });
  } else {
    const zeroY = top + plotHeight / 2;
    samples.forEach((point) => {
      if (point.gradePercent == null) return;
      const y = zeroY - (point.gradePercent / gradeDomain) * (plotHeight / 2);
      const x = xForDistance(point.distanceKm);
      context.fillStyle =
        point.gradePercent >= 0
          ? isLight ? "rgba(222, 119, 42, 0.86)" : "rgba(255, 173, 104, 0.92)"
          : isLight ? "rgba(35, 132, 165, 0.84)" : "rgba(114, 201, 220, 0.92)";
      context.fillRect(
        Math.round((x - barWidth / 2) * density) / density,
        Math.min(y, zeroY),
        barWidth,
        Math.max(Math.abs(zeroY - y), 0.75),
      );
    });

    const ascentPoints = preparedPoints.filter(
      (point) => point.gradePercent != null && point.gradePercent > 0,
    );
    const descentPoints = preparedPoints.filter(
      (point) => point.gradePercent != null && point.gradePercent < 0,
    );
    const steepestAscent = ascentPoints.length
      ? ascentPoints.reduce((selected, point) =>
          point.gradePercent! > selected.gradePercent! ? point : selected,
        )
      : null;
    const steepestDescent = descentPoints.length
      ? descentPoints.reduce((selected, point) =>
          point.gradePercent! < selected.gradePercent! ? point : selected,
        )
      : null;
    const yForGrade = (gradePercent: number) =>
      zeroY - (gradePercent / gradeDomain) * (plotHeight / 2);

    if (steepestAscent?.gradePercent != null) {
      drawMarkerLabel(context, {
        x: xForDistance(steepestAscent.distanceKm),
        y: yForGrade(steepestAscent.gradePercent),
        label: labels.steepestAscent(steepestAscent.gradePercent, steepestAscent.distanceKm),
        color: "#ffad68",
        left,
        right,
        top,
        bottom,
        isLight,
      });
    }
    if (steepestDescent?.gradePercent != null) {
      drawMarkerLabel(context, {
        x: xForDistance(steepestDescent.distanceKm),
        y: yForGrade(steepestDescent.gradePercent),
        label: labels.steepestDescent(steepestDescent.gradePercent, steepestDescent.distanceKm),
        color: "#72c9dc",
        left,
        right,
        top,
        bottom,
        isLight,
      });
    }
  }
}

export function ElevationProfile() {
  const { language, text } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [profile, setProfile] = useState(FALLBACK_PROFILE);
  const [chartMode, setChartMode] = useState<ElevationChartMode>("elevation");

  useEffect(() => {
    const timer = window.setTimeout(() => setProfile(profileFromPreview(readRoutePreview())), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const preparedPoints = useMemo(() => prepareProfilePoints(profile.points), [profile.points]);
  const gradeValues = preparedPoints
    .map((point) => point.gradePercent)
    .filter((value): value is number => value != null && Number.isFinite(value));
  const ascentGrades = gradeValues.filter((value) => value > 0);
  const descentGrades = gradeValues.filter((value) => value < 0);
  const steepestAscent = ascentGrades.length ? Math.max(...ascentGrades) : null;
  const steepestDescent = descentGrades.length ? Math.min(...descentGrades) : null;

  const drawChart = useCallback(() => {
    if (!canvasRef.current) return;

    drawElevationProfile(canvasRef.current, profile, chartMode, {
      highest: (elevationM, distanceKm) =>
        language === "zh"
          ? `最高 ${elevationM} 米 · ${distanceKm.toFixed(1)} 公里`
          : `HIGH ${elevationM} m · ${distanceKm.toFixed(1)} km`,
      lowest: (elevationM, distanceKm) =>
        language === "zh"
          ? `最低 ${elevationM} 米 · ${distanceKm.toFixed(1)} 公里`
          : `LOW ${elevationM} m · ${distanceKm.toFixed(1)} km`,
      steepestAscent: (gradePercent, distanceKm) =>
        language === "zh"
          ? `最大上坡 +${gradePercent.toFixed(1)}% · ${distanceKm.toFixed(1)} 公里`
          : `UP +${gradePercent.toFixed(1)}% · ${distanceKm.toFixed(1)} km`,
      steepestDescent: (gradePercent, distanceKm) =>
        language === "zh"
          ? `最大下坡 −${Math.abs(gradePercent).toFixed(1)}% · ${distanceKm.toFixed(1)} 公里`
          : `DOWN −${Math.abs(gradePercent).toFixed(1)}% · ${distanceKm.toFixed(1)} km`,
    });
  }, [chartMode, language, profile]);

  useEffect(() => {
    drawChart();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver(drawChart);
    observer.observe(canvas);
    window.addEventListener(THEME_CHANGE_EVENT, drawChart);
    return () => {
      observer.disconnect();
      window.removeEventListener(THEME_CHANGE_EVENT, drawChart);
    };
  }, [drawChart]);

  return (
    <section
      className="result-story-section elevation-profile-section section-frame"
      id="elevation"
      aria-labelledby="elevation-title"
    >
      <h2 className="result-story-title elevation-profile-title" id="elevation-title">
        {text("Elevation profile", "海拔剖面")}
      </h2>

      <div className="result-story-panel elevation-profile-panel">
        <div
          className="elevation-profile-mode"
          role="group"
          aria-label={text("Graph view", "图表视图")}
        >
          <button
            type="button"
            aria-pressed={chartMode === "elevation"}
            onClick={() => setChartMode("elevation")}
          >
            {text("Elevation", "海拔")}
          </button>
          <button
            type="button"
            aria-pressed={chartMode === "grade"}
            onClick={() => setChartMode("grade")}
          >
            {text("Grade (%)", "坡度（%）")}
          </button>
        </div>

        <p className="visually-hidden" aria-live="polite">
          {chartMode === "elevation"
            ? text("Showing elevation bars.", "正在显示海拔柱状图。")
            : text("Showing grade percentage bars.", "正在显示坡度百分比柱状图。")}
        </p>

        <dl className="elevation-profile-readout">
          <div>
            <dt>{text("Distance", "距离")}</dt>
            <dd>{profile.distanceKm.toFixed(1)}<span>km</span></dd>
          </div>
          {chartMode === "elevation" ? (
            <>
              <div>
                <dt>{text("Elevation range", "海拔范围")}</dt>
                <dd>{profile.lowestM}–{profile.highestM}<span>m</span></dd>
              </div>
              <div>
                <dt>{text("Total ascent", "累计爬升")}</dt>
                <dd>+{profile.ascentM}<span>m</span></dd>
              </div>
            </>
          ) : (
            <>
              <div>
                <dt>{text("Steepest ascent", "最大上坡坡度")}</dt>
                <dd>{formatSignedGrade(steepestAscent)}<span>%</span></dd>
              </div>
              <div>
                <dt>{text("Steepest descent", "最大下坡坡度")}</dt>
                <dd>{formatSignedGrade(steepestDescent)}<span>%</span></dd>
              </div>
            </>
          )}
        </dl>

        <canvas
          ref={canvasRef}
          className="elevation-profile-canvas"
          role="img"
          aria-label={
            chartMode === "elevation"
              ? text(
                  `Elevation profile over ${profile.distanceKm.toFixed(1)} kilometers. Highest point ${profile.highestM} meters; lowest point ${profile.lowestM} meters.`,
                  `全程 ${profile.distanceKm.toFixed(1)} 公里的海拔剖面。最高点 ${profile.highestM} 米；最低点 ${profile.lowestM} 米。`,
                )
              : text(
                  `Grade profile over ${profile.distanceKm.toFixed(1)} kilometers. Steepest ascent ${formatSignedGrade(steepestAscent)} percent; steepest descent ${formatSignedGrade(steepestDescent)} percent.`,
                  `全程 ${profile.distanceKm.toFixed(1)} 公里的坡度剖面。最大上坡坡度 ${formatSignedGrade(steepestAscent)}%；最大下坡坡度 ${formatSignedGrade(steepestDescent)}%。`,
                )
          }
        >
          {text("Route elevation and grade profile", "路线海拔与坡度剖面")}
        </canvas>

        <p className="elevation-profile-note">
          {chartMode === "grade"
            ? text(
                "Grade is estimated from smoothed GPX samples; short spikes and recording gaps are excluded.",
                "坡度根据平滑后的 GPX 采样估算；短时异常值和记录中断区段已排除。",
              )
            : profile.fromGpx
              ? text(
                  "Approximate profile from GPX elevation points.",
                  "根据 GPX 海拔点生成的近似剖面。",
                )
              : text("Generic profile · illustrative.", "通用剖面 · 仅供示意。")}
        </p>
      </div>
    </section>
  );
}
