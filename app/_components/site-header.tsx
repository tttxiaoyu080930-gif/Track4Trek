"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  readRoutePreview,
  ROUTE_COMPARISON_LEFT_STORAGE_KEY,
  ROUTE_PREVIEW_STORAGE_KEY,
  saveRoutePreview,
} from "../_lib/route-data";
import { LanguageToggle, useLanguage } from "./language-system";
import { TransitionLink } from "./transition-link";
import { ThemeToggle } from "./theme-system";

type SiteHeaderProps = {
  active?: "plan" | "results";
  minimal?: boolean;
  homeHint?: string;
  comparisonActive?: boolean;
  onComparisonToggle?: () => void;
  onHomeNavigate?: () => void;
};

function ComparisonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2.75" y="4.25" width="7.25" height="15.5" rx="2" />
      <rect x="14" y="4.25" width="7.25" height="15.5" rx="2" />
      <path d="M11.75 8.5h.5m-.5 7h.5" />
    </svg>
  );
}

function restorePrimaryRouteFromComparison() {
  const leftPreview = readRoutePreview(ROUTE_COMPARISON_LEFT_STORAGE_KEY);
  if (leftPreview) saveRoutePreview(leftPreview);
}

export function SiteHeader({
  active,
  minimal = false,
  homeHint = "Analyse a new route",
  comparisonActive = false,
  onComparisonToggle,
  onHomeNavigate,
}: SiteHeaderProps) {
  const { text } = useLanguage();
  const translatedHomeHint = text(
    homeHint,
    {
      "Analyse a new route": "分析新路线",
      "Upload and analyse a route": "上传并分析路线",
      "Return to route setup": "返回路线设置",
    }[homeHint] ?? homeHint,
  );

  return (
    <header className={`site-header${minimal ? " is-minimal" : ""}`}>
      <TransitionLink
        className="site-brand"
        href="/"
        onClick={onHomeNavigate}
        aria-label={text(`Track4Trek home. ${homeHint}`, `Track4Trek 首页。${translatedHomeHint}`)}
      >
        <span className="brand-orbit" aria-hidden="true">
          <i />
        </span>
        <span className="brand-copy">
          <span className="brand-wordmark">Track<span>4</span>Trek</span>
          <small>{translatedHomeHint}</small>
        </span>
      </TransitionLink>

      {!minimal && (
        <nav className="header-nav" aria-label={text("Main navigation", "主导航")}>
          <TransitionLink href="/#route-input" aria-current={active === "plan" ? "page" : undefined}>
            {text("Plan a route", "规划路线")}
          </TransitionLink>
          <TransitionLink href="/results" aria-current={active === "results" ? "page" : undefined}>
            {text("Result preview", "结果预览")}
          </TransitionLink>
        </nav>
      )}

      <div className="header-controls">
        {onComparisonToggle ? (
          <button
            className={`route-comparison-toggle${comparisonActive ? " is-active" : ""}`}
            type="button"
            aria-pressed={comparisonActive}
            aria-label={text(
              comparisonActive ? "Close route comparison" : "Compare with another route",
              comparisonActive ? "关闭路线对比" : "与另一条路线对比",
            )}
            title={text(
              comparisonActive ? "Close route comparison" : "Compare routes",
              comparisonActive ? "关闭路线对比" : "对比路线",
            )}
            onClick={onComparisonToggle}
          >
            <ComparisonIcon />
          </button>
        ) : null}
        <LanguageToggle />
        <ThemeToggle />
      </div>
    </header>
  );
}

export function PersistentSiteHeader() {
  const pathname = usePathname();
  const { text } = useLanguage();
  const isResults = pathname === "/results";
  const isAnalyzing = pathname === "/analyzing";
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [leftRouteName, setLeftRouteName] = useState("");
  const [rightRouteName, setRightRouteName] = useState("");

  useEffect(() => {
    document.documentElement.classList.toggle("is-comparison-open", isComparisonOpen);
    if (!isComparisonOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      restorePrimaryRouteFromComparison();
      setIsComparisonOpen(false);
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== ROUTE_PREVIEW_STORAGE_KEY) return;
      setRightRouteName(readRoutePreview()?.fileName ?? "");
    };
    const handlePopState = () => {
      restorePrimaryRouteFromComparison();
      setIsComparisonOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.documentElement.classList.remove("is-comparison-open");
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isComparisonOpen]);

  function toggleComparison() {
    if (isComparisonOpen) {
      restorePrimaryRouteFromComparison();
      setIsComparisonOpen(false);
      return;
    }

    const currentPreview = readRoutePreview();
    if (!currentPreview) return;
    saveRoutePreview(currentPreview, ROUTE_COMPARISON_LEFT_STORAGE_KEY);
    const savedPreview = readRoutePreview(ROUTE_COMPARISON_LEFT_STORAGE_KEY);
    if (!savedPreview) return;
    setLeftRouteName(savedPreview.fileName);
    setRightRouteName("");
    setIsComparisonOpen(true);
  }

  return (
    <>
      <SiteHeader
        active={isResults ? "results" : "plan"}
        minimal
        homeHint={
          isResults
            ? "Analyse a new route"
            : isAnalyzing
              ? "Return to route setup"
              : "Upload and analyse a route"
        }
        comparisonActive={isComparisonOpen}
        onComparisonToggle={isResults ? toggleComparison : undefined}
        onHomeNavigate={() => {
          if (isComparisonOpen) restorePrimaryRouteFromComparison();
          setIsComparisonOpen(false);
        }}
      />

      {isComparisonOpen ? (
        <section
          className="route-comparison-workspace"
          aria-label={text("Side-by-side route comparison", "并排路线对比")}
        >
          <div className="route-comparison-track">
            <article className="route-comparison-pane">
              <header>
                <span>{text("Route A", "路线 A")}</span>
                <strong>{leftRouteName}</strong>
              </header>
              <iframe
                src="/results?compare-pane=left"
                title={text("Current route result", "当前路线结果")}
              />
            </article>

            <article className="route-comparison-pane">
              <header>
                <span>{text("Route B", "路线 B")}</span>
                <strong>
                  {rightRouteName || text("Choose and analyse another route", "选择并分析另一条路线")}
                </strong>
              </header>
              <iframe
                src="/?compare-pane=right"
                title={text("Choose comparison route", "选择对比路线")}
              />
            </article>
          </div>
        </section>
      ) : null}
    </>
  );
}
