"use client";

import { useEffect } from "react";
import { THEME_CHANGE_EVENT, type Track4TrekTheme } from "./theme-system";

type ResultScene = "terrain" | "metrics" | "elevation" | "weather" | "activity" | "notes";

const RESULT_SCENES = [
  { selector: "#terrain-result", scene: "terrain" },
  { selector: "#route-data", scene: "terrain" },
  { selector: "#metrics", scene: "metrics" },
  { selector: "#elevation", scene: "elevation" },
  { selector: "#weather", scene: "weather" },
  { selector: "#weather-data", scene: "weather" },
  { selector: "#post-activity", scene: "activity" },
  { selector: "#result-notes", scene: "notes" },
] as const satisfies ReadonlyArray<{ selector: string; scene: ResultScene }>;

const LANDSCAPE_CHANGE_EVENT = "track4trek:landscape-change";

function currentTheme(): Track4TrekTheme {
  return document.documentElement.dataset.track4trekTheme === "light" ? "light" : "dark";
}

function publishScene(scene: ResultScene) {
  const theme = currentTheme();
  const contourPalette = theme === "light" ? "Ink" : "Lime";
  document.documentElement.dataset.track4trekScene = scene;
  document.documentElement.dataset.track4trekContour = contourPalette;
  window.dispatchEvent(new CustomEvent(LANDSCAPE_CHANGE_EVENT, {
    detail: { contourPalette, scene, theme },
  }));
}

export function EnvironmentCycle() {
  useEffect(() => {
    const targets = RESULT_SCENES.flatMap(({ selector, scene }) => {
      const element = document.querySelector<HTMLElement>(selector);
      return element ? [{ element, scene }] : [];
    });
    let activeScene: ResultScene | null = null;
    let animationFrame: number | null = null;

    const updateScene = (force = false) => {
      const focusLine = window.innerHeight * 0.46;
      const nearest = targets.reduce<{
        scene: ResultScene;
        distance: number;
      } | null>((selected, target) => {
        const bounds = target.element.getBoundingClientRect();
        const distance =
          focusLine < bounds.top
            ? bounds.top - focusLine
            : focusLine > bounds.bottom
              ? focusLine - bounds.bottom
              : 0;

        return selected == null || distance < selected.distance
          ? { scene: target.scene, distance }
          : selected;
      }, null);
      const nextScene = nearest?.scene ?? "terrain";

      if (force || nextScene !== activeScene) {
        activeScene = nextScene;
        publishScene(nextScene);
      }
    };

    const scheduleUpdate = () => {
      if (animationFrame !== null) return;
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = null;
        updateScene();
      });
    };

    const handleThemeChange = () => updateScene(true);
    updateScene(true);
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);

    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return null;
}
