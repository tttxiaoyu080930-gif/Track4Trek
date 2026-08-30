import type { CSSProperties } from "react";
import { useLanguage } from "./language-system";

export type DemandDialProps = {
  metricId: string;
  label: string;
  range: string;
  descriptor: string;
  start: number;
  end: number;
  tone?: "orange" | "gold" | "lime" | "cyan" | "magenta";
  unit?: string;
  reason: string;
  estimateStatus?: "loading" | "missing" | "estimated" | "outside-model" | "unavailable";
};

export function DemandDial({
  metricId,
  label,
  range,
  descriptor,
  start,
  end,
  tone = "orange",
  unit,
  reason,
  estimateStatus = "estimated",
}: DemandDialProps) {
  const { text } = useLanguage();
  const displayedUnit = unit ?? text("Suggested range", "建议范围");
  const safeStart = Number.isFinite(start) ? Math.min(Math.max(start, 0), 100) : 0;
  const safeEnd = Number.isFinite(end) ? Math.min(Math.max(end, safeStart), 100) : safeStart;
  const style = {
    "--dial-range-start-sweep": `${safeStart * 2.7}deg`,
    "--dial-range-end-sweep": `${safeEnd * 2.7}deg`,
  } as CSSProperties;

  return (
    <article
      className={`demand-card tone-${tone}`}
      data-metric-id={metricId}
      data-estimate-status={estimateStatus}
      data-range-value={range}
      data-range-start={safeStart}
      data-range-end={safeEnd}
      aria-busy={estimateStatus === "loading" ? true : undefined}
    >
      <div className="watch-demand-dial" style={style} aria-hidden="true">
        <div className="dial-segments" />
        <div className="watch-range-indicator" />
        <div className="watch-face">
          <span className="watch-label">{label}</span>
          <span className="watch-range">{range}</span>
          <strong className="watch-descriptor">{descriptor}</strong>
          <span className="watch-unit">{displayedUnit}</span>
        </div>
      </div>
      <p className="visually-hidden">
        {text(
          `${label}: recommended range ${range}, ${descriptor}. ${reason}`,
          `${label}：建议范围为 ${range}，等级为${descriptor}。${reason}`,
        )}
      </p>
    </article>
  );
}
