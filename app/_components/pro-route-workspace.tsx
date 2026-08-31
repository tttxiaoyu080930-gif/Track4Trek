"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  DemandDial,
  type DemandDialProps,
} from "./demand-dial";
import { useLanguage, type Track4TrekLanguage } from "./language-system";
import {
  calculateProRouteAnalysis,
  type ProRouteAnalysis,
} from "../_lib/pro-route-analysis";
import {
  calculateRouteDemand,
  type RouteDemandAnalysis,
} from "../_lib/route-demand";
import { calculateComprehensiveRouteDifficulty } from "../_lib/route-difficulty";
import { calculateMonthlySurfaceCondition } from "../_lib/surface";
import { monthlyWeather } from "../_lib/weather";
import { ProWeatherWorkspace } from "./pro-weather-workspace";
import { useRouteWeather } from "./use-route-weather";
import { useRouteSurface } from "./use-route-surface";
import { ChartXPan, ChartXZoom } from "./chart-x-zoom";
import type {
  PreviewElevationPoint,
  ProfileSex,
  RoutePreview,
  TripActivity,
  TripMode,
} from "../_lib/route-data";
import {
  clampMovingMinutesForPlan,
  maximumMovingMinutesForPlan,
  minimumMovingMinutesForPlan,
} from "../_lib/route-data";

export type ProRouteWorkspaceProps = {
  status: "loading" | "missing" | "ready";
  preview: RoutePreview | null;
};

type ProControlState = {
  activity: TripActivity;
  tripMode: TripMode;
  plannedDays: number;
  sex: ProfileSex;
  ageYears: number;
  bodyWeightKg: number;
  heightCm: number;
  packWeightKg: number;
  movingMinutes: number;
  month: number;
};

type DataRow = {
  label: string;
  value: string;
  detail?: string;
};

const MONTHS = [
  ["January", "一月"],
  ["February", "二月"],
  ["March", "三月"],
  ["April", "四月"],
  ["May", "五月"],
  ["June", "六月"],
  ["July", "七月"],
  ["August", "八月"],
  ["September", "九月"],
  ["October", "十月"],
  ["November", "十一月"],
  ["December", "十二月"],
] as const;

// Keep a small neutral baseline while a route-weather response is loading.
// Once monthly data arrives, the selected month's bounded weather stress is
// used instead of this fallback factor.
const MONTHLY_STRESS = [0.96, 0.94, 0.98, 1.04, 1.1, 1.16, 1.2, 1.18, 1.1, 1.02, 0.97, 0.94] as const;

function clamp(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(Math.max(value, minimum), maximum);
}

function formatNumber(value: number | null, language: Track4TrekLanguage, decimals = 1) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(language === "zh" ? "zh-CN" : "en-US", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(value);
}

function formatCoordinate(value: number | null, decimals = 5) {
  return value == null || !Number.isFinite(value) ? "—" : value.toFixed(decimals);
}

function formatMovingTime(totalMinutes: number, language: Track4TrekLanguage) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (language === "zh") return `${hours} 小时 ${minutes} 分钟`;
  return `${hours} h ${minutes} min`;
}

function defaultControls(preview: RoutePreview | null): ProControlState {
  const survey = preview?.survey;
  const tripMode = survey?.tripMode ?? "single-day";
  const plannedDays = tripMode === "multi-day"
    ? Math.max(survey?.plannedDays ?? 2, 2)
    : 1;
  const requestedMovingMinutes = survey
    ? survey.movingHours * 60 + survey.movingMinutes
    : 420;
  return {
    activity: survey?.activity ?? "day-hike",
    tripMode,
    plannedDays,
    sex: survey?.sex ?? "male",
    ageYears: survey?.ageYears ?? 25,
    bodyWeightKg: survey?.bodyWeightKg ?? 70,
    heightCm: survey?.heightCm ?? 175,
    packWeightKg: survey?.packWeightKg ?? 5,
    movingMinutes: clampMovingMinutesForPlan(
      requestedMovingMinutes,
      tripMode,
      plannedDays,
    ),
    month: 9,
  };
}

function projectRange(
  low: number,
  high: number,
  domainMin: number,
  domainMax: number,
  invert = false,
) {
  const safeLow = Math.min(low, high);
  const safeHigh = Math.max(low, high);
  const span = Math.max(domainMax - domainMin, Number.EPSILON);
  const project = (value: number) => {
    const percentage = ((value - domainMin) / span) * 100;
    return invert ? 100 - percentage : percentage;
  };
  return {
    start: clamp(Math.min(project(safeLow), project(safeHigh)), 0, 100),
    end: clamp(Math.max(project(safeLow), project(safeHigh)), 0, 100),
  };
}

function scaleRange(
  estimate: { low: number; high: number },
  multiplier: number,
  minimum: number,
  maximum: number,
  domainMin: number,
  domainMax: number,
  invert = false,
) {
  const low = clamp(estimate.low * multiplier, minimum, maximum);
  const high = clamp(Math.max(low, estimate.high * multiplier), low, maximum);
  return {
    low,
    high,
    ...projectRange(low, high, domainMin, domainMax, invert),
  };
}

function labelForActivity(activity: TripActivity, text: (english: string, chinese: string) => string) {
  if (activity === "trail-run") return text("Trail run", "越野跑");
  if (activity === "backpacking") return text("Backpacking", "背包徒步");
  return text("Hiking", "徒步");
}

function formatPlannedDays(days: number, language: Track4TrekLanguage) {
  return language === "zh" ? `${days} 天` : `${days} ${days === 1 ? "day" : "days"}`;
}

function formatEnduranceReference(
  stage: RouteDemandAnalysis["endurancePlan"]["stages"][number],
  language: Track4TrekLanguage,
) {
  const number = new Intl.NumberFormat(language === "zh" ? "zh-CN" : "en-US");
  if (stage.referenceLow == null && stage.referenceHigh == null) return "—";
  if (stage.rangeKind === "less-than") {
    return `≤${number.format(stage.referenceHigh ?? 0)}`;
  }
  if (stage.rangeKind === "at-least") {
    return `≥${number.format(stage.referenceLow ?? 0)}`;
  }
  return `${number.format(stage.referenceLow ?? 0)}–${number.format(stage.referenceHigh ?? 0)}`;
}

