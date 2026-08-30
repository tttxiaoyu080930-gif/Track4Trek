"use client";

import type { RouteDemandAnalysis } from "../_lib/route-demand";
import { DemandDial, type DemandDialProps } from "./demand-dial";
import type { AnalysisDisplayStatus } from "./route-demand-metrics";
import { useLanguage } from "./language-system";

type PostActivityForecastProps = {
  status: AnalysisDisplayStatus;
  analysis: RouteDemandAnalysis | null;
};

export function PostActivityForecast({ status, analysis }: PostActivityForecastProps) {
  const { language, text } = useLanguage();
  const number = new Intl.NumberFormat(language === "zh" ? "zh-CN" : "en-US");
  const readyAnalysis = status === "ready" && analysis?.status === "estimated"
    ? analysis
    : null;
  const isReady = readyAnalysis != null;

  const forecastMetrics: DemandDialProps[] = readyAnalysis
    ? [
        {
          metricId: "active-calories",
          label: text("Active calories", "活动热量"),
          range: `${number.format(readyAnalysis.metrics.activeCalories.low)}–${number.format(readyAnalysis.metrics.activeCalories.high)}`,
          descriptor: text("Route energy", "路线能量"),
          start: readyAnalysis.metrics.activeCalories.dial.startPct,
          end: readyAnalysis.metrics.activeCalories.dial.endPct,
          tone: "orange" as const,
          unit: text("kcal · active estimate", "千卡 · 活动估算"),
          reason: text(
            "Calculated from route grade, distance, moving time, body mass, pack mass and activity type.",
            "根据路线坡度、距离、移动时间、体重、背包重量与活动类型计算。",
          ),
          estimateStatus: readyAnalysis.metrics.activeCalories.status,
        },
        {
          metricId: "recovery-time",
          label: text("Recovery time", "恢复时间"),
          range: `${readyAnalysis.metrics.recovery.low}–${readyAnalysis.metrics.recovery.high}`,
          descriptor: text("Recovery window", "恢复区间"),
          start: readyAnalysis.metrics.recovery.dial.startPct,
          end: readyAnalysis.metrics.recovery.dial.endPct,
          tone: "lime" as const,
          unit: text("hours · route-load estimate", "小时 · 路线负荷估算"),
          reason: text(
            "A conservative Track4Trek route-load window. Heart rate, training history, sleep and stress are not available.",
            "这是 Track4Trek 基于路线负荷给出的保守区间；目前没有心率、训练历史、睡眠与压力数据。",
          ),
          estimateStatus: readyAnalysis.metrics.recovery.status,
        },
      ]
    : [
        {
          metricId: "active-calories",
          label: text("Active calories", "活动热量"),
          range: status === "loading" ? "…" : "—",
          descriptor: status === "loading"
            ? text("Reading route", "正在读取路线")
            : text("No route data", "没有路线数据"),
          start: 0,
          end: 0,
          tone: "orange" as const,
          unit: text("Local route estimate", "本地路线估算"),
          reason: text(
            "Analyse a route to calculate active calories.",
            "请先分析路线以计算活动热量。",
          ),
          estimateStatus: status === "loading" ? "loading" as const : "missing" as const,
        },
        {
          metricId: "recovery-time",
          label: text("Recovery time", "恢复时间"),
          range: status === "loading" ? "…" : "—",
          descriptor: status === "loading"
            ? text("Reading route", "正在读取路线")
            : text("No route data", "没有路线数据"),
          start: 0,
          end: 0,
          tone: "lime" as const,
          unit: text("Local route estimate", "本地路线估算"),
          reason: text(
            "Analyse a route to calculate a recovery window.",
            "请先分析路线以计算恢复区间。",
          ),
          estimateStatus: status === "loading" ? "loading" as const : "missing" as const,
        },
      ];

  return (
    <section
      className="result-story-section activity-forecast-section section-frame"
      id="post-activity"
      aria-labelledby="post-activity-title"
      aria-busy={status === "loading"}
      data-route-demand-state={status}
      data-model-version={analysis?.modelVersion}
    >
      <h2 className="result-story-title activity-forecast-title" id="post-activity-title">
        {text("Post-activity forecast", "活动后预测")}
      </h2>

      <div className="result-story-panel activity-forecast-panel">
        <div className="activity-forecast-status" aria-hidden="true">
          <span>
            {isReady
              ? text("Route estimate", "路线估算")
              : status === "loading"
                ? text("Calculating", "正在计算")
                : text("Route needed", "需要路线")}
          </span>
          <span>{text("Recovery window", "恢复区间")}</span>
        </div>

        <div className="activity-forecast-grid">
          {forecastMetrics.map((metric) => (
            <DemandDial key={metric.metricId} {...metric} />
          ))}
        </div>

        <p className="activity-forecast-disclaimer">
          {isReady
            ? text(
                "Active calories use the saved activity, body and pack mass, route grade, distance and target moving time. Recovery is a broad Track4Trek route-load heuristic because heart rate, recent training, sleep, stress and current recovery are unavailable. These are not Garmin outputs, medical advice, or a readiness guarantee.",
                "活动热量使用已保存的活动类型、体重、背包重量、路线坡度、距离与目标移动时间。由于缺少心率、近期训练、睡眠、压力与当前恢复状态，恢复时间只是 Track4Trek 基于路线负荷给出的宽泛启发式区间。这些结果并非 Garmin 输出，也不构成医疗建议或体能恢复保证。",
              )
            : text(
                "Analyse a route to calculate these estimates. Track4Trek keeps the route and profile in this browser.",
                "请先分析一条路线以计算这些估算值。Track4Trek 会将路线与个人资料保存在此浏览器中。",
              )}
        </p>
      </div>
    </section>
  );
}
