"use client";

import { usePathname } from "next/navigation";
import { LanguageToggle, useLanguage } from "./language-system";
import { TransitionLink } from "./transition-link";
import { ThemeToggle } from "./theme-system";

type SiteHeaderProps = {
  active?: "plan" | "results";
  minimal?: boolean;
  homeHint?: string;
};

export function SiteHeader({ active, minimal = false, homeHint = "Analyse a new route" }: SiteHeaderProps) {
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
        <LanguageToggle />
        <ThemeToggle />
      </div>
    </header>
  );
}

export function PersistentSiteHeader() {
  const pathname = usePathname();
  const isResults = pathname === "/results";
  const isAnalyzing = pathname === "/analyzing";

  return (
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
    />
  );
}