function formatPace(value: number) {
  const seconds = Math.max(Math.round(value * 60), 0);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function monthName(month: number, language: Track4TrekLanguage) {
  const entry = MONTHS[clamp(Math.round(month), 1, 12) - 1];
  return language === "zh" ? entry[1] : entry[0];
}

function buildOutputDials(
  analysis: RouteDemandAnalysis | null,
  controls: ProControlState,
  language: Track4TrekLanguage,
  text: (english: string, chinese: string) => string,
  status: ProRouteWorkspaceProps["status"],
  weatherFactor = 1,
): DemandDialProps[] {
  const placeholder = (metricId: string, label: string, tone: DemandDialProps["tone"]): DemandDialProps => ({
    metricId,
    label,
    range: status === "loading" ? "…" : "—",
    descriptor: status === "loading"
      ? text("Reading route", "正在读取路线")
      : text("No route data", "没有路线数据"),
    start: 0,
    end: 0,
    tone,
    unit: text("Waiting for route", "等待路线数据"),
    reason: text(
      "The Pro dashboard needs a saved GPX route.",
      "专业模式仪表盘需要已保存的 GPX 路线。",
    ),
    estimateStatus: status === "loading" ? "loading" : "missing",
  });

  if (!analysis || analysis.status !== "estimated") {
    return [
      placeholder("hill-score", text("Hill score", "爬坡评分"), "orange"),
      placeholder("endurance-score", text("Endurance score", "耐力分数"), "gold"),
      placeholder("vo2-max", text("VO₂ max", "最大摄氧量"), "cyan"),
      placeholder("lactate-threshold", text("Lactate threshold", "乳酸阈值"), "magenta"),
      placeholder("active-calories", text("Active calories", "活动热量"), "orange"),
      placeholder("recovery-time", text("Recovery time", "恢复时间"), "lime"),
    ];
  }

  const weatherDelta = weatherFactor - 1;
  const hill = analysis.metrics.hill.status === "unavailable"
    ? null
    : scaleRange(analysis.metrics.hill, 1 + weatherDelta * 0.18, 1, 100, 0, 100);
  const enduranceMetric = analysis.metrics.endurance;
  const endurance = enduranceMetric.status === "unavailable"
    ? null
    : {
        ...scaleRange(enduranceMetric, 1 + weatherDelta * 0.35, 0, 10_000, 0, 10_000),
        rangeKind: enduranceMetric.rangeKind,
        ageBand: enduranceMetric.ageBand,
        status: enduranceMetric.status,
      };
  const vo2 = scaleRange(analysis.metrics.vo2Max, 1 + weatherDelta * 0.65, 3.5, 220, 20, 80);
  const lactate = analysis.metrics.lactateThreshold.status === "unavailable"
    ? null
    : scaleRange(analysis.metrics.lactateThreshold, 1 + weatherDelta * 0.45, 3, 12, 3, 12, true);
  const calories = scaleRange(analysis.metrics.activeCalories, 1 + weatherDelta * 0.4, 0, 6000, 0, 6000);
  const recovery = scaleRange(analysis.metrics.recovery, 1 + weatherDelta * 0.8, 0, 96, 0, 96);
  const number = new Intl.NumberFormat(language === "zh" ? "zh-CN" : "en-US");
  const selectedMonth = monthName(controls.month, language);
  const sexLabel = analysis.profile.sex === "male"
    ? text("Male", "男性")
    : text("Female", "女性");

  return [
    hill
      ? {
          metricId: "hill-score",
          label: text("Hill score", "爬坡评分"),
          range: `${Math.round(hill.low)}–${Math.round(hill.high)}`,
          descriptor: text("Route terrain", "路线地形"),
          start: hill.start,
          end: hill.end,
          tone: "orange" as const,
          unit: text("1–100 · route requirement", "1–100 · 路线需求"),
          reason: text(
            "A route-demand range mapped to Garmin reference bands; it is not a personal Garmin score.",
            "这是映射至 Garmin 参考等级的路线需求范围，并非个人 Garmin 分数。",
          ),
          estimateStatus: analysis.metrics.hill.status,
        }
      : placeholder("hill-score", text("Hill score", "爬坡评分"), "orange"),
    endurance
      ? {
          metricId: "endurance-score",
          label: text("Endurance score", "耐力分数"),
          range: endurance.rangeKind === "less-than"
            ? `≤${number.format(Math.round(endurance.high))}`
            : endurance.rangeKind === "at-least"
              ? `≥${number.format(Math.round(endurance.low))}`
              : `${number.format(Math.round(endurance.low))}–${number.format(Math.round(endurance.high))}`,
          descriptor: text("Route load", "路线负荷"),
          start: endurance.start,
          end: endurance.end,
          tone: "gold" as const,
          unit: `${sexLabel} · ${endurance.ageBand}`,
          reason: text(
            "A route-load range aligned with the published Garmin age and sex reference table.",
            "这是与 Garmin 公布的年龄和性别参考表对齐的路线负荷范围。",
          ),
          estimateStatus: endurance.status,
        }
      : placeholder("endurance-score", text("Endurance score", "耐力分数"), "gold"),
    {
      metricId: "vo2-max",
      label: text("VO₂ max", "最大摄氧量"),
      range: `${(vo2.low).toFixed(1)}–${(vo2.high).toFixed(1)}`,
      descriptor: text("Route capacity", "路线能力"),
      start: vo2.start,
      end: vo2.end,
      tone: "cyan" as const,
      unit: text("mL/kg/min · required capacity", "mL/kg/min · 所需能力"),
      reason: text(
        "Required route capacity, not a measurement of the user's personal VO₂ max.",
        "这是路线所需能力，并非对个人最大摄氧量的测量。",
      ),
      estimateStatus: analysis.metrics.vo2Max.status,
    },
    lactate
      ? {
          metricId: "lactate-threshold",
          label: text("Lactate threshold", "乳酸阈值"),
          range: `${formatPace(lactate.low)}–${formatPace(lactate.high)}`,
          descriptor: text("Flat-equivalent pace", "平路等效配速"),
          start: lactate.start,
          end: lactate.end,
          tone: "magenta" as const,
          unit: text("min/km · trail run", "分钟/公里 · 越野跑"),
          reason: text(
            "A grade-adjusted route requirement for a trail run of at least 20 minutes.",
            "这是至少 20 分钟越野跑的坡度修正路线需求。",
          ),
          estimateStatus: analysis.metrics.lactateThreshold.status,
        }
      : placeholder("lactate-threshold", text("Lactate threshold", "乳酸阈值"), "magenta"),
    {
      metricId: "active-calories",
      label: text("Active calories", "活动热量"),
      range: `${number.format(Math.round(calories.low))}–${number.format(Math.round(calories.high))}`,
      descriptor: text("Route energy", "路线能量"),
      start: calories.start,
      end: calories.end,
      tone: "orange" as const,
      unit: `${text("kcal · ", "千卡 · ")}${selectedMonth}`,
      reason: text(
        "Estimated from route grade, distance, time, body mass, pack mass and activity.",
        "根据路线坡度、距离、时间、体重、背包重量与活动类型估算。",
      ),
      estimateStatus: analysis.metrics.activeCalories.status,
    },
    {
      metricId: "recovery-time",
      label: text("Recovery time", "恢复时间"),
      range: `${Math.round(recovery.low)}–${Math.round(recovery.high)}`,
      descriptor: text("Route-load window", "路线负荷区间"),
      start: recovery.start,
      end: recovery.end,
      tone: "lime" as const,
      unit: `${text("hours · ", "小时 · ")}${selectedMonth}`,
      reason: text(
        "A broad route-load window that does not use heart rate, history, sleep or stress.",
        "这是宽泛的路线负荷区间，不使用心率、训练历史、睡眠或压力数据。",
      ),
      estimateStatus: analysis.metrics.recovery.status,
    },
  ];
}

function gradeForPoint(point: PreviewElevationPoint, previous: PreviewElevationPoint | undefined) {
  if (point.gradePercent != null && Number.isFinite(point.gradePercent)) return point.gradePercent;
  if (!previous) return null;
  const distanceMeters = (point.distanceKm - previous.distanceKm) * 1000;
  if (distanceMeters < 20) return null;
  const grade = ((point.elevationM - previous.elevationM) / distanceMeters) * 100;
  return Number.isFinite(grade) && Math.abs(grade) <= 100 ? grade : null;
}

type ProChartProps = {
  points: PreviewElevationPoint[];
  mode: "elevation" | "grade";
  height: number;
  zoom: number;
  pan: number;
  analysis: ProRouteAnalysis;
  text: (english: string, chinese: string) => string;
};

function pointAtDistance(points: PreviewElevationPoint[], distanceKm: number) {
  if (distanceKm <= points[0].distanceKm) return { ...points[0], distanceKm };
  if (distanceKm >= points.at(-1)!.distanceKm) return { ...points.at(-1)!, distanceKm };
  const rightIndex = points.findIndex((point) => point.distanceKm >= distanceKm);
  const leftPoint = points[Math.max(rightIndex - 1, 0)];
  const rightPoint = points[rightIndex];
  const span = Math.max(rightPoint.distanceKm - leftPoint.distanceKm, 0.000001);
  const ratio = clamp((distanceKm - leftPoint.distanceKm) / span, 0, 1);
  const leftGrade = gradeForPoint(leftPoint, points[Math.max(rightIndex - 2, 0)]);
  const rightGrade = gradeForPoint(rightPoint, leftPoint);
  return {
    distanceKm,
    elevationM: leftPoint.elevationM +
      (rightPoint.elevationM - leftPoint.elevationM) * ratio,
    gradePercent: leftGrade != null && rightGrade != null
      ? leftGrade + (rightGrade - leftGrade) * ratio
      : undefined,
  };
}

function ProChart({ points, mode, height, zoom, pan, analysis, text }: ProChartProps) {
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);
  const validPoints = points
    .filter((point) => Number.isFinite(point.distanceKm) && Number.isFinite(point.elevationM))
    .toSorted((a, b) => a.distanceKm - b.distanceKm);
  if (validPoints.length < 2) {
    return (
      <div className="pro-chart-empty" style={{ minHeight: `${height}px` }}>
        {text("No elevation samples in this GPX.", "此 GPX 没有海拔采样点。")}
      </div>
    );
  }

  const width = 1000;
  const top = 34;
  const bottom = 318;
  const left = 68;
  const right = 972;
  const plotWidth = right - left;
  const plotHeight = bottom - top;
  const totalDistance = Math.max(analysis.distanceKm, validPoints.at(-1)?.distanceKm ?? 0.001);
  const visibleDistance = totalDistance / Math.max(zoom, 1);
  const visibleStart = (totalDistance - visibleDistance) * clamp(pan, 0, 1);
  const visibleEnd = visibleStart + visibleDistance;
  const visiblePoints = [
    pointAtDistance(validPoints, visibleStart),
    ...validPoints.filter((point) =>
      point.distanceKm > visibleStart && point.distanceKm < visibleEnd),
    pointAtDistance(validPoints, visibleEnd),
  ].filter((point, index, entries) =>
    index === 0 || Math.abs(point.distanceKm - entries[index - 1].distanceKm) > 0.000001);
  const elevations = visiblePoints.map((point) => point.elevationM);
  const lowest = Math.min(...elevations);
  const highest = Math.max(...elevations);
  const elevationSpan = Math.max(highest - lowest, 1);
  const grades = visiblePoints
    .map((point, index) => gradeForPoint(point, visiblePoints[index - 1]))
    .filter((grade): grade is number => grade != null);
  const gradeDomain = Math.max(
    5,
    Math.ceil(Math.max(Math.abs(Math.min(...grades, 0)), Math.abs(Math.max(...grades, 0))) / 5) * 5,
  );
  const xFor = (distanceKm: number) =>
    left + clamp(
      (distanceKm - visibleStart) / Math.max(visibleEnd - visibleStart, 0.000001),
      0,
      1,
    ) * plotWidth;
  const yForElevation = (elevation: number) =>
    top + ((highest + elevationSpan * 0.1 - elevation) / (elevationSpan * 1.2)) * plotHeight;
  const zeroY = top + plotHeight / 2;
  const yForGrade = (grade: number) => zeroY - (grade / gradeDomain) * (plotHeight / 2);
  const barWidth = Math.max(1.1, Math.min(9, plotWidth / visiblePoints.length * 0.62));
  const highestIndex = elevations.reduce(
    (selected, elevation, index) => elevation > elevations[selected] ? index : selected,
    0,
  );
  const lowestIndex = elevations.reduce(
    (selected, elevation, index) => elevation < elevations[selected] ? index : selected,
    0,
  );
  const stroke = mode === "elevation" ? "#ffad68" : "#62c9e8";
  const labelColor = "currentColor";
  const activePoint = activePointIndex == null
    ? null
    : visiblePoints[activePointIndex] ?? null;
  const activeGrade = activePoint == null
    ? null
    : gradeForPoint(activePoint, visiblePoints[Math.max(activePointIndex! - 1, 0)]);
  const activeX = activePoint ? xFor(activePoint.distanceKm) : 0;
  const activeY = activePoint
    ? mode === "elevation"
      ? yForElevation(activePoint.elevationM)
      : activeGrade == null ? zeroY : yForGrade(activeGrade)
    : 0;

  const selectPointFromClientX = (clientX: number, bounds: DOMRect) => {
    const viewBoxX = ((clientX - bounds.left) / Math.max(bounds.width, 1)) * width;
    const targetDistance = visibleStart +
      clamp((viewBoxX - left) / plotWidth, 0, 1) * (visibleEnd - visibleStart);
    let nearestIndex = 0;
    visiblePoints.forEach((point, index) => {
      if (
        Math.abs(point.distanceKm - targetDistance) <
        Math.abs(visiblePoints[nearestIndex].distanceKm - targetDistance)
      ) nearestIndex = index;
    });
    setActivePointIndex(nearestIndex);
  };

  return (
    <svg
      className="pro-chart-svg"
      role="application"
      tabIndex={0}
      aria-label={mode === "elevation"
        ? text(
            `Elevation profile over ${totalDistance.toFixed(1)} kilometres.`,
            `全程 ${totalDistance.toFixed(1)} 公里的海拔剖面。`,
          )
        : text(
            `Gradient profile over ${totalDistance.toFixed(1)} kilometres.`,
            `全程 ${totalDistance.toFixed(1)} 公里的坡度剖面。`,
          )}
      viewBox={`0 0 ${width} 360`}
      style={{ height: `${height}px` } as CSSProperties}
      preserveAspectRatio="none"
      onPointerMove={(event) =>
        selectPointFromClientX(event.clientX, event.currentTarget.getBoundingClientRect())}
      onPointerLeave={() => setActivePointIndex(null)}
      onFocus={() => {
        if (activePointIndex == null) setActivePointIndex(Math.floor(visiblePoints.length / 2));
      }}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const current = activePointIndex ?? Math.floor(visiblePoints.length / 2);
        setActivePointIndex(clamp(
          current + (event.key === "ArrowLeft" ? -1 : 1),
          0,
          visiblePoints.length - 1,
        ));
      }}
    >
      {Array.from({ length: 5 }, (_, index) => {
        const ratio = index / 4;
        const y = top + ratio * plotHeight;
        const value = mode === "elevation"
          ? Math.round(highest + elevationSpan * 0.1 - ratio * elevationSpan * 1.2)
          : Math.round(gradeDomain - ratio * gradeDomain * 2);
        return (
          <g key={`grid-${index}`}>
            <line className="pro-chart-grid-line" x1={left} x2={right} y1={y} y2={y} />
            <text className="pro-chart-axis-label" x={left - 14} y={y + 4} textAnchor="end">
              {mode === "elevation" ? `${value} m` : `${value > 0 ? "+" : ""}${value}%`}
            </text>
          </g>
        );
      })}

      {mode === "elevation"
        ? visiblePoints.map((point, index) => {
            const x = xFor(point.distanceKm);
            const y = yForElevation(point.elevationM);
            return (
              <rect
                key={`elevation-${index}`}
                className="pro-chart-elevation-bar"
                x={x - barWidth / 2}
                y={y}
                width={barWidth}
                height={Math.max(bottom - y, 1)}
                rx={Math.min(barWidth / 2, 2)}
              />
            );
          })
        : visiblePoints.map((point, index) => {
            const grade = gradeForPoint(point, visiblePoints[index - 1]);
            if (grade == null) return null;
            const x = xFor(point.distanceKm);
            const y = yForGrade(grade);
            return (
              <rect
                key={`grade-${index}`}
                className={grade >= 0 ? "pro-chart-climb-bar" : "pro-chart-descent-bar"}
                x={x - barWidth / 2}
                y={Math.min(y, zeroY)}
                width={barWidth}
                height={Math.max(Math.abs(zeroY - y), 1)}
                rx={Math.min(barWidth / 2, 2)}
              />
            );
          })}

      {mode === "grade" ? (
        <line className="pro-chart-zero-line" x1={left} x2={right} y1={zeroY} y2={zeroY} />
      ) : null}

      {mode === "elevation" ? (
        <>
          <line
            className="pro-chart-marker-line"
            x1={xFor(visiblePoints[highestIndex].distanceKm)}
            x2={xFor(visiblePoints[highestIndex].distanceKm)}
            y1={top}
            y2={bottom}
            stroke={stroke}
          />
          <circle
            className="pro-chart-marker-dot"
            cx={xFor(visiblePoints[highestIndex].distanceKm)}
            cy={yForElevation(visiblePoints[highestIndex].elevationM)}
            r="5"
            fill={stroke}
          />
          <text
            className="pro-chart-marker-label"
            x={xFor(visiblePoints[highestIndex].distanceKm)}
            y={top - 10}
            textAnchor="middle"
            fill={labelColor}
          >
            {text(`HIGH ${Math.round(visiblePoints[highestIndex].elevationM)} m`, `最高 ${Math.round(visiblePoints[highestIndex].elevationM)} 米`)}
          </text>
          <line
            className="pro-chart-marker-line pro-chart-marker-line-low"
            x1={xFor(visiblePoints[lowestIndex].distanceKm)}
            x2={xFor(visiblePoints[lowestIndex].distanceKm)}
            y1={top}
            y2={bottom}
            stroke="#72c9dc"
          />
          <circle
            className="pro-chart-marker-dot"
            cx={xFor(visiblePoints[lowestIndex].distanceKm)}
            cy={yForElevation(visiblePoints[lowestIndex].elevationM)}
            r="5"
            fill="#72c9dc"
          />
          <text
            className="pro-chart-marker-label"
            x={xFor(visiblePoints[lowestIndex].distanceKm)}
            y={bottom + 28}
            textAnchor="middle"
            fill={labelColor}
          >
            {text(`LOW ${Math.round(visiblePoints[lowestIndex].elevationM)} m`, `最低 ${Math.round(visiblePoints[lowestIndex].elevationM)} 米`)}
          </text>
        </>
      ) : null}

      {[0, 0.5, 1].map((ratio) => (
        <text
          key={`distance-${ratio}`}
          className="pro-chart-axis-label"
          x={left + ratio * plotWidth}
          y={bottom + 28}
          textAnchor={ratio === 0 ? "start" : ratio === 1 ? "end" : "middle"}
        >
          {(visibleStart + (visibleEnd - visibleStart) * ratio).toFixed(ratio === 0 ? 0 : 1)} km
        </text>
      ))}

      {activePoint ? (
        <g className="pro-chart-active-point" aria-hidden="true">
          <line x1={activeX} x2={activeX} y1={top} y2={bottom} />
          <circle cx={activeX} cy={activeY} r="6" />
          <g transform={`translate(${clamp(activeX, left + 82, right - 82)} ${top + 9})`}>
            <rect x="-78" y="0" width="156" height="48" rx="9" />
            <text x="0" y="18" textAnchor="middle">
              {activePoint.distanceKm.toFixed(2)} km
            </text>
            <text className="pro-chart-active-value" x="0" y="36" textAnchor="middle">
              {mode === "elevation"
                ? `${Math.round(activePoint.elevationM)} m`
                : `${activeGrade == null ? "—" : `${activeGrade >= 0 ? "+" : "−"}${Math.abs(activeGrade).toFixed(1)}%`}`}
            </text>
          </g>
        </g>
      ) : null}
    </svg>
  );
}

