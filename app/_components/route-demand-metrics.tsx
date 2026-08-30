"use client";

import type {
  EnduranceCategory,
  HillCategory,
  RouteDemandAnalysis,
  Vo2Category,
} from "../_lib/route-demand";
import { DemandDial, type DemandDialProps } from "./demand-dial";
import { useLanguage } from "./language-system";

export type AnalysisDisplayStatus = "loading" | "missing" | "ready";

type RouteDemandMetricsProps = {
  status: AnalysisDisplayStatus;
  analysis: RouteDemandAnalysis | null;
};

function formatPace(value: number) {
  const totalSeconds = Math.max(Math.round(value * 60), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function RouteDemandMetrics({ status, analysis }: RouteDemandMetricsProps) {
  const { language, text } = useLanguage();
  const number = new Intl.NumberFormat(language === "zh" ? "zh-CN" : "en-US");

  const hillCategory = (category: HillCategory) => ({
    recreational: text("Recreational", "休闲"),
    challenger: text("Challenger", "挑战者"),
    trained: text("Trained", "受训"),
    skilled: text("Skilled", "熟练"),
    expert: text("Expert", "专家"),
    elite: text("Elite", "精英"),
  })[category];

  const enduranceCategory = (category: EnduranceCategory) => ({
    recreational: text("Recreational", "休闲"),
    intermediate: text("Intermediate", "进阶"),
    trained: text("Trained", "受训"),
    "well-trained": text("Well trained", "训练有素"),
    expert: text("Expert", "专家"),
    superior: text("Superior", "卓越"),
    elite: text("Elite", "精英"),
  })[category];

  const vo2Category = (category: Vo2Category) => ({
    poor: text("Poor reference", "较低参考"),
    fair: text("Fair reference", "一般参考"),
    good: text("Good reference", "良好参考"),
    excellent: text("Excellent reference", "优秀参考"),
    superior: text("Superior reference", "卓越参考"),
    "reference-unavailable": text("Route requirement", "路线需求"),
  })[category];

  const placeholder = (
    metricId: string,
    label: string,
    tone: "orange" | "gold" | "cyan" | "magenta",
  ) => ({
    metricId,
    label,
    range: status === "loading" ? "…" : "—",
    descriptor: status === "loading"
      ? text("Reading route", "正在读取路线")
      : text("No route data", "没有路线数据"),
    start: 0,
    end: 0,
    tone,
    unit: text("Local route estimate", "本地路线估算"),
    reason: status === "loading"
      ? text("The saved route is being analysed.", "正在分析已保存的路线。")
      : text("Analyse a route to calculate this range.", "请先分析一条路线以计算该范围。"),
    estimateStatus: status as "loading" | "missing",
  });

  let demands: DemandDialProps[];
  if (status !== "ready" || !analysis || analysis.status === "insufficient-route") {
    const placeholderStatus = status === "loading" ? "loading" : "missing";
    demands = [
      placeholder("hill-score", text("Hill score", "爬坡评分"), "orange"),
      placeholder("endurance-score", text("Endurance score", "耐力分数"), "gold"),
      placeholder("vo2-max", text("VO₂ max", "最大摄氧量"), "cyan"),
      placeholder("lactate-threshold", text("Lactate threshold", "乳酸阈值"), "magenta"),
    ].map((demand) => ({ ...demand, estimateStatus: placeholderStatus }));
  } else {
    const { hill, endurance, vo2Max, lactateThreshold } = analysis.metrics;
    const sexLabel = analysis.profile.sex === "male"
      ? text("Male", "男性")
      : text("Female", "女性");

    const hillDial = hill.status === "unavailable"
      ? {
          metricId: "hill-score",
          label: text("Hill score", "爬坡评分"),
          range: "—",
          descriptor: text("Elevation needed", "需要海拔数据"),
          start: 0,
          end: 0,
          tone: "orange" as const,
          unit: text("GPX elevation required", "需要 GPX 海拔数据"),
          reason: text(
            "Hill capability cannot be estimated without an elevation profile.",
            "没有海拔剖面时，无法估算爬坡能力需求。",
          ),
          estimateStatus: "unavailable" as const,
        }
      : {
          metricId: "hill-score",
          label: text("Hill score", "爬坡评分"),
          range: `${Math.round(hill.low)}–${Math.round(hill.high)}`,
          descriptor: hillCategory(hill.category),
          start: hill.dial.startPct,
          end: hill.dial.endPct,
          tone: "orange" as const,
          unit: text("Track4Trek requirement · 1–100", "Track4Trek 需求 · 1–100"),
          reason: text(
            "Route terrain is mapped to Garmin’s published category bands. This is not your Garmin Hill Score.",
            "路线地形被映射至 Garmin 公布的分级区间；这不是你的 Garmin 爬坡评分。",
          ),
          estimateStatus: hill.status,
        };

    const enduranceDial = endurance.status === "unavailable"
      ? {
          metricId: "endurance-score",
          label: text("Endurance score", "耐力分数"),
          range: "—",
          descriptor: enduranceCategory(endurance.category),
          start: 0,
          end: 0,
          tone: "gold" as const,
          unit: text("Garmin reference begins at age 18", "Garmin 参考表从 18 岁开始"),
          reason: text(
            "The route-load category is available, but Garmin publishes no numeric reference for this age.",
            "路线负荷等级已计算，但 Garmin 未公布该年龄的数值参考。",
          ),
          estimateStatus: "unavailable" as const,
        }
      : {
          metricId: "endurance-score",
          label: text("Endurance score", "耐力分数"),
          range: endurance.rangeKind === "less-than"
            ? `≤${number.format(endurance.referenceHigh ?? endurance.high)}`
            : endurance.rangeKind === "at-least"
              ? `≥${number.format(endurance.referenceLow ?? endurance.low)}`
              : `${number.format(endurance.referenceLow ?? endurance.low)}–${number.format(endurance.referenceHigh ?? endurance.high)}`,
          descriptor: enduranceCategory(endurance.category),
          start: endurance.dial.startPct,
          end: endurance.dial.endPct,
          tone: "gold" as const,
          unit: `${sexLabel} · ${endurance.ageBand}`,
          reason: text(
            "Track4Trek maps route duration and energy to this published reference category. It is not your Garmin Endurance Score.",
            "Track4Trek 将路线时长与能量映射至该公开参考等级；这不是你的 Garmin 耐力分数。",
          ),
          estimateStatus: endurance.status,
        };

    const vo2Dial = {
      metricId: "vo2-max",
      label: text("VO₂ max", "最大摄氧量"),
      range: `${vo2Max.low.toFixed(1)}–${vo2Max.high.toFixed(1)}`,
      descriptor: vo2Category(vo2Max.category),
      start: vo2Max.dial.startPct,
      end: vo2Max.dial.endPct,
      tone: "cyan" as const,
      unit: text("mL/kg/min · route capacity", "mL/kg/min · 路线能力需求"),
      reason: text(
        "Estimated oxygen capacity required for the route and target time, not a measurement of your VO₂ max.",
        "这是路线与目标时间所需摄氧能力的估算，并非对你最大摄氧量的测量。",
      ),
      estimateStatus: vo2Max.status,
    };

    const lactateDial = lactateThreshold.status === "unavailable"
      ? {
          metricId: "lactate-threshold",
          label: text("Lactate threshold", "乳酸阈值"),
          range: "—",
          descriptor: analysis.activity === "trail-run"
            ? text("Longer run needed", "需要更长的跑步时间")
            : text("Trail running only", "仅适用于越野跑"),
          start: 0,
          end: 0,
          tone: "magenta" as const,
          unit: text("Measured pace or LTHR preferred", "建议使用实测配速或阈值心率"),
          reason: text(
            "Track4Trek only models a threshold-pace requirement for trail runs of at least 20 minutes.",
            "Track4Trek 仅为至少 20 分钟的越野跑估算阈值配速需求。",
          ),
          estimateStatus: "unavailable" as const,
        }
      : {
          metricId: "lactate-threshold",
          label: text("Lactate threshold", "乳酸阈值"),
          range: `${formatPace(lactateThreshold.low)}–${formatPace(lactateThreshold.high)}`,
          descriptor: text("Threshold pace", "阈值配速"),
          start: lactateThreshold.dial.startPct,
          end: lactateThreshold.dial.endPct,
          tone: "magenta" as const,
          unit: text("min/km · flat equivalent", "分钟/公里 · 平路等效"),
          reason: text(
            "Grade-adjusted route requirement. Compare it with a measured threshold pace; it is not a personal threshold test.",
            "这是坡度修正后的路线需求。请与实测阈值配速比较；它不是个人阈值测试。",
          ),
          estimateStatus: lactateThreshold.status,
        };

    demands = [hillDial, enduranceDial, vo2Dial, lactateDial];
  }

  return (
    <section
      className="demand-section result-story-section section-frame"
      id="metrics"
      aria-labelledby="demand-title"
      aria-busy={status === "loading"}
      data-route-demand-state={status}
      data-model-version={analysis?.modelVersion}
    >
      <h2 className="metrics-overlay-title result-story-title" id="demand-title">
        {text("Recommended Metric Ranges × Garmin", "建议体能指标范围 × Garmin")}
      </h2>

      <div className="demand-grid result-story-panel">
        {demands.map((demand) => <DemandDial key={demand.metricId} {...demand} />)}
      </div>

      <p className="visually-hidden" role="status" aria-live="polite">
        {status === "loading"
          ? text("Calculating route-demand ranges.", "正在计算路线需求范围。")
          : status === "missing"
            ? text("Analyse a route to calculate the metric ranges.", "请先分析路线以计算指标范围。")
            : text("Route-demand ranges calculated.", "路线需求范围已计算。")}
      </p>
    </section>
  );
}
