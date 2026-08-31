"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { RoutePreview } from "../_lib/route-data";
import type { RouteDemandAnalysis } from "../_lib/route-demand";
import { calculateComprehensiveRouteDifficulty } from "../_lib/route-difficulty";
import {
  calculateMonthlySurfaceCondition,
  type SurfaceBaseKey,
  type SurfaceConditionKey,
} from "../_lib/surface";
import { useLanguage } from "./language-system";
import { useRouteSurface } from "./use-route-surface";
import { useRouteWeather } from "./use-route-weather";

type TrailSurfacePanelProps = {
  preview: RoutePreview | null;
  analysis: RouteDemandAnalysis | null;
};

const MONTHS = [
  ["January", "一月", "Jan", "1月"],
  ["February", "二月", "Feb", "2月"],
  ["March", "三月", "Mar", "3月"],
  ["April", "四月", "Apr", "4月"],
  ["May", "五月", "May", "5月"],
  ["June", "六月", "Jun", "6月"],
  ["July", "七月", "Jul", "7月"],
  ["August", "八月", "Aug", "8月"],
  ["September", "九月", "Sep", "9月"],
  ["October", "十月", "Oct", "10月"],
  ["November", "十一月", "Nov", "11月"],
  ["December", "十二月", "Dec", "12月"],
] as const;

const CONDITION_STYLES: Record<SurfaceConditionKey, string> = {
  firmTrail: "#69d89b",
  gravel: "#c2b08e",
  mud: "#93694c",
  sand: "#e6c976",
  rock: "#aeb9c2",
  snowIce: "#d8efff",
  offTrail: "#ff9978",
  unknown: "#647481",
};

const CONDITION_ORDER: readonly SurfaceConditionKey[] = [
  "firmTrail",
  "gravel",
  "mud",
  "sand",
  "rock",
  "snowIce",
  "offTrail",
  "unknown",
];

const BASE_ORDER: readonly SurfaceBaseKey[] = [
  "paved",
  "trail",
  "gravel",
  "rock",
  "sand",
  "offTrail",
  "unknown",
];

function monthLabel(index: number, language: "en" | "zh", short = false) {
  const month = MONTHS[Math.min(Math.max(index, 0), 11)];
  if (language === "zh") return month[short ? 3 : 1];
  return month[short ? 2 : 0];
}