function DataTable({ title, rows }: { title: string; rows: DataRow[] }) {
  return (
    <section className="pro-data-table" aria-labelledby={`${title.replaceAll(" ", "-").toLowerCase()}-title`}>
      <h3 id={`${title.replaceAll(" ", "-").toLowerCase()}-title`}>{title}</h3>
      <dl>
        {rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>
              <strong>{row.value}</strong>
              {row.detail ? <small>{row.detail}</small> : null}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ProRangeControl({
  id,
  label,
  value,
  displayValue,
  min,
  max,
  step,
  onChange,
  text,
}: {
  id: string;
  label: string;
  value: number;
  displayValue: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  text: (english: string, chinese: string) => string;
}) {
  return (
    <div
      className={`pro-control-row${id === "pro-month" ? " pro-month-control" : ""}`}
      data-pro-control={id}
    >
      <label htmlFor={id}>{label}</label>
      <output htmlFor={id}>{displayValue}</output>
      <input
        id={id}
        className="pro-control-range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        aria-valuetext={displayValue}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="pro-control-hint" aria-hidden="true">
        {text("adjust", "调整")}
      </span>
    </div>
  );
}

function ProMonthControl({
  value,
  language,
  onChange,
  text,
}: {
  value: number;
  language: Track4TrekLanguage;
  onChange: (value: number) => void;
  text: (english: string, chinese: string) => string;
}) {
  const selectedMonth = monthName(value, language);

  return (
    <div className="pro-control-row pro-month-control" data-pro-control="month">
      <label htmlFor="pro-month">{text("Starting month", "出发月份")}</label>
      <output id="pro-month-value" htmlFor="pro-month">
        {value} · {selectedMonth}
      </output>
      <div className="pro-month-slider">
        <input
          id="pro-month"
          className="pro-control-range"
          type="range"
          min={1}
          max={12}
          step={1}
          list="pro-month-options"
          value={value}
          aria-label={text("Starting month", "出发月份")}
          aria-valuetext={selectedMonth}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <div className="pro-month-ticks" aria-hidden="true">
          {MONTHS.map((month, index) => (
            <span key={month[0]} className={index + 1 === value ? "is-active" : undefined}>
              {language === "zh" ? month[1] : month[0].slice(0, 3)}
            </span>
          ))}
        </div>
        <datalist id="pro-month-options">
          {MONTHS.map((month, index) => (
            <option key={month[0]} value={index + 1} label={language === "zh" ? month[1] : month[0]} />
          ))}
        </datalist>
      </div>
      <span className="pro-control-hint" aria-hidden="true">
        {text("seasonal input", "季节输入")}
      </span>
    </div>
  );
}

function ChoiceControl({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="pro-control-row pro-choice-control">
      <span className="pro-control-label">{label}</span>
      <output>{options.find((option) => option.value === value)?.label ?? "—"}</output>
      <div className="pro-choice-buttons" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function segmentRows(analysis: ProRouteAnalysis, language: Track4TrekLanguage, text: (english: string, chinese: string) => string) {
  return analysis.segments.map((segment) => ({
    ...segment,
    startLabel: `${formatCoordinate(segment.start.latitude)}, ${formatCoordinate(segment.start.longitude)}`,
    finishLabel: `${formatCoordinate(segment.finish.latitude)}, ${formatCoordinate(segment.finish.longitude)}`,
    distanceLabel: `${formatNumber(segment.distanceKm, language, 2)} km`,
    pointLabel: `${segment.pointCount} ${text("points", "点")}`,
  }));
}

export function ProRouteWorkspace({ status, preview }: ProRouteWorkspaceProps) {
  const { language, text } = useLanguage();
  const weather = useRouteWeather(preview);
  const surface = useRouteSurface(preview);
  const [chartMode, setChartMode] = useState<"elevation" | "grade">("elevation");
  const [chartHeight, setChartHeight] = useState(360);
  const [chartXZoom, setChartXZoom] = useState(1);
  const [chartXPan, setChartXPan] = useState(0.5);
  const previewKey = preview == null ? "none" : `${preview.fileName}:${preview.createdAt}`;
  const [controlSnapshot, setControlSnapshot] = useState<{
    previewKey: string;
    values: ProControlState;
  }>(() => ({
    previewKey,
    values: defaultControls(preview),
  }));
  // Derive defaults during render when hydration replaces the empty state with
  // a saved route. This avoids an extra cascading render from an effect while
  // preserving user edits when the same route remains selected.
  const controls = controlSnapshot.previewKey === previewKey
    ? controlSnapshot.values
    : defaultControls(preview);

  const technical = useMemo(
    () => (preview ? calculateProRouteAnalysis(preview) : null),
    [preview],
  );
  const workingPreview = useMemo(() => {
    if (!preview) return null;
    const effectivePlannedDays = controls.tripMode === "multi-day"
      ? Math.max(controls.plannedDays, 2)
      : 1;
    const effectiveMovingMinutes = clampMovingMinutesForPlan(
      controls.movingMinutes,
      controls.tripMode,
      effectivePlannedDays,
    );
    const movingHours = Math.floor(effectiveMovingMinutes / 60);
    return {
      ...preview,
      survey: {
        ...preview.survey,
        activity: controls.activity,
        tripMode: controls.tripMode,
        plannedDays: effectivePlannedDays,
        sex: controls.sex,
        ageYears: controls.ageYears,
        bodyWeightKg: controls.bodyWeightKg,
        heightCm: controls.heightCm,
        packWeightKg: controls.packWeightKg,
        movingHours,
        movingMinutes: effectiveMovingMinutes % 60,
      },
    };
  }, [controls, preview]);
  const demandAnalysis = useMemo(
    () => (workingPreview ? calculateRouteDemand(workingPreview) : null),
    [workingPreview],
  );
  const selectedWeather = weather.data
    ? monthlyWeather(weather.data, controls.month)
    : null;
  const selectedSurfaceCondition = selectedWeather
    ? calculateMonthlySurfaceCondition(surface.data, selectedWeather)
    : null;
  const seasonalFallbackFactor = MONTHLY_STRESS[controls.month - 1] ?? 1;
  const seasonalFallbackDifficulty = clamp(
    50 + (seasonalFallbackFactor - 1) / 0.004,
    0,
    100,
  );
  const weatherDifficulty = selectedWeather?.indices.difficulty ?? seasonalFallbackDifficulty;
  const weatherFactor = clamp(1 + (weatherDifficulty / 100) * 0.22, 1, 1.22);
  const comprehensiveDifficulty = calculateComprehensiveRouteDifficulty(
    demandAnalysis,
    selectedWeather?.indices ?? {
      difficulty: weatherDifficulty,
      heat: 0,
      snow: 0,
      storm: 0,
      precipitation: 0,
      visibility: 100,
      wind: 0,
      uv: 0,
      cold: 0,
    },
    selectedSurfaceCondition,
  );
  const outputDials = useMemo(
    () => buildOutputDials(demandAnalysis, controls, language, text, status, weatherFactor),
    [controls, demandAnalysis, language, status, text, weatherFactor],
  );
  const segments = useMemo(
    () => (technical ? segmentRows(technical, language, text) : []),
    [language, technical, text],
  );
  const selectedMonth = monthName(controls.month, language);
  const selectedStress = weatherFactor;
  const profilePoints = preview?.elevationProfile ?? [];
  const profileDistance = Math.max(
    technical?.distanceKm ?? 0,
    profilePoints.at(-1)?.distanceKm ?? 0,
    0.001,
  );
  const proVisibleDistance = profileDistance / chartXZoom;
  const proVisibleStart = (profileDistance - proVisibleDistance) * chartXPan;
  const proVisibleEnd = proVisibleStart + proVisibleDistance;
  const proVisibleRangeLabel = text(
    `${proVisibleStart.toFixed(1)}–${proVisibleEnd.toFixed(1)} km visible`,
    `显示 ${proVisibleStart.toFixed(1)}–${proVisibleEnd.toFixed(1)} 公里`,
  );

  function updateControl<K extends keyof ProControlState>(key: K, value: ProControlState[K]) {
    setControlSnapshot((current) => {
      const currentValues = current.previewKey === previewKey
        ? current.values
        : defaultControls(preview);
      return {
        previewKey,
        values: { ...currentValues, [key]: value },
      };
    });
  }

  function updateTripMode(nextMode: TripMode) {
    setControlSnapshot((current) => {
      const currentValues = current.previewKey === previewKey
        ? current.values
        : defaultControls(preview);
      const rememberedDays = Math.max(currentValues.plannedDays, 2);
      const effectiveDays = nextMode === "multi-day" ? rememberedDays : 1;
      return {
        previewKey,
        values: {
          ...currentValues,
          tripMode: nextMode,
          plannedDays: rememberedDays,
          movingMinutes: clampMovingMinutesForPlan(
            currentValues.movingMinutes,
            nextMode,
            effectiveDays,
          ),
        },
      };
    });
  }

  function updatePlannedDays(nextDays: number) {
    setControlSnapshot((current) => {
      const currentValues = current.previewKey === previewKey
        ? current.values
        : defaultControls(preview);
      const plannedDays = Math.min(Math.max(Math.round(nextDays), 2), 30);
      return {
        previewKey,
        values: {
          ...currentValues,
          plannedDays,
          movingMinutes: clampMovingMinutesForPlan(
            currentValues.movingMinutes,
            "multi-day",
            plannedDays,
          ),
        },
      };
    });
  }

  const technicalUnavailable = !preview || !technical;

  return (
    <div
      className="pro-workspace"
      data-pro-state={status}
      data-pro-model-version={demandAnalysis?.modelVersion}
      data-pro-month={controls.month}
      data-pro-seasonal-factor={selectedStress.toFixed(2)}
      data-pro-weather-state={weather.status}
      aria-busy={status === "loading"}
    >
      <header className="pro-workspace-header">
        <div>
          <p className="pro-eyebrow">{text("GPX inspector", "GPX 检视器")}</p>
          <h2>{preview?.fileName ?? text("Waiting for a route", "等待路线")}</h2>
          <p>
            {text(
              "Technical fields from the saved GPX. No target pace or fitness assumptions are used in this section.",
              "来自已保存 GPX 的技术字段。本部分不使用目标配速或体能假设。",
            )}
          </p>
        </div>
        <div className="pro-header-status">
          <span>{text("Mode", "模式")}</span>
          <strong>{text("Technical", "技术")}</strong>
          <small>{preview ? `v${preview.version}` : "—"}</small>
        </div>
      </header>

      {technicalUnavailable ? (
        <div className="pro-empty-state pro-empty-state-large" role="status">
          {status === "loading"
            ? text("Reading the saved GPX…", "正在读取已保存的 GPX…")
            : text("Analyse a route first to open the GPX inspector.", "请先分析路线以打开 GPX 检视器。")}
        </div>
      ) : (
        <>
          <section className="pro-technical-section" aria-labelledby="pro-route-facts-title">
            <div className="pro-section-heading">
              <p className="pro-eyebrow">01 / {text("Route record", "路线记录")}</p>
              <h3 id="pro-route-facts-title">{text("What the file contains", "文件包含的数据")}</h3>
            </div>
            <div className="pro-data-grid">
              <DataTable
                title={text("File and source", "文件与来源")}
                rows={[
                  { label: text("Path type", "路径类型"), value: technical.pathKind === "track" ? text("GPX track", "GPX 轨迹") : technical.pathKind === "route" ? text("GPX route", "GPX 路线") : text("Sample route", "示例路线") },
                  { label: text("Source", "来源"), value: technical.sourceKind === "uploaded-gpx" ? text("Uploaded GPX", "上传的 GPX") : text("Built-in sample", "内置示例") },
                  { label: text("Schema", "架构版本"), value: `RoutePreview v${preview.version}` },
                  { label: text("Coordinates", "坐标点"), value: `${technical.pointCount}`, detail: `${technical.sampledCoordinateCount} ${text("retained for display", "个用于显示")}` },
                  { label: text("Tracks / segments", "轨迹 / 区段"), value: `${technical.trackCount} / ${technical.segmentCount}` },
                  { label: text("Waypoints", "航点"), value: `${technical.waypointCount}` },
                ]}
              />
              <DataTable
                title={text("Geometry", "几何信息")}
                rows={[
                  { label: text("Distance", "距离"), value: `${formatNumber(technical.distanceKm, language, 2)} km` },
                  { label: text("Start", "起点"), value: technical.start ? `${formatCoordinate(technical.start.latitude)}, ${formatCoordinate(technical.start.longitude)}` : "—", detail: technical.start?.elevationM == null ? undefined : `${Math.round(technical.start.elevationM)} m` },
                  { label: text("Finish", "终点"), value: technical.finish ? `${formatCoordinate(technical.finish.latitude)}, ${formatCoordinate(technical.finish.longitude)}` : "—", detail: technical.finish?.elevationM == null ? undefined : `${Math.round(technical.finish.elevationM)} m` },
                  { label: text("Centre", "中心"), value: technical.center ? `${formatCoordinate(technical.center.latitude)}, ${formatCoordinate(technical.center.longitude)}` : "—" },
                  { label: text("Initial bearing", "初始方位角"), value: technical.initialBearingDeg == null ? "—" : `${Math.round(technical.initialBearingDeg)}°` },
                  { label: text("Loop check", "闭环检查"), value: technical.isLoop == null ? "—" : technical.isLoop ? text("Likely loop", "可能闭环") : text("Point to point", "点到点") },
                ]}
              />
              <DataTable
                title={text("Elevation and grade", "海拔与坡度")}
                rows={[
                  { label: text("Range", "范围"), value: technical.lowestM == null || technical.highestM == null ? "—" : `${technical.lowestM}–${technical.highestM} m` },
                  { label: text("Gain / loss", "爬升 / 下降"), value: technical.ascentM == null || technical.descentM == null ? "—" : `+${technical.ascentM} / −${technical.descentM} m` },
                  { label: text("Mean / median", "平均 / 中位数"), value: technical.meanElevationM == null || technical.medianElevationM == null ? "—" : `${technical.meanElevationM} / ${technical.medianElevationM} m` },
                  { label: text("Variation", "变化"), value: technical.elevationStdDevM == null ? "—" : `±${technical.elevationStdDevM} m` },
                  { label: text("Steepest climb", "最大上坡"), value: technical.steepestAscentPct == null ? "—" : `+${technical.steepestAscentPct}%` },
                  { label: text("Steepest descent", "最大下坡"), value: technical.steepestDescentPct == null ? "—" : `${technical.steepestDescentPct}%` },
                ]}
              />
              <DataTable
                title={text("Field availability", "字段可用性")}
                rows={[
                  { label: text("Elevation samples", "海拔采样"), value: technical.hasElevation ? `${technical.elevationCoveragePct}%` : text("Absent", "没有") },
                  { label: text("Timestamps", "时间戳"), value: technical.hasTime ? text("Present", "有") : text("Absent", "没有") },
                  { label: text("Route closure", "路线闭合"), value: technical.endpointGapKm == null ? "—" : `${technical.endpointGapKm} km gap` },
                  { label: text("North / south span", "南北跨度"), value: technical.northSouthExtentKm == null ? "—" : `${technical.northSouthExtentKm} km` },
                  { label: text("East / west span", "东西跨度"), value: technical.eastWestExtentKm == null ? "—" : `${technical.eastWestExtentKm} km` },
                  {
                    label: text("Trail surface", "步道表面"),
                    value: surface.status === "loading"
                      ? text("Matching map data…", "正在匹配地图数据…")
                      : surface.data?.source === "openstreetmap"
                        ? `${surface.data.mappedCoveragePct}% ${text("corridor matched", "路线走廊已匹配")}`
                        : text("Map data unavailable", "地图数据不可用"),
                    detail: surface.data?.source === "openstreetmap"
                      ? `${surface.data.explicitSurfaceTagPct}% ${text("with an explicit surface tag", "具有明确路面标签")}`
                      : text("Surface is not encoded in the GPX", "GPX 本身不包含路面信息"),
                  },
                ]}
              />
            </div>
          </section>

          <section className="pro-technical-section pro-profile-lab" aria-labelledby="pro-profile-title">
            <div className="pro-section-heading pro-section-heading-row">
              <div>
                <p className="pro-eyebrow">02 / {text("Profile lab", "剖面实验台")}</p>
                <h3 id="pro-profile-title">{text("Elevation and gradient", "海拔与坡度")}</h3>
              </div>
              <div className="pro-chart-controls">
                <div className="pro-chart-mode" role="group" aria-label={text("Chart view", "图表视图")}>
                  <button type="button" aria-pressed={chartMode === "elevation"} onClick={() => setChartMode("elevation")}>
                    {text("Elevation", "海拔")}
                  </button>
                  <button type="button" aria-pressed={chartMode === "grade"} onClick={() => setChartMode("grade")}>
                    {text("Gradient", "坡度")}
                  </button>
                </div>
                <label className="pro-chart-size" htmlFor="pro-chart-size">
                  <span>{text("Height", "高度")}</span>
                  <output>{chartHeight}px</output>
                  <input
                    id="pro-chart-size"
                    type="range"
                    min="240"
                    max="620"
                    step="20"
                    value={chartHeight}
                    aria-label={text("Chart height", "图表高度")}
                    onChange={(event) => setChartHeight(Number(event.target.value))}
                  />
                </label>
                <ChartXZoom
                  id="pro-profile-x-zoom"
                  label={text("Horizontal scale", "水平缩放")}
                  zoom={chartXZoom}
                  visibleRange={proVisibleRangeLabel}
                  onChange={(value) => {
                    setChartXZoom(value);
                    setChartXPan(0.5);
                  }}
                />
              </div>
            </div>
            <div className="pro-chart-frame">
              <ProChart
                points={profilePoints}
                mode={chartMode}
                height={chartHeight}
                zoom={chartXZoom}
                pan={chartXPan}
                analysis={technical}
                text={text}
              />
            </div>
            <ChartXPan
              id="pro-profile-x-pan"
              label={text("Move visible range", "左右移动显示范围")}
              position={chartXPan}
              disabled={chartXZoom <= 1}
              disabledText={text("Zoom in to pan", "放大后可左右移动")}
              visibleRange={proVisibleRangeLabel}
              onChange={setChartXPan}
            />
            <div className="pro-profile-readout">
              <span>{text("P90 climb", "上坡 P90")}: {technical.p90AscentPct == null ? "—" : `+${technical.p90AscentPct}%`}</span>
              <span>{text("P10 descent", "下坡 P10")}: {technical.p90DescentPct == null ? "—" : `${technical.p90DescentPct}%`}</span>
              <span>{text("Longest climb", "最长爬升")}: {technical.longestClimbGainM ? `${technical.longestClimbGainM} m / ${technical.longestClimbDistanceKm} km` : "—"}</span>
              <span>{text("Net change", "净变化")}: {technical.netElevationM == null ? "—" : `${technical.netElevationM >= 0 ? "+" : "−"}${Math.abs(technical.netElevationM)} m`}</span>
            </div>
          </section>

          <section className="pro-technical-section" aria-labelledby="pro-segments-title">
            <div className="pro-section-heading">
              <p className="pro-eyebrow">03 / {text("Track structure", "轨迹结构")}</p>
              <h3 id="pro-segments-title">{text("Separated GPX segments", "独立 GPX 区段")}</h3>
            </div>
            {segments.length ? (
              <div className="pro-segment-table-wrap">
                <table className="pro-segment-table">
                  <thead>
                    <tr>
                      <th>{text("Segment", "区段")}</th>
                      <th>{text("Points", "点数")}</th>
                      <th>{text("Distance", "距离")}</th>
                      <th>{text("Elevation", "海拔")}</th>
                      <th>{text("Start → finish", "起点 → 终点")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {segments.map((segment) => (
                      <tr key={segment.index}>
                        <td>{String(segment.index).padStart(2, "0")}</td>
                        <td>{segment.pointLabel}</td>
                        <td>{segment.distanceLabel}</td>
                        <td>{segment.lowestM == null || segment.highestM == null ? "—" : `${segment.lowestM}–${segment.highestM} m`}</td>
                        <td><span>{segment.startLabel}</span><span>{segment.finishLabel}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="pro-inline-note">{text("No separated segments were retained.", "没有保留独立区段。")}</p>
            )}
            <div className="pro-external-note">
              <strong>{text("Not in the GPX", "GPX 未包含")}</strong>
              <span>{text("Named trail class, access rules and corrected DEM values require separate map providers. Surface composition is now matched separately from OpenStreetMap where tags are available.", "命名步道类别、通行规则和校正 DEM 数值需要额外地图服务；路面组成现会在标签可用时另行匹配 OpenStreetMap。")}</span>
            </div>
          </section>

          <ProWeatherWorkspace
            weather={weather}
            month={controls.month}
            language={language}
            text={text}
          />

          <section className="pro-dashboard" id="pro-dashboard" aria-labelledby="pro-dashboard-title">
            <div className="pro-dashboard-controls">
              <div className="pro-section-heading">
                <p className="pro-eyebrow">05 / {text("Live dashboard", "实时仪表盘")}</p>
                <h3 id="pro-dashboard-title">{text("Change the assumptions", "调整输入条件")}</h3>
                <p>{text("The GPX stays fixed. These controls recalculate the route-demand dials on the right.", "GPX 路线保持不变；左侧控制会重新计算右侧路线需求仪表。")}</p>
              </div>

              <div className="pro-controls-list">
                <ChoiceControl
                  label={text("Activity", "活动")}
                  value={controls.activity}
                  options={[
                    { value: "day-hike", label: text("Hike", "徒步") },
                    { value: "trail-run", label: text("Run", "跑步") },
                    { value: "backpacking", label: text("Pack", "背包") },
                  ]}
                  onChange={(value) => updateControl("activity", value as TripActivity)}
                />
                <ChoiceControl
                  label={text("Trip length", "行程类型")}
                  value={controls.tripMode}
                  options={[
                    { value: "single-day", label: text("Single", "单日") },
                    { value: "multi-day", label: text("Multi-day", "多日") },
                  ]}
                  onChange={(value) => updateTripMode(value as TripMode)}
                />
                {controls.tripMode === "multi-day" ? (
                  <ProRangeControl
                    id="pro-planned-days"
                    label={text("Planned days", "计划天数")}
                    value={Math.max(controls.plannedDays, 2)}
                    displayValue={formatPlannedDays(Math.max(controls.plannedDays, 2), language)}
                    min={2}
                    max={30}
                    step={1}
                    onChange={updatePlannedDays}
                    text={text}
                  />
                ) : null}
                <ChoiceControl
                  label={text("Gender", "性别")}
                  value={controls.sex}
                  options={[
                    { value: "male", label: text("Male", "男性") },
                    { value: "female", label: text("Female", "女性") },
                  ]}
                  onChange={(value) => updateControl("sex", value as ProfileSex)}
                />
                <ProRangeControl
                  id="pro-moving-time"
                  label={text("Total moving time", "全程移动时间")}
                  value={controls.movingMinutes}
                  displayValue={controls.tripMode === "multi-day"
                    ? text(
                        `${formatMovingTime(controls.movingMinutes, language)} total · ${formatMovingTime(Math.round(controls.movingMinutes / Math.max(controls.plannedDays, 2)), language)} avg/day`,
                        `${formatMovingTime(controls.movingMinutes, language)} 全程 · 日均 ${formatMovingTime(Math.round(controls.movingMinutes / Math.max(controls.plannedDays, 2)), language)}`,
                      )
                    : formatMovingTime(controls.movingMinutes, language)}
                  min={minimumMovingMinutesForPlan(
                    controls.tripMode,
                    controls.tripMode === "multi-day" ? Math.max(controls.plannedDays, 2) : 1,
                  )}
                  max={maximumMovingMinutesForPlan(
                    controls.tripMode,
                    controls.tripMode === "multi-day" ? Math.max(controls.plannedDays, 2) : 1,
                  )}
                  step={15}
                  onChange={(value) => updateControl("movingMinutes", value)}
                  text={text}
                />
                <ProRangeControl
                  id="pro-age"
                  label={text("Age", "年龄")}
                  value={controls.ageYears}
                  displayValue={`${controls.ageYears} ${text("years", "岁")}`}
                  min={13}
                  max={100}
                  step={1}
                  onChange={(value) => updateControl("ageYears", value)}
                  text={text}
                />
                <ProRangeControl
                  id="pro-body-weight"
                  label={text("Body weight", "体重")}
                  value={controls.bodyWeightKg}
                  displayValue={`${controls.bodyWeightKg} kg`}
                  min={30}
                  max={200}
                  step={1}
                  onChange={(value) => updateControl("bodyWeightKg", value)}
                  text={text}
                />
                <ProRangeControl
                  id="pro-pack-weight"
                  label={text("Pack weight", "背包重量")}
                  value={controls.packWeightKg}
                  displayValue={`${controls.packWeightKg.toFixed(1)} kg`}
                  min={0}
                  max={60}
                  step={0.5}
                  onChange={(value) => updateControl("packWeightKg", value)}
                  text={text}
                />
                <ProRangeControl
                  id="pro-height"
                  label={text("Height", "身高")}
                  value={controls.heightCm}
                  displayValue={`${controls.heightCm} cm`}
                  min={120}
                  max={230}
                  step={1}
                  onChange={(value) => updateControl("heightCm", value)}
                  text={text}
                />
                <ProMonthControl
                  value={controls.month}
                  language={language}
                  onChange={(value) => updateControl("month", value)}
                  text={text}
                />
              </div>
              <p className="pro-control-note">
                {text(
                  `Month ${controls.month} uses the route-weather stress factor ${(selectedStress * 100).toFixed(0)}%; the factor is bounded and does not replace an official forecast. Height remains profile context until a validated height-related coefficient is available.`,
                  `${controls.month} 月使用 ${(selectedStress * 100).toFixed(0)}% 的路线天气压力系数；该系数有边界，不能替代官方预报。在获得经过验证的身高相关系数前，身高仅作为个人资料背景。`,
                )}
              </p>
            </div>

            <div className="pro-dashboard-outputs">
              <div className="pro-output-heading">
                <div>
                  <p className="pro-eyebrow">{text("Output", "输出")}</p>
                  <h3>{text("Route demand", "路线需求")}</h3>
                </div>
                <span role="status" aria-live="polite" aria-atomic="true">
                  {labelForActivity(controls.activity, text)} · {formatPlannedDays(
                    controls.tripMode === "multi-day" ? Math.max(controls.plannedDays, 2) : 1,
                    language,
                  )} · {selectedMonth}
                </span>
              </div>
              <section className="pro-difficulty-audit" aria-labelledby="pro-difficulty-title">
                <div className="pro-difficulty-score">
                  <span>{text("Comprehensive difficulty", "综合难度")}</span>
                  <strong id="pro-difficulty-title">{comprehensiveDifficulty.score}<small>/100</small></strong>
                  <small>{text(
                    `Intrinsic ${comprehensiveDifficulty.baseScore - comprehensiveDifficulty.surfaceAdjustment} + surface ${comprehensiveDifficulty.surfaceAdjustment} + weather ${comprehensiveDifficulty.weatherAdjustment}`,
                    `路线本身 ${comprehensiveDifficulty.baseScore - comprehensiveDifficulty.surfaceAdjustment} + 路面 ${comprehensiveDifficulty.surfaceAdjustment} + 天气 ${comprehensiveDifficulty.weatherAdjustment}`,
                  )}</small>
                </div>
                <div className="pro-difficulty-components">
                  {([
                    [text("Endurance", "耐力"), comprehensiveDifficulty.components.endurance],
                    [text("Terrain", "地形"), comprehensiveDifficulty.components.terrain],
                    [text("Aerobic", "有氧"), comprehensiveDifficulty.components.aerobic],
                    [text("Altitude", "海拔"), comprehensiveDifficulty.components.altitude],
                    [text("Pack", "负重"), comprehensiveDifficulty.components.carriedLoad],
                    [text("Surface", "路面"), comprehensiveDifficulty.components.surface],
                    [text("Weather", "天气"), comprehensiveDifficulty.components.weather],
                  ] as const).map(([label, value]) => (
                    <div key={label} style={{ "--pro-factor": `${value}%` } as CSSProperties}>
                      <span>{label}</span><strong>{value}</strong><i aria-hidden="true" />
                    </div>
                  ))}
                </div>
                <dl className="pro-altitude-audit">
                  <div><dt>{text("Mean / high", "平均 / 最高")}</dt><dd>{formatNumber(comprehensiveDifficulty.altitude.meanElevationM, language, 0)} / {formatNumber(comprehensiveDifficulty.altitude.highestElevationM, language, 0)} m</dd></div>
                  <div><dt>{text("Acute capacity retained", "急性能力保留")}</dt><dd>{formatNumber(comprehensiveDifficulty.altitude.acuteAvailabilityPct, language, 1)}%</dd></div>
                  <div><dt>{text("Distance >2,500 m", "高于 2,500 米路程")}</dt><dd>{formatNumber(comprehensiveDifficulty.altitude.distanceAbove2500Pct, language, 1)}%</dd></div>
                  <div><dt>{text("Distance >4,000 m", "高于 4,000 米路程")}</dt><dd>{formatNumber(comprehensiveDifficulty.altitude.distanceAbove4000Pct, language, 1)}%</dd></div>
                </dl>
                <p>{text(
                  "Acute, unacclimatized planning reference. It is not an altitude-illness forecast.",
                  "急性、未适应海拔的规划参考；并非高原病预测。",
                )}</p>
              </section>
              <div className="pro-output-group">
                <h4>{text("Capability metrics", "能力指标")}</h4>
                <div className="pro-output-grid">
                  {outputDials.slice(0, 4).map((dial) => (
                    <DemandDial key={dial.metricId} {...dial} />
                  ))}
                </div>
              </div>
              <div className="pro-output-group pro-output-group-forecast">
                <h4>{text("Forecast", "预测")}</h4>
                <div className="pro-output-grid pro-output-grid-forecast">
                  {outputDials.slice(4).map((dial) => (
                    <DemandDial key={dial.metricId} {...dial} />
                  ))}
                </div>
              </div>
              {demandAnalysis?.status === "estimated" &&
              demandAnalysis.endurancePlan.tripMode === "multi-day" ? (
                <section className="pro-endurance-stages" aria-labelledby="pro-endurance-stages-title">
                  <div>
                    <h4 id="pro-endurance-stages-title">
                      {text("Daily endurance stages", "每日耐力阶段")}
                    </h4>
                    <span>
                      {text(
                        "Balanced modeled effort · limiting day ",
                        "均衡模型负荷 · 限制日 ",
                      )}
                      {demandAnalysis.endurancePlan.limitingDay}
                    </span>
                  </div>
                  <div
                    className="pro-endurance-stage-table-wrap"
                    tabIndex={0}
                    aria-label={text(
                      "Scrollable daily endurance stage table",
                      "可滚动的每日耐力阶段表格",
                    )}
                  >
                    <table className="pro-endurance-stage-table">
                      <caption className="visually-hidden">
                        {text(
                          "Modeled daily endurance stages and baseline reference ranges",
                          "每日耐力模型阶段与基准参考范围",
                        )}
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">{text("Day", "天")}</th>
                          <th scope="col">{text("Distance", "距离")}</th>
                          <th scope="col">{text("Moving", "移动")}</th>
                          <th scope="col">{text("Ascent", "爬升")}</th>
                          <th scope="col">{text("Mean altitude", "平均海拔")}</th>
                          <th scope="col">{text("Baseline range", "基准范围")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {demandAnalysis.endurancePlan.stages.map((stage) => (
                          <tr key={stage.day} data-limiting={stage.day === demandAnalysis.endurancePlan.limitingDay}>
                            <td>
                              {String(stage.day).padStart(2, "0")}
                              {stage.day === demandAnalysis.endurancePlan.limitingDay ? (
                                <span className="visually-hidden">
                                  {text(" — limiting day", " — 限制日")}
                                </span>
                              ) : null}
                            </td>
                            <td>{formatNumber(stage.distanceKm, language, 1)} km</td>
                            <td>{formatMovingTime(Math.round(stage.movingMinutes), language)}</td>
                            <td>+{formatNumber(stage.ascentM, language, 0)} m</td>
                            <td>{formatNumber(stage.meanElevationM, language, 0)} m · {formatNumber(stage.altitudeAvailabilityPct, language, 1)}%</td>
                            <td>{formatEnduranceReference(stage, language)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p>
                    {text(
                      "The GPX has no campsite boundaries, so stages are balanced by modeled effort. Daily rows are the pre-weather baseline; the selected month adjusts the dial. A bounded 0.35 overnight carry combines consecutive days.",
                      "GPX 不含营地边界，因此按模型负荷均衡分段。每日行显示天气修正前的基准值；所选月份会调整仪表。连续天数使用有上限的 0.35 隔夜承接系数。",
                    )}
                  </p>
                </section>
              ) : null}
              <p className="pro-output-note">
                {text(
                  "Every change is calculated locally from the same GPX. Weather fields update when the route providers respond; unavailable fields keep the seasonal baseline.",
                  "每次变化都基于同一份 GPX 在本地计算。路线服务商返回数据后天气字段会更新；不可用字段继续使用季节基线。",
                )}
              </p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
