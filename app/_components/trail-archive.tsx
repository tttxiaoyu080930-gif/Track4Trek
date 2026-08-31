"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  type ArchivePlace,
  type ArchiveRoute,
} from "../_lib/trail-archive";
import {
  SAMPLE_ROUTES,
  type SampleRouteDefinition,
} from "../_lib/sample-routes";
import { useLanguage } from "./language-system";

type TrailArchiveProps = {
  open: boolean;
  disabled?: boolean;
  onClose: () => void;
  onSelectSample: (route: SampleRouteDefinition) => void;
  onSelectArchive: (route: ArchiveRoute) => Promise<void>;
};

type ArchiveError = "place-search" | "route-search" | "route-load" | null;

function archiveMetadata(route: ArchiveRoute) {
  return [route.reference, route.network?.toUpperCase(), route.distance]
    .filter(Boolean)
    .join(" · ");
}

export function TrailArchive({
  open,
  disabled = false,
  onClose,
  onSelectSample,
  onSelectArchive,
}: TrailArchiveProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { language, text } = useLanguage();
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<ArchivePlace[]>([]);
  const [routes, setRoutes] = useState<ArchiveRoute[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<ArchivePlace | null>(null);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [isSearchingRoutes, setIsSearchingRoutes] = useState(false);
  const [loadingRelationId, setLoadingRelationId] = useState<number | null>(null);
  const [error, setError] = useState<ArchiveError>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  async function searchPlaces(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) return;
    setError(null);
    setSelectedPlace(null);
    setRoutes([]);
    setIsSearchingPlaces(true);
    try {
      const response = await fetch(`/api/trail/archive/places?q=${encodeURIComponent(normalizedQuery)}`);
      if (!response.ok) throw new Error(`Place search returned ${response.status}`);
      const payload = await response.json() as { places?: ArchivePlace[] };
      setPlaces(Array.isArray(payload.places) ? payload.places : []);
    } catch {
      setPlaces([]);
      setError("place-search");
    } finally {
      setIsSearchingPlaces(false);
    }
  }

  async function selectPlace(place: ArchivePlace) {
    setSelectedPlace(place);
    setRoutes([]);
    setError(null);
    setIsSearchingRoutes(true);
    const search = new URLSearchParams({
      south: String(place.boundingBox.south),
      west: String(place.boundingBox.west),
      north: String(place.boundingBox.north),
      east: String(place.boundingBox.east),
    });
    try {
      const response = await fetch(`/api/trail/archive/routes?${search}`);
      if (!response.ok) throw new Error(`Route search returned ${response.status}`);
      const payload = await response.json() as { routes?: ArchiveRoute[] };
      setRoutes(Array.isArray(payload.routes) ? payload.routes : []);
    } catch {
      setError("route-search");
    } finally {
      setIsSearchingRoutes(false);
    }
  }

  async function selectArchiveRoute(route: ArchiveRoute) {
    setLoadingRelationId(route.relationId);
    setError(null);
    try {
      await onSelectArchive(route);
    } catch {
      setError("route-load");
    } finally {
      setLoadingRelationId(null);
    }
  }

  const archiveStatus = isSearchingPlaces
    ? text("Finding places…", "正在查找地点…")
    : isSearchingRoutes
      ? text("Finding mapped trails…", "正在查找已绘制路线…")
      : error === "place-search"
        ? text("Place search is unavailable. Try again shortly.", "地点搜索暂时不可用，请稍后再试。")
        : error === "route-search"
          ? text("Routes could not be loaded for this area.", "无法载入此区域的路线。")
          : error === "route-load"
            ? text("This route could not be converted. Try another route.", "无法转换此路线，请选择另一条。")
            : selectedPlace && routes.length === 0 && !isSearchingRoutes
              ? text("No named hiking routes were found in this search area.", "此搜索区域未找到具名徒步路线。")
              : places.length === 0 && query.trim().length >= 2 && !isSearchingPlaces
                ? text("No matching places yet.", "暂未找到匹配地点。")
                : "";

  return (
    <dialog
      className="sample-library-dialog trail-archive-dialog"
      id="trail-archive-dialog"
      ref={dialogRef}
      aria-labelledby="trail-archive-title"
      aria-describedby="trail-archive-note"
      onClose={onClose}
    >
      <div className="sample-library-panel trail-archive-panel">
        <div className="sample-library-topline">
          <div>
            <span>{text("Open trail archive", "开放路线库")}</span>
            <h2 id="trail-archive-title">{text("Choose a route.", "选择一条路线。")}</h2>
          </div>
          <button
            className="sample-library-close"
            type="button"
            aria-label={text("Close trail archive", "关闭路线库")}
            onClick={() => dialogRef.current?.close()}
          >
            ×
          </button>
        </div>

        <section className="archive-section" aria-labelledby="featured-routes-title">
          <div className="archive-section-heading">
            <h3 id="featured-routes-title">{text("Featured routes", "精选路线")}</h3>
            <small>05</small>
          </div>
          <div className="sample-library-list archive-featured-list">
            {SAMPLE_ROUTES.map((route, index) => (
              <button
                className="sample-route-option"
                type="button"
                key={route.id}
                disabled={disabled}
                onClick={() => onSelectSample(route)}
              >
                <span className="sample-route-number" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="sample-route-name">
                  <strong>{language === "zh" ? route.chineseName : route.englishName}</strong>
                  <small lang={language === "zh" ? "en" : "zh-CN"}>
                    {language === "zh" ? route.englishName : route.chineseName}
                  </small>
                </span>
                <span className="sample-route-arrow" aria-hidden="true">↗</span>
              </button>
            ))}
          </div>
        </section>

        <section className="archive-section archive-global-section" aria-labelledby="global-routes-title">
          <div className="archive-section-heading">
            <h3 id="global-routes-title">{text("Search the world", "搜索全球路线")}</h3>
            <small>OSM</small>
          </div>
          <form className="archive-search-form" role="search" onSubmit={searchPlaces}>
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m15.5 15.5 5 5" />
            </svg>
            <input
              type="search"
              value={query}
              minLength={2}
              maxLength={80}
              placeholder={text("City, park or trail region", "城市、公园或路线区域")}
              aria-label={text("Search for a trail area", "搜索路线区域")}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button type="submit" disabled={isSearchingPlaces || query.trim().length < 2}>
              {text("Search", "搜索")}
            </button>
          </form>

          {places.length > 0 ? (
            <div className="archive-place-results" aria-label={text("Matching places", "匹配地点")}>
              {places.map((place) => (
                <button
                  type="button"
                  key={place.id}
                  className={selectedPlace?.id === place.id ? "is-active" : ""}
                  onClick={() => void selectPlace(place)}
                >
                  <strong>{place.name}</strong>
                  {place.context ? <small>{place.context}</small> : null}
                </button>
              ))}
            </div>
          ) : null}

          {routes.length > 0 ? (
            <div className="archive-route-results" aria-label={text("Mapped hiking routes", "已绘制徒步路线")}>
              <p>
                {text("Routes near", "附近路线：")} <strong>{selectedPlace?.name}</strong>
              </p>
              {routes.map((route) => (
                <button
                  type="button"
                  key={route.relationId}
                  disabled={disabled || loadingRelationId != null}
                  onClick={() => void selectArchiveRoute(route)}
                >
                  <span>
                    <strong>{route.name}</strong>
                    <small>{archiveMetadata(route) || `OSM relation ${route.relationId}`}</small>
                  </span>
                  <em aria-hidden="true">
                    {loadingRelationId === route.relationId ? "···" : "↗"}
                  </em>
                </button>
              ))}
            </div>
          ) : null}

          <p className="archive-status" role="status" aria-live="polite">{archiveStatus}</p>
        </section>

        <p className="sample-library-note archive-attribution" id="trail-archive-note">
          <span aria-hidden="true" />
          {text(
            "More routes arrive as the community maps them. © OpenStreetMap contributors.",
            "路线会随社区绘制持续增加。© OpenStreetMap 贡献者。",
          )}
        </p>
      </div>
    </dialog>
  );
}
