"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { SiteHeader } from "../_components/site-header";
import { usePageTransition } from "../_components/page-transition";
import { TransitionLink } from "../_components/transition-link";

const stages = [
  "Reading route",
  "Sampling elevation",
  "Tracing climbs",
  "Checking conditions",
  "Preparing preview",
];

export default function AnalyzingPage() {
  const transitionTo = usePageTransition();
  const [progress, setProgress] = useState(0);

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
    const redirect = window.setTimeout(() => transitionTo("/results"), 500);
    return () => window.clearTimeout(redirect);
  }, [progress, transitionTo]);

  const stageIndex = Math.min(stages.length - 1, Math.floor(progress / 20));
  const stage = progress === 100 ? "Route ready" : stages[stageIndex];
  const progressStyle = { "--analysis-progress": `${progress}%` } as CSSProperties;

  return (
    <main className="site-page analysis-page simplified-analysis" id="main-content">
      <a className="skip-link" href="#analysis-progress">Skip to progress</a>
      <SiteHeader active="plan" minimal />

      <section className="simple-loading" aria-labelledby="analysis-title">
        <div className="loading-atmosphere" aria-hidden="true" />
        <div
          className="simple-progress"
          id="analysis-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-label="Route preview progress"
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
          <h1 id="analysis-title">{progress === 100 ? "Preview ready." : "Reading the route."}</h1>
          <p aria-live="polite">{stage}</p>
        </div>

        <div className="simple-loading-actions">
          <TransitionLink href="/">Cancel</TransitionLink>
        </div>

        <p className="visually-hidden">Phase 1 is a visual simulation and does not analyse route data.</p>
      </section>
    </main>
  );
}
