"use client";

import { useState } from "react";

type DataTone = "direct" | "calculated" | "enriched" | "conditional";

type DataItem = {
  name: string;
  detail: string;
  status: string;
  tone: DataTone;
};

type DataGroup = {
  title: string;
  source: string;
  items: readonly DataItem[];
};

type SourceLink = {
  label: string;
  href: string;
};

type DataPanelProps = {
  id: string;
  buttonLabel: string;
  heading: string;
  introduction: string;
  groups: readonly DataGroup[];
  sources: readonly SourceLink[];
  note: string;
};

const routeGroups: readonly DataGroup[] = [
  {
    title: "Uploaded GPX",
    source: "GPX 1.1 + gpxjs",
    items: [
      {
        name: "Route geometry",
        detail: "Ordered latitude and longitude points, tracks, routes, segments, gaps, start and finish.",
        status: "From file",
        tone: "direct",
      },
      {
        name: "File structure",
        detail: "Track, route, segment, waypoint and point counts, with disconnected sections kept separate.",
        status: "From file",
        tone: "direct",
      },
      {
        name: "Point elevation and time",
        detail: "Elevation and timestamps at each recorded point when the device included them.",
        status: "If present",
        tone: "conditional",
      },
      {
        name: "Waypoints and metadata",
        detail: "Names, descriptions, waypoint types, author, creator, creation time, links, keywords and bounds.",
        status: "From file",
        tone: "direct",
      },
      {
        name: "GPS quality",
        detail: "Fix type, satellites, horizontal, vertical and positional dilution, geoid height and source.",
        status: "If present",
        tone: "conditional",
      },
      {
        name: "Device extensions",
        detail: "Arbitrary GPX extensions such as heart rate, cadence or temperature when the recorder exports them.",
        status: "If present",
        tone: "conditional",
      },
    ],
  },
  {
    title: "Route profile",
    source: "gpxjs + Turf.js",
    items: [
      {
        name: "Distance",
        detail: "Total and cumulative horizontal distance, plus distance for each segment and climb.",
        status: "Calculated",
        tone: "calculated",
      },
      {
        name: "Time and pace",
        detail: "Start, finish, elapsed, moving and stopped time, average pace and point-to-point speed where timestamps exist.",
        status: "Calculated",
        tone: "calculated",
      },
      {
        name: "Elevation profile",
        detail: "Minimum, maximum and average elevation with total ascent, descent and cumulative gain.",
        status: "Calculated",
        tone: "calculated",
      },
      {
        name: "Slope and grade",
        detail: "Per-segment gradient, steepest climb and descent, sustained grade and grade distribution.",
        status: "Calculated",
        tone: "calculated",
      },
      {
        name: "Spatial geometry",
        detail: "Bounding box, center, bearings, equal-distance chunks, route slices, corridor buffers and sampled points.",
        status: "Calculated",
        tone: "calculated",
      },
      {
        name: "Location on route",
        detail: "Snap a selected location to the trail with cross-track distance and distance along the route.",
        status: "Calculated",
        tone: "calculated",
      },
      {
        name: "Demand features",
        detail: "Ascent per kilometre, climb length, altitude exposure, required pace and estimated vertical speed.",
        status: "Derived",
        tone: "calculated",
      },
    ],
  },
  {
    title: "Terrain and map context",
    source: "Open-Meteo Elevation + MapLibre + OpenFreeMap",
    items: [
      {
        name: "DEM elevation samples",
        detail: "Copernicus GLO-90 surface elevation for route coordinates via Open-Meteo, requested in batches of up to 100 points.",
        status: "Enriched",
        tone: "enriched",
      },
      {
        name: "Corrected terrain profile",
        detail: "Smoothed elevation, highest and lowest points, ascent and descent recalculated from sampled terrain.",
        status: "Derived",
        tone: "calculated",
      },
      {
        name: "3D terrain presentation",
        detail: "Terrain mesh, hillshade, contour display, route overlay, camera pitch, bearing and interactive rotation.",
        status: "Rendered",
        tone: "enriched",
      },
      {
        name: "Trail and access context",
        detail: "Where exposed by loaded tiles: path class, foot, bicycle and horse access, network, MTB scale, bridge, tunnel, ford and coarse surface.",
        status: "Coverage varies",
        tone: "conditional",
      },
      {
        name: "Named map context",
        detail: "Route names and references, peaks and elevations, parks, water, waterways, land cover and nearby points of interest.",
        status: "Coverage varies",
        tone: "conditional",
      },
    ],
  },
  {
    title: "Trip setup",
    source: "Track4Trek survey",
    items: [
      {
        name: "Activity",
        detail: "Hiking, trail running or backpacking changes the movement and fitness assumptions.",
        status: "User input",
        tone: "direct",
      },
      {
        name: "Target moving time",
        detail: "Hours and minutes become the required average pace and vertical-rate target.",
        status: "User input",
        tone: "direct",
      },
      {
        name: "Pack load",
        detail: "Light, moderate or heavy load adjusts estimated effort and speed.",
        status: "User input",
        tone: "direct",
      },
      {
        name: "Planned date",
        detail: "Connects route coordinates and estimated arrival times to forecast or seasonal conditions.",
        status: "User input",
        tone: "direct",
      },
    ],
  },
];

