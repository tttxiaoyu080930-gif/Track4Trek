"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import darkScenery from "../../public/track4trek-scenery-dark.png";
import lightScenery from "../../public/track4trek-scenery-light.png";
import { useLanguage } from "./language-system";

export type Track4TrekTheme = "dark" | "light";

export const THEME_CHANGE_EVENT = "track4trek:theme-change";
const THEME_STORAGE_KEY = "track4trek:theme";

function applyTheme(theme: Track4TrekTheme) {
  document.documentElement.dataset.track4trekTheme = theme;
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: { theme } }));
}

export function SiteScenery() {
  const pathname = usePathname();

  useEffect(() => {
    document.documentElement.dataset.track4trekPage =
      pathname === "/results" ? "results" : pathname === "/analyzing" ? "analysis" : "landing";

    if (pathname !== "/results") {
      document.documentElement.dataset.track4trekScene =
        pathname === "/analyzing" ? "analysis" : "landing";
    }
  }, [pathname]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      document.documentElement.dataset.track4trekTheme =
        event.newValue === "light" ? "light" : "dark";
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return (
    <div className="site-scenery" aria-hidden="true">
      <Image
        className="site-scenery-image site-scenery-dark"
        src={darkScenery}
        alt=""
        fill
        sizes="100vw"
        placeholder="blur"
        priority
      />
      <Image
        className="site-scenery-image site-scenery-light"
        src={lightScenery}
        alt=""
        fill
        sizes="100vw"
        placeholder="blur"
        priority
      />
      <span className="site-scenery-veil" />
    </div>
  );
}

export function ThemeToggle() {
  const { text } = useLanguage();
  const [theme, setTheme] = useState<Track4TrekTheme>("dark");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const initialTheme: Track4TrekTheme = savedTheme === "light" ? "light" : "dark";
    const timer = window.setTimeout(() => {
      setTheme(initialTheme);
      applyTheme(initialTheme);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <button
      className="theme-toggle"
      type="button"
      role="switch"
      aria-checked={theme === "light"}
      aria-label={
        nextTheme === "light"
          ? text("Use light mode", "切换至浅色模式")
          : text("Use dark mode", "切换至深色模式")
      }
      title={
        nextTheme === "light"
          ? text("Use light mode", "切换至浅色模式")
          : text("Use dark mode", "切换至深色模式")
      }
      onClick={() => {
        setTheme(nextTheme);
        applyTheme(nextTheme);
      }}
    >
      <span className="theme-toggle-track" aria-hidden="true">
        <i className="theme-toggle-thumb">
          <svg className="theme-icon theme-icon-moon" viewBox="0 0 24 24">
            <path d="M19.2 15.2A7.7 7.7 0 0 1 8.8 4.8 7.8 7.8 0 1 0 19.2 15.2Z" />
          </svg>
          <svg className="theme-icon theme-icon-sun" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        </i>
      </span>
      <span className="visually-hidden">
        {theme === "dark"
          ? text("Dark mode active", "当前为深色模式")
          : text("Light mode active", "当前为浅色模式")}
      </span>
    </button>
  );
}
