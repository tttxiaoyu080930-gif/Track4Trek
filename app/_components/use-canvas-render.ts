"use client";

import { useEffect, useRef, type RefObject } from "react";
import { THEME_CHANGE_EVENT } from "./theme-system";

/** Keep observer subscriptions stable and paint at most once per display frame. */
export function useCanvasRender(canvasRef: RefObject<HTMLCanvasElement | null>, draw: () => void) {
  const drawRef = useRef(draw);
  const scheduleRef = useRef<() => void>(() => {});

  useEffect(() => {
    drawRef.current = draw;
    scheduleRef.current();
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame: number | null = null;
    let visible = true;
    const schedule = () => {
      if (frame !== null || !visible || document.hidden) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        if (visible && !document.hidden) drawRef.current();
      });
    };
    scheduleRef.current = schedule;
    const resize = new ResizeObserver(schedule);
    resize.observe(canvas);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) schedule();
    }, { rootMargin: "160px" });
    intersection.observe(canvas);
    window.addEventListener(THEME_CHANGE_EVENT, schedule);
    document.addEventListener("visibilitychange", schedule);
    schedule();
    return () => {
      scheduleRef.current = () => {};
      if (frame !== null) cancelAnimationFrame(frame);
      resize.disconnect();
      intersection.disconnect();
      window.removeEventListener(THEME_CHANGE_EVENT, schedule);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [canvasRef]);
}