export function TrailSurfacePanel({ preview, analysis }: TrailSurfacePanelProps) {
  const { language, text } = useLanguage();
  const weather = useRouteWeather(preview);
  const surface = useRouteSurface(preview);
  const [selectedIndex, setSelectedIndex] = useState(7);
  const monthly = useMemo(() => weather.data?.monthly ?? [], [weather.data?.monthly]);
  const conditions = useMemo(
    () => monthly.map((entry) =>
      calculateMonthlySurfaceCondition(surface.data, entry)),
    [monthly, surface.data],
  );
  const selectedWeather = monthly[selectedIndex] ?? null;
  const selectedCondition = conditions[selectedIndex] ?? null;
  const selectedDifficulty = selectedWeather && selectedCondition
    ? calculateComprehensiveRouteDifficulty(
        analysis,
        selectedWeather.indices,
        selectedCondition,
      )
    : null;
  const statusText = surface.status === "loading"
    ? text("Matching route to OpenStreetMap…", "正在匹配 OpenStreetMap 路线…")
    : surface.data?.source === "openstreetmap"
      ? text("OpenStreetMap surface match", "OpenStreetMap 路面匹配")
      : text("Surface map unavailable", "路面地图不可用");

  const conditionLabel = (key: SurfaceConditionKey) => ({
    firmTrail: text("Firm / built trail", "坚实 / 修建步道"),
    gravel: text("Gravel", "碎石"),
    mud: text("Mud", "泥泞"),
    sand: text("Sand", "沙地"),
    rock: text("Rock / slick rock", "岩石 / 湿滑岩石"),
    snowIce: text("Snow / ice", "冰雪"),
    offTrail: text("Unmapped / off-trail", "未映射 / 非步道"),
    unknown: text("Unknown", "未知"),
  })[key];
  const baseLabel = (key: SurfaceBaseKey) => ({
    paved: text("Paved / built", "铺装 / 修建"),
    trail: text("Earth / trail", "土路 / 步道"),
    gravel: text("Gravel", "碎石"),
    rock: text("Rock", "岩石"),
    sand: text("Sand", "沙地"),
    offTrail: text("Unmapped / off-trail", "未映射 / 非步道"),
    unknown: text("Unknown mapped way", "未知已映射道路"),
  })[key];

  return (
    <section
      className="trail-surface-section result-story-section section-frame"
      id="surface"
      aria-labelledby="trail-surface-title"
    >
      <h2 className="trail-surface-title result-story-title" id="trail-surface-title">
        {text("Trail surface by month", "逐月步道路面")}
      </h2>
      <div className="trail-surface-panel result-story-panel" data-surface-state={surface.status}>
        <div className="surface-source-row">
          <span>{statusText}</span>
          <strong>
            {surface.data?.source === "openstreetmap"
              ? `${surface.data.mappedCoveragePct}% ${text("corridor matched", "路线走廊已匹配")}`
              : text("No mapped percentage applied", "未应用地图比例")}
          </strong>
          <button
            type="button"
            onClick={surface.refresh}
            disabled={!preview || surface.status === "loading"}
            aria-label={text("Refresh trail surface", "刷新步道路面")}
            title={text("Refresh trail surface", "刷新步道路面")}
          >↻</button>
        </div>

        <div className="surface-month-summary">
          <div>
            <span>{text("Starting month", "出发月份")}</span>
            <strong>{monthLabel(selectedIndex, language)}</strong>
          </div>
          <div>
            <span>{text("Surface demand", "路面负荷")}</span>
            <strong>{selectedCondition?.difficultyScore ?? 0}<small>/100</small></strong>
          </div>
          <div>
            <span>{text("Overall difficulty", "综合难度")}</span>
            <strong>{selectedDifficulty?.score ?? "—"}<small>/100</small></strong>
          </div>
        </div>

        <label className="surface-month-slider" htmlFor="surface-month">
          <span>{text("Move through the year", "滑动查看全年")}</span>
          <input
            id="surface-month"
            type="range"
            min="0"
            max="11"
            step="1"
            value={selectedIndex}
            aria-valuetext={monthLabel(selectedIndex, language)}
            onChange={(event) => setSelectedIndex(Number(event.target.value))}
          />
          <output htmlFor="surface-month">{monthLabel(selectedIndex, language)}</output>
        </label>
        <div className="surface-month-axis" aria-hidden="true">
          {MONTHS.map((_, index) => <span key={index}>{monthLabel(index, language, true)}</span>)}
        </div>

        {selectedCondition ? (
          <>
            <div
              className="surface-condition-bar"
              role="img"
              aria-label={text(
                `Estimated trail conditions for ${monthLabel(selectedIndex, language)}`,
                `${monthLabel(selectedIndex, language)}的估算步道状况`,
              )}
            >
              {CONDITION_ORDER.map((key) => {
                const value = selectedCondition.shares[key];
                return value > 0 ? (
                  <i
                    key={key}
                    style={{
                      "--surface-share": `${value}%`,
                      "--surface-color": CONDITION_STYLES[key],
                    } as CSSProperties}
                    title={`${conditionLabel(key)} · ${value.toFixed(1)}%`}
                  />
                ) : null;
              })}
            </div>
            <div className="surface-condition-grid">
              {CONDITION_ORDER.map((key) => (
                <div key={key} style={{ "--surface-color": CONDITION_STYLES[key] } as CSSProperties}>
                  <i aria-hidden="true" />
                  <span>{conditionLabel(key)}</span>
                  <strong>{selectedCondition.shares[key].toFixed(1)}%</strong>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="surface-empty" role="status">
            {preview
              ? text("Waiting for route weather and surface data…", "正在等待路线天气与路面数据…")
              : text("Analyse a GPX route to map its surface.", "请先分析 GPX 路线以匹配路面。")}
          </div>
        )}

        <div className="surface-audit-grid">
          <div>
            <span>{text("Terrain factor", "地形系数")}</span>
            <strong>{selectedCondition?.terrainFactor.toFixed(2) ?? "1.00"}×</strong>
            <small>{text("bounded surface-cost proxy", "有界路面消耗代理")}</small>
          </div>
          <div>
            <span>{text("Wetness proxy", "湿润度代理")}</span>
            <strong>{selectedCondition?.wetness.toFixed(0) ?? 0}%</strong>
            <small>{text("rain · humidity · heat", "降雨 · 湿度 · 高温")}</small>
          </div>
          <div>
            <span>{text("Snow-cover proxy", "积雪覆盖代理")}</span>
            <strong>{selectedCondition?.snowCover.toFixed(0) ?? 0}%</strong>
            <small>{text("snow · cold", "降雪 · 低温")}</small>
          </div>
          <div>
            <span>{text("Difficulty added", "增加难度")}</span>
            <strong>+{selectedDifficulty?.surfaceAdjustment ?? 0}</strong>
            <small>{text("before weather adjustment", "天气修正之前")}</small>
          </div>
        </div>

        <details className="surface-base-details">
          <summary>{text("Mapped base composition", "地图基础路面组成")}</summary>
          <div>
            {BASE_ORDER.map((key) => (
              <span key={key}>
                <small>{baseLabel(key)}</small>
                <strong>{surface.data?.base[key].toFixed(1) ?? "0.0"}%</strong>
              </span>
            ))}
          </div>
        </details>

        <p className="surface-disclaimer">
          {text(
            "Base percentages come from nearby OpenStreetMap way tags sampled along the GPX corridor. Missing map matches are labelled unmapped / off-trail and do not prove that a trail is absent. Mud, snow/ice and rock slickness are monthly weather-derived planning proxies—not live ground observations.",
            "基础比例来自沿 GPX 路线走廊采样的 OpenStreetMap 道路标签。缺少地图匹配的区段标记为“未映射 / 非步道”，并不证明当地没有步道。泥泞、冰雪与岩石湿滑程度是基于逐月天气的规划代理，并非地面实时观测。",
          )}
        </p>
      </div>
    </section>
  );
}
