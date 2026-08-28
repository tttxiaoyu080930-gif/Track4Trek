"use client";

import { useEffect, useState } from "react";

const LANDSCAPE_SCENES = [
  { src: "/result-bg-alpine-hd.webp", contourPalette: "Lime" },
  { src: "/result-bg-snow-hd.webp", contourPalette: "Ink" },
  { src: "/result-bg-forest-hd.webp", contourPalette: "Ice" },
  { src: "/result-bg-mist-hd.webp", contourPalette: "Amber" },
  { src: "/result-bg-jungle-hd.webp", contourPalette: "Magenta" },
  { src: "/result-bg-autumn-hd.webp", contourPalette: "Ice" },
  { src: "/result-bg-coast-hd.webp", contourPalette: "Amber" },
  { src: "/result-bg-ocean-hd.webp", contourPalette: "Ink" },
  { src: "/result-bg-desert-hd.webp", contourPalette: "Ink" },
  { src: "/result-bg-canyon-hd.webp", contourPalette: "Ink" },
  { src: "/result-bg-volcano-hd.webp", contourPalette: "Lime" },
  { src: "/result-bg-highland-hd.webp", contourPalette: "Ink" },
] as const;

const LANDSCAPE_CHANGE_EVENT = "track4trek:landscape-change";

export function EnvironmentCycle() {
  const [frame, setFrame] = useState<{ currentIndex: number; previousIndex: number | null }>({
    currentIndex: 0,
    previousIndex: null,
  });

  useEffect(() => {
    const nextImage = new Image();
    nextImage.src = LANDSCAPE_SCENES[(frame.currentIndex + 1) % LANDSCAPE_SCENES.length].src;
  }, [frame.currentIndex]);

  useEffect(() => {
    const scene = LANDSCAPE_SCENES[frame.currentIndex];
    document.documentElement.dataset.track4trekContour = scene.contourPalette;
    window.dispatchEvent(new CustomEvent(LANDSCAPE_CHANGE_EVENT, {
      detail: { contourPalette: scene.contourPalette },
    }));
  }, [frame.currentIndex]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const interval = window.setInterval(() => {
      setFrame(({ currentIndex }) => ({
        previousIndex: currentIndex,
        currentIndex: (currentIndex + 1) % LANDSCAPE_SCENES.length,
      }));
    }, 7000);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="environment-cycle" aria-hidden="true">
      {frame.previousIndex !== null ? (
        <i
          className="environment-scene environment-scene-previous"
          key={`previous-${frame.previousIndex}`}
          style={{ backgroundImage: `url("${LANDSCAPE_SCENES[frame.previousIndex].src}")` }}
        />
      ) : null}
      <i
        className="environment-scene environment-scene-current"
        key={`current-${frame.currentIndex}`}
        style={{ backgroundImage: `url("${LANDSCAPE_SCENES[frame.currentIndex].src}")` }}
      />
    </div>
  );
}
