"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useLanguage } from "../_components/language-system";
import { usePageTransition } from "../_components/page-transition";
import { TransitionLink } from "../_components/transition-link";

export default function AnalyzingPage() {
  const transitionTo = usePageTransition();
  const { text } = useLanguage();
  const [progress, setProgress] = useState(0);
  const stages = [
    text("Reading route", "正在读取路线"),
    text("Sampling elevation", "正在采样海拔"),
    text("Tracing climbs", "正在分析爬升"),
    text("Checking conditions", "正在检查环境条件"),
    text("Preparing preview", "正在生成预览"),
  ];

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const increment = reducedMotion ? 25 : 2;
    const interval = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 100) {
          window.clearInterval(interval);
          return 100;
        }
        return Math.min(100, current + increment);
      });
    }, 70);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (progress !== 100) return;
    const comparisonPane = new URLSearchParams(window.location.search).get("compare-pane");
    const destination = comparisonPane === "right"
      ? "/results?compare-pane=right"
      : "/results";
    const redirect = window.setTimeout(() => transitionTo(destination), 500);
    return () => window.clearTimeout(redirect);
  }, [progress, transitionTo]);

  const stageIndex = Math.min(stages.length - 1, Math.floor(progress / 20));
  const stage = progress === 100 ? text("Route ready", "路线已就绪") : stages[stageIndex];
  const progressStyle = { "--analysis-progress": `${progress}%` } as CSSProperties;

  return (
    <main className="site-page analysis-page simplified-analysis" id="main-content">
      <a className="skip-link" href="#analysis-progress">
        {text("Skip to progress", "跳至分析进度")}
      </a>
      <section className="simple-loading" aria-labelledby="analysis-title">
        <div
          className="simple-progress"
          id="analysis-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-label={text("Route preview progress", "路线预览进度")}
          style={progressStyle}
        >
          <div className="simple-progress-core">
            <strong>{progress}</strong>
            <span>%</span>
          </div>
          <i className="progress-orbit orbit-a" aria-hidden="true" />
          <i className="progress-orbit orbit-b" aria-hidden="true" />
        </div>

        <div className="simple-loading-copy">
          <h1 id="analysis-title">
            {progress === 100
              ? text("Preview ready.", "预览已就绪。")
              : text("Reading the route.", "正在读取路线。")}
          </h1>
          <p aria-live="polite">{stage}</p>
        </div>

        <div className="simple-loading-actions">
          <TransitionLink
            href="/"
            onClick={(event) => {
              const comparisonPane = new URLSearchParams(window.location.search).get("compare-pane");
              if (comparisonPane !== "right") return;
              event.preventDefault();
              transitionTo("/?compare-pane=right");
            }}
          >
            {text("Cancel", "取消")}
          </TransitionLink>
        </div>

        <p className="visually-hidden">
          {text(
            "Uploaded GPX data is read locally in the browser before the preview is shown.",
            "上传的 GPX 数据会先在浏览器本地读取，然后生成预览。",
          )}
        </p>
      </section>
    </main>
  );
}
