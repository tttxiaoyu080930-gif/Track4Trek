import type { CSSProperties } from "react";

type DemandDialProps = {
  label: string;
  range: string;
  descriptor: string;
  start: number;
  end: number;
  tone?: "orange" | "gold" | "lime" | "cyan" | "magenta";
  unit?: string;
  reason: string;
};

export function DemandDial({
  label,
  range,
  descriptor,
  start,
  end,
  tone = "orange",
  unit = "Suggested range",
  reason,
}: DemandDialProps) {
  const style = {
    "--dial-angle": `${-135 + (end / 100) * 270}deg`,
    "--dial-range-start-sweep": `${start * 2.7}deg`,
    "--dial-range-end-sweep": `${end * 2.7}deg`,
  } as CSSProperties;

  return (
    <article className={`demand-card tone-${tone}`}>
      <div className="watch-demand-dial" style={style} aria-hidden="true">
        <div className="dial-segments" />
        <div className="watch-range-indicator" />
        <i className="watch-score-marker" />
        <div className="watch-face">
          <span className="watch-label">{label}</span>
          <span className="watch-range">{range}</span>
          <strong className="watch-descriptor">{descriptor}</strong>
          <span className="watch-unit">{unit}</span>
        </div>
      </div>
      <p className="visually-hidden">
        {label}: recommended range {range}, {descriptor}. {reason}
      </p>
    </article>
  );
}