const weatherGroups: readonly DataGroup[] = [
  {
    title: "Hourly route forecast",
    source: "Open-Meteo Forecast API",
    items: [
      {
        name: "Temperature",
        detail: "Air, apparent and wet-bulb temperature, relative humidity and dew point where the model supports them.",
        status: "Forecast",
        tone: "enriched",
      },
      {
        name: "Rain and snow",
        detail: "Precipitation probability, total precipitation, rain, showers, snowfall and snow depth.",
        status: "Forecast",
        tone: "enriched",
      },
      {
        name: "Wind",
        detail: "Wind speed, direction and gusts, sampled along the route and expected travel time.",
        status: "Forecast",
        tone: "enriched",
      },
      {
        name: "Visibility and cloud",
        detail: "Visibility distance, total cloud cover, low, mid and high cloud layers, plus WMO weather code.",
        status: "Forecast",
        tone: "enriched",
      },
      {
        name: "Freezing conditions",
        detail: "Freezing-level height, snowfall height and snow depth where supported by the selected model.",
        status: "Model dependent",
        tone: "conditional",
      },
      {
        name: "Atmospheric exposure",
        detail: "Surface pressure, sea-level pressure, UV index, solar radiation, sunshine duration and CAPE where available.",
        status: "Model dependent",
        tone: "conditional",
      },
    ],
  },
  {
    title: "Daily timing",
    source: "Open-Meteo daily aggregates",
    items: [
      {
        name: "Daily temperature range",
        detail: "Minimum, mean and maximum air and apparent temperature.",
        status: "Forecast",
        tone: "enriched",
      },
      {
        name: "Daily precipitation",
        detail: "Rain, showers, snowfall, precipitation sum, probability and number of precipitation hours.",
        status: "Forecast",
        tone: "enriched",
      },
      {
        name: "Wind maximum",
        detail: "Maximum wind speed, maximum gust and dominant direction.",
        status: "Forecast",
        tone: "enriched",
      },
      {
        name: "Light window",
        detail: "Sunrise, sunset, daylight and sunshine duration, with moonrise, moonset and phase where available.",
        status: "Forecast",
        tone: "enriched",
      },
      {
        name: "Daily severity",
        detail: "Most severe weather code and maximum UV index for the day.",
        status: "Forecast",
        tone: "enriched",
      },
    ],
  },
  {
    title: "Season and uncertainty",
    source: "Historical, Climate and Ensemble APIs",
    items: [
      {
        name: "Historical conditions",
        detail: "Hourly and daily reanalysis for temperature, rain, snow, wind, cloud, pressure and soil conditions back to 1940 or 1950.",
        status: "Historical",
        tone: "direct",
      },
      {
        name: "Monthly patterns",
        detail: "Typical ranges, percentiles and frequency of heat, rain, snow, wind and poor-visibility thresholds by month.",
        status: "Derived",
        tone: "calculated",
      },
      {
        name: "Ensemble spread",
        detail: "Multiple forecast members provide possible ranges, event likelihoods and a confidence signal.",
        status: "Probabilistic",
        tone: "enriched",
      },
      {
        name: "Long-range climate context",
        detail: "Multi-model daily climate data from 1950 to 2050 for broad seasonal context, not a day-specific forecast.",
        status: "Climate model",
        tone: "conditional",
      },
    ],
  },
  {
    title: "Track4Trek advisories",
    source: "Derived from route, schedule and weather",
    items: [
      {
        name: "Weather-adjusted difficulty",
        detail: "A route-demand curve by month, date or departure time.",
        status: "Derived",
        tone: "calculated",
      },
      {
        name: "Heat threat",
        detail: "Day and night temperature, apparent temperature, humidity, sun and expected exposure time.",
        status: "Derived",
        tone: "calculated",
      },
      {
        name: "Snow and freeze threat",
        detail: "Forecast snow, snow depth and freezing level compared with the route elevation profile.",
        status: "Derived",
        tone: "calculated",
      },
      {
        name: "Storm threat",
        detail: "Weather codes, CAPE, precipitation and gusts combined as a transparent risk proxy.",
        status: "Derived proxy",
        tone: "calculated",
      },
      {
        name: "Rain and wet-trail proxy",
        detail: "Precipitation amount, probability, duration and recent soil moisture where available.",
        status: "Derived proxy",
        tone: "calculated",
      },
      {
        name: "Visibility proxy",
        detail: "Forecast visibility, cloud and precipitation mapped to exposed route segments; trail visibility is not directly observed.",
        status: "Derived proxy",
        tone: "calculated",
      },
      {
        name: "Wind and daylight margin",
        detail: "Gust exposure, likely crosswind, sunrise, sunset and time remaining after the planned finish.",
        status: "Derived",
        tone: "calculated",
      },
      {
        name: "Timing recommendation",
        detail: "Lower-risk months, departure windows and route sections where conditions are likely to be most demanding.",
        status: "Advisory",
        tone: "calculated",
      },
    ],
  },
];

