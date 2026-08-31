"use client";

import { useCallback, useEffect, useState } from "react";
import type { RoutePreview } from "../_lib/route-data";
import {
  buildUnavailableSurface,
  fetchRouteSurface,
  surfaceCacheKey,
  type RouteSurfaceData,
} from "../_lib/surface";

export type RouteSurfaceHookStatus =
  | "idle"
  | "loading"
  | "ready"
  | "partial"
  | "unavailable"
  | "error";

type CachedSurface = { expiresAt: number; data: RouteSurfaceData };
type InternalState = {
  key: string;
  status: RouteSurfaceHookStatus;
  data: RouteSurfaceData | null;
  error: string | null;
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, CachedSurface>();
const inFlight = new Map<string, Promise<RouteSurfaceData>>();

function cachedSurface(key: string) {
  const entry = cache.get(key);
  return entry && entry.expiresAt > Date.now() ? entry.data : null;
}

export function useRouteSurface(
  preview: RoutePreview | null,
  maximumPoints = 12,
) {
  const key = preview ? surfaceCacheKey(preview, maximumPoints) : "none";
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<InternalState>({
    key,
    status: preview ? "loading" : "idle",
    data: preview ? buildUnavailableSurface() : null,
    error: null,
  });
  const refresh = useCallback(() => {
    if (key !== "none") cache.delete(key);
    setRevision((value) => value + 1);
  }, [key]);

  useEffect(() => {
    if (!preview) return;
    const cached = revision === 0 ? cachedSurface(key) : null;
    if (cached) return;

    let disposed = false;
    let request = inFlight.get(key);
    if (!request) {
      request = fetchRouteSurface(preview, { maximumPoints });
      inFlight.set(key, request);
      request.finally(() => {
        if (inFlight.get(key) === request) inFlight.delete(key);
      }).catch(() => undefined);
    }

    request.then((data) => {
      if (disposed) return;
      cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
      setState({
        key,
        status: data.status,
        data,
        error: data.errors[0] ?? null,
      });
    }).catch((error: unknown) => {
      if (disposed) return;
      setState({
        key,
        status: "error",
        data: buildUnavailableSurface(
          error instanceof Error ? error.message : "Surface data is unavailable.",
        ),
        error: error instanceof Error ? error.message : "Surface data is unavailable.",
      });
    });
    return () => {
      disposed = true;
    };
  }, [key, maximumPoints, preview, revision]);

  if (!preview) {
    return { status: "idle" as const, data: null, error: null, refresh };
  }
  const cached = revision === 0 ? cachedSurface(key) : null;
  if (cached) {
    return {
      status: cached.status,
      data: cached,
      error: cached.errors[0] ?? null,
      refresh,
    };
  }
  if (state.key !== key) {
    return {
      status: "loading" as const,
      data: buildUnavailableSurface(),
      error: null,
      refresh,
    };
  }
  return { ...state, refresh };
}
