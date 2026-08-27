import type { CSSProperties } from "react";

type DemandDialProps = {
  label: string;
  range: string;
  descriptor: string;
  end: number;
  tone?: "orange" | "gold" | "lime";
  reason: string;
};

export function DemandDial({
  label,
  range,
  descriptor,
  end,
  tone = "orange",
  reason,
}: DemandDialProps) {
  const style = { "--dial-end": `${end}%` } as CSSProperties;

  return (
    <article className={`demand-card tone-${tone}`}>
      <div className="dial-label-row">
        <span>{label}</span>
        <i aria-hidden="true" />
      </div>
      <div className="demand-dial" style={style} aria-hidden="true">
        <div className="dial-ticks" />
        <div className="dial-center">
          <strong>{range}</strong>
          <span>of 100</span>
        </div>
      </div>
      <p className="dial-readable">
        <strong>{range} · {descriptor}</strong>
        <span>{reason}</span>
      </p>
    </article>
  );
}