const routeSources: readonly SourceLink[] = [
  { label: "gpxjs", href: "https://github.com/We-Gold/gpxjs" },
  { label: "segment-safe GeoJSON", href: "https://github.com/placemark/togeojson" },
  { label: "GPX 1.1", href: "https://www.topografix.com/gpx/1/1/" },
  { label: "Turf.js", href: "https://turfjs.org/docs/" },
  { label: "MapLibre GL JS", href: "https://maplibre.org/maplibre-gl-js/docs/" },
  { label: "OpenFreeMap", href: "https://openfreemap.org/quick_start/" },
  { label: "OpenMapTiles schema", href: "https://openmaptiles.org/schema/" },
  { label: "Open-Meteo Elevation", href: "https://open-meteo.com/en/docs/elevation-api" },
];

const weatherSources: readonly SourceLink[] = [
  { label: "Forecast", href: "https://open-meteo.com/en/docs" },
  { label: "Historical", href: "https://open-meteo.com/en/docs/historical-weather-api" },
  { label: "Ensemble", href: "https://open-meteo.com/en/docs/ensemble-api" },
  { label: "Climate", href: "https://open-meteo.com/en/docs/climate-api" },
];

function ExpandableDataPanel({
  id,
  buttonLabel,
  heading,
  introduction,
  groups,
  sources,
  note,
}: DataPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const contentId = `${id}-content`;

  return (
    <section className={`result-data-panel${isOpen ? " is-open" : ""}`} id={id}>
      <button
        className="result-data-toggle"
        type="button"
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span>{buttonLabel}</span>
        <i aria-hidden="true" />
      </button>

      {isOpen ? (
        <div className="result-data-content" id={contentId} role="region" aria-label={heading}>
          <header>
            <p>Data inventory</p>
            <h2>{heading}</h2>
            <span>{introduction}</span>
          </header>

          <div className="result-data-grid">
            {groups.map((group, groupIndex) => (
              <section className="result-data-group" key={group.title}>
                <div className="result-data-group-heading">
                  <span>{String(groupIndex + 1).padStart(2, "0")}</span>
                  <div>
                    <h3>{group.title}</h3>
                    <p>{group.source}</p>
                  </div>
                </div>
                <ul>
                  {group.items.map((item) => (
                    <li key={item.name}>
                      <div>
                        <strong>{item.name}</strong>
                        <em className={`is-${item.tone}`}>{item.status}</em>
                      </div>
                      <p>{item.detail}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <footer>
            <p>{note}</p>
            <nav aria-label={`${heading} documentation`}>
              {sources.map((source) => (
                <a key={source.label} href={source.href} target="_blank" rel="noreferrer">
                  {source.label}
                </a>
              ))}
            </nav>
          </footer>
        </div>
      ) : null}
    </section>
  );
}

export function RouteDataPanel() {
  return (
    <ExpandableDataPanel
      id="route-data"
      buttonLabel="Explore route data"
      heading="What the route pipeline can obtain"
      introduction="Raw GPX fields, reproducible geometry calculations, elevation enrichment and the trip choices that shape the analysis."
      groups={routeGroups}
      sources={routeSources}
      note="Availability means the field can be read or calculated by the planned Phase 2 pipeline. Most GPX fields are optional, timestamps and sensor extensions may be absent, and disconnected segments must not be joined across recording gaps. Distance is horizontal and elevation will be smoothed before ascent or grade is reported. OpenFreeMap context comes only from loaded cartographic tiles, not live closures or routing. Personal metadata stays hidden by default."
    />
  );
}

export function WeatherDataPanel() {
  return (
    <ExpandableDataPanel
      id="weather-data"
      buttonLabel="Explore weather data"
      heading="What the weather pipeline can obtain"
      introduction="Route-sampled forecasts, daylight, seasonal history, ensemble uncertainty and the transparent advisories derived from them."
      groups={weatherGroups}
      sources={weatherSources}
      note="Open-Meteo forecasts are normally seven days and can extend to sixteen days. The generic API directly supplies precipitation probability, but not global snow, storm or trail-visibility probabilities; those remain clearly labelled Track4Trek proxies. The twelve-month view uses historical statistics, not a pretend long-range forecast."
    />
  );
}
