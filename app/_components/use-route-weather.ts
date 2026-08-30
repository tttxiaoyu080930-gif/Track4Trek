"use client";

import { useCallback, useEffect, useState } from "react";
import type { RoutePreview } from "../_lib/route-data";
import {
  buildFallbackWeather,
  fetchRouteWeather,
  weatherCacheKey,
  type RouteWeatherData,
  type WeatherFetchOptions,
} from "../_lib/weather";

export type RouteWeatherHookStatus =
  | "idle"
  | "loading"
  | "ready"
  | "partial"
  | "fallback"
  | "error";

export type RouteWeatherState = {
  status: RouteWeatherHookStatus;
  data: RouteWeatherData | null;
  error: string | null;
  /** Force a fresh request while preserving the currently displayed data. */
  refresh: () => void;
};

type UseRouteWeatherOptions = Pick<
  WeatherFetchOptions,
  "forecastDays" | "includeForecast" | "includeClimate" | "maxRoutePoints" | "timeoutMs"
> & {
  enabled?: boolean;
};

type CachedWeather = {
  expiresAt: number;
  data: RouteWeatherData;
};

type InternalWeatherState = RouteWeatherState & { key: string };

const CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map<string, CachedWeather>();
const inFlight = new Map<string, Promise<RouteWeatherData>>();

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function cacheStillValid(key: string) {
  const entry = cache.get(key);
  return entry && entry.expiresAt > Date.now() ? entry : null;
}

/**
 * Shared weather state for overview and Pro surfaces. Requests are keyed by
 * the route's stable content identity, not by object identity, so switching
 * modes does not duplicate provider calls.
 */
export function useRouteWeather(
  preview: RoutePreview | null,
  options: UseRouteWeatherOptions = {},
): RouteWeatherState {
  const enabled = options.enabled !== false;
  const forecastDays = options.forecastDays ?? 16;
  const includeForecast = options.includeForecast !== false;
  const includeClimate = options.includeClimate !== false;
  const maxRoutePoints = options.maxRoutePoints ?? 6;
  const timeoutMs = options.timeoutMs ?? 8000;
  const key = preview
    ? weatherCacheKey(preview, {
        forecastDays,
        includeForecast,
        includeClimate,
        maxRoutePoints,
      })
    : "none";
  const [revision, setRevision] = useState(0);
  const cachedAtRender = enabled && preview && revision === 0
    ? cacheStillValid(key)
    : null;
  const refresh = useCallback(() => {
    if (key !== "none") cache.delete(key);
    setRevision((value) => value + 1);
  }, [key, setRevision]);

  const [state, setState] = useState<InternalWeatherState>(() => ({
    status: !enabled || !preview ? "idle" : "loading",
    data: preview ? buildFallbackWeather(preview, maxRoutePoints) : null,
    error: null,
    refresh: () => undefined,
    key,
  }));

  useEffect(() => {
    if (!enabled || !preview) {
      return;
    }

    const fallback = buildFallbackWeather(preview, maxRoutePoints);
    const cached = revision === 0 ? cacheStillValid(key) : null;
    if (cached) {
      return;
    }

    let disposed = false;
    let request = inFlight.get(key);
    if (!request) {
      request = fetchRouteWeather(preview, {
        forecastDays,
        includeForecast,
        includeClimate,
        maxRoutePoints,
        timeoutMs,
        // The request is shared across Overview and Pro. A component leaving
        // the tree must not abort the request for the remaining subscriber.
        signal: undefined,
      });
      inFlight.set(key, request);
      request.finally(() => {
        if (inFlight.get(key) === request) inFlight.delete(key);
      }).catch(() => undefined);
    }

    request.then((data) => {
      if (disposed) return;
      cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
      setState({
        status: data.status,
        data,
        error: data.errors[0] ?? null,
        refresh,
        key,
      });
    }).catch((error: unknown) => {
      if (disposed || isAbortError(error)) return;
      setState({
        status: "error",
        data: fallback,
        error: "Weather providers are unavailable.",
        refresh,
        key,
      });
    });

    return () => {
      disposed = true;
    };
  }, [enabled, forecastDays, includeClimate, includeForecast, key, maxRoutePoints, preview, refresh, revision, timeoutMs]);

  // The inactive state is derived during render so clearing a route does not
  // require a synchronous state write from inside the effect.
  if (!enabled || !preview) {
    return { status: "idle", data: null, error: null, refresh };
  }
  if (cachedAtRender) {
    return {
      status: cachedAtRender.data.status,
      data: cachedAtRender.data,
      error: cachedAtRender.data.errors[0] ?? null,
      refresh,
    };
  }
  if (state.key !== key) {
    return { status: "loading", data: buildFallbackWeather(preview, maxRoutePoints), error: null, refresh };
  }
  return { status: state.status, data: state.data, error: state.error, refresh };
}

export type { RouteWeatherData } from "../_lib/weather";
