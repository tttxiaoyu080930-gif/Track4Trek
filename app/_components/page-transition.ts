"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

export function usePageTransition() {
  const router = useRouter();

  return useCallback((href: string) => {
    const target = new URL(href, window.location.href);
    const sameDocument =
      target.pathname === window.location.pathname &&
      target.search === window.location.search;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (sameDocument || reducedMotion) {
      router.push(href);
      return;
    }

    const root = document.documentElement;
    if (root.classList.contains("is-route-leaving")) return;

    root.classList.add("is-route-leaving");
    window.setTimeout(() => router.push(href), 380);
    window.setTimeout(() => root.classList.remove("is-route-leaving"), 1600);
  }, [router]);
}
