"use client";

import { CSSProperties, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SiteHeader } from "../_components/site-header";

const stages = [
  "Reading route",
  "Sampling elevation",
  "Summarising climbs",
  "Checking planned conditions",
  "Preparing results",
];

export default function AnalyzingPage() {
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
    }, reducedMotion ? 80 : 70);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (progress !== 100) return;
    const redirect = window.setTimeout(() => window.location.assign("/results"), 1400);
    return () => window.clearTimeout(redirect);
  }, [progress]);

  const activeStage = useMemo(
    () => Math.min(stages.length - 1, Math.floor(progress / 20)),
    [progress],
  );

  const progressStyle = {
    "--analysis-progress": `${progress}%`,
  } as CSSProperties;

  return (
    <main className="site-page analysis-page" id="main-content">
      <a className="skip-link" href="#analysis-progress">Skip to analysis status</a>
      <SiteHeader active="plan" />

      <section className="analysis-shell" aria-labelledby="analysis-title">
        <div className="analysis-copy">
          <p className="prototype-kicker"><span aria-hidden="true" /> Visual prototype</p>
          <h1 id="analysis-title">Building your route preview</h1>
          <p>
            Showing how Track4Trek will turn route and trip details into a clear result.
          </p>
          <p className="prototype-note">No route data is being analysed in Phase 1.</p>
        </div>

        <div className="analysis-console" id="analysis-progress">
          <div
            className="progress-dial"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-label="Route preview progress"
            style={progressStyle}
          >
            <div className="progress-dial-inner">
              <strong>{progress}</strong>
              <span>percent</span>
            </div>
          </div>

          <div className="analysis-status">
            <div className="status-heading">
              <span>Preview sequence</span>
              <strong aria-live="polite">
                {progress === 100 ? "Preview ready" : stages[activeStage]}
              </strong>
            </div>
            <ol className="stage-list">
              {stages.map((stage, index) => {
                const state = progress === 100 || index < activeStage
                  ? "complete"
                  : index === activeStage
                    ? "active"
                    : "pending";
                return (
                  <li className={state} key={stage}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{stage}</strong>
                    <i aria-hidden="true" />
                  </li>
                );
              })}
            </ol>
          </div>
        </div>

        <div className="analysis-actions">
          <Link href="/" className="quiet-link">Cancel preview</Link>
          {progress === 100 ? (
            <Link className="primary-action" href="/results" autoFocus>
              View results now <span aria-hidden="true">↗</span>
            </Link>
          ) : (
            <button className="quiet-button" type="button" onClick={() => setProgress(100)}>
              Skip animation
            </button>
          )}
        </div>
        <p className="redirect-note">
          {progress === 100
            ? "Opening the result preview automatically…"
            : "The result preview opens automatically at 100%."}
        </p>
      </section>
    </main>
  );
}
