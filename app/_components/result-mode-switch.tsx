"use client";

import { type ReactNode, useEffect, useState } from "react";
import { useLanguage } from "./language-system";

type ResultMode = "overview" | "pro";

type ResultModeSwitchProps = {
  children: ReactNode;
  proContent?: ReactNode;
};

export function ResultModeSwitch({ children, proContent }: ResultModeSwitchProps) {
  const { text } = useLanguage();
  const [mode, setMode] = useState<ResultMode>("overview");

  useEffect(() => {
    document.documentElement.dataset.track4trekResultMode = "overview";

    return () => {
      delete document.documentElement.dataset.track4trekResultMode;
    };
  }, []);

  function selectMode(nextMode: ResultMode) {
    if (nextMode === mode) return;

    setMode(nextMode);
    document.documentElement.dataset.track4trekResultMode = nextMode;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    window.scrollTo({
      top: 0,
      left: 0,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }

  return (
    <>
      <div className="result-mode-overview" hidden={mode !== "overview"}>
        {children}
      </div>

      <div className="result-mode-switch" data-result-mode={mode}>
        <p className="result-mode-switch-label">
          {text("Choose your result view", "选择结果视图")}
        </p>
        <div
          className="result-mode-options"
          role="group"
          aria-label={text("Result detail mode", "结果详细程度")}
        >
          <button
            className="result-mode-option"
            type="button"
            aria-pressed={mode === "overview"}
            onClick={() => selectMode("overview")}
          >
            <span>{text("Overview", "概览模式")}</span>
            <small>{text("Essential route guidance", "核心路线指引")}</small>
          </button>
          <button
            className="result-mode-option result-mode-option-pro"
            type="button"
            aria-pressed={mode === "pro"}
            onClick={() => selectMode("pro")}
          >
            <span>{text("Pro mode", "专业模式")}</span>
            <small>{text("Advanced outdoor analysis", "进阶户外分析")}</small>
          </button>
        </div>
      </div>

      {mode === "pro" ? (
        <section className="result-mode-pro" aria-labelledby="result-mode-pro-title">
          <h2 className="visually-hidden" id="result-mode-pro-title">
            {text("Pro mode", "专业模式")}
          </h2>
          {proContent ?? (
            <p className="pro-empty-state">
              {text("No route data is available yet.", "暂时没有可用的路线数据。")}
            </p>
          )}
        </section>
      ) : null}
    </>
  );
}
