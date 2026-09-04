import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(new URL(pathname, "http://localhost"), {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("real terrain reveal has short, bounded fallback timings", async () => {
  const source = await readFile(
    new URL("../app/_components/maplibre-terrain-map.tsx", import.meta.url),
    "utf8",
  );
  const loadTimeoutMatch = source.match(
    /loadTimeout\s*=\s*window\.setTimeout\([\s\S]*?\},\s*([\d_]+)\s*\)/,
  );

  assert.ok(loadTimeoutMatch, "the map needs a bounded failure timeout");

  const loadTimeoutMs = Number(loadTimeoutMatch[1].replaceAll("_", ""));
  assert.ok(loadTimeoutMs <= 20_000, `map failure fallback is too slow: ${loadTimeoutMs}ms`);
  assert.doesNotMatch(source, /animateRoute|animateContourReveal|beginIntro/);
  assert.match(source, /const currentRouteData = routeFeatureAtProgress\(timeline, 1\)/);
  assert.match(source, /fitBoundsOptions/);
  assert.match(source, /map\.isSourceLoaded\(BASEMAP_SOURCE\)/);
  assert.match(source, /disposed \|\| mapRevealed/);
  assert.match(source, /style:\s*fastMapStyle\(activeTheme\)/);
  assert.match(source, /scheduleTerrainLayers\(0\)/);
  assert.doesNotMatch(source, /tiles\.openfreemap\.org\/styles/);
  assert.match(source, /statusCallbackRef\.current\("ready"\)/);
});

test("real contours share the terrain DEM and render outside the main thread", async () => {
  const source = await readFile(
    new URL("../app/_components/maplibre-terrain-map.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /import\("maplibre-contour"\)/);
  assert.match(source, /worker:\s*true/);
  assert.match(source, /sharedDemProtocolUrl/);
  assert.match(source, /contourProtocolUrl/);
  assert.match(source, /track4trek-real-contours/);
  assert.match(source, /source-layer":\s*"contours"/);
  assert.doesNotMatch(source, /queryTerrainElevation/);
  assert.doesNotMatch(source, /buildTerrainContours/);
});

test("trip survey stores a numeric personal profile without a date field", async () => {
  const intakeSource = await readFile(
    new URL("../app/_components/route-intake.tsx", import.meta.url),
    "utf8",
  );
  const routeDataSource = await readFile(
    new URL("../app/_lib/route-data.ts", import.meta.url),
    "utf8",
  );
  const globalStyles = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(intakeSource, /name="sex"/);
  assert.match(intakeSource, /\["male"[\s\S]*\["female"/);
  assert.match(intakeSource, /name="ageYears"\s+type="number"/);
  assert.match(intakeSource, /name="bodyWeightKg"\s+type="number"/);
  assert.match(intakeSource, /name="heightCm"\s+type="number"/);
  assert.match(intakeSource, /name="packWeightKg"\s+type="number"/);
  assert.match(intakeSource, /name="tripMode"/);
  assert.match(intakeSource, /name="plannedDays"/);
  assert.match(intakeSource, /"single-day"[\s\S]*"multi-day"/);
  assert.match(intakeSource, /text\("Total moving time", "全程移动时间"\)/);
  assert.match(intakeSource, /text\("kg", "公斤"\)/);
  assert.doesNotMatch(intakeSource, /type="date"|plannedDate|name="packLoad"/);

  assert.match(routeDataSource, /export type ProfileSex = "male" \| "female"/);
  assert.match(routeDataSource, /version: 4/);
  assert.match(routeDataSource, /export type TripMode = "single-day" \| "multi-day"/);
  assert.match(routeDataSource, /minimumMovingMinutesForPlan/);
  assert.match(routeDataSource, /maximumMovingMinutesForPlan/);
  assert.match(routeDataSource, /value\.version === 3/);
  assert.match(routeDataSource, /tripMode: "single-day"/);
  assert.match(routeDataSource, /plannedDays: 1/);
  assert.match(routeDataSource, /bodyWeightKg: number/);
  assert.match(routeDataSource, /packWeightKg: number/);
  assert.match(routeDataSource, /value\.survey\.ageYears < 13/);
  assert.match(routeDataSource, /value\.survey\.packWeightKg > 60/);
  assert.doesNotMatch(routeDataSource, /plannedDate|PackLoad/);
  assert.match(globalStyles, /\.minimal-drop::before[\s\S]*?pointer-events:\s*none/);
});

test("trail archive exposes five sanitized featured routes and the OpenStreetMap route flow", async () => {
  const intakeSource = await readFile(
    new URL("../app/_components/route-intake.tsx", import.meta.url),
    "utf8",
  );
  const sampleManifest = await readFile(
    new URL("../app/_lib/sample-routes.ts", import.meta.url),
    "utf8",
  );
  const sampleAssets = [
    "langta-cv.gpx",
    "lingbai-route.gpx",
    "wusun-ancient-trail.gpx",
    "mount-wutai-circuit.gpx",
    "everest-east-slope.gpx",
  ];

  assert.doesNotMatch(intakeSource, /createSampleRoutePreview/);
  assert.match(intakeSource, /parseGpxRoute\(fileName, uploadedText \?\? "", survey, sourceKind\)/);
  assert.match(intakeSource, /setSourceKind\("sample"\)/);
  assert.match(intakeSource, /setSourceKind\("archive"\)/);
  assert.match(intakeSource, /\/api\/trail\/archive\/gpx\?id=/);

  for (const asset of sampleAssets) {
    assert.match(sampleManifest, new RegExp(`/samples/${asset.replaceAll(".", "\\.")}`));
    const gpx = await readFile(new URL(`../public/samples/${asset}`, import.meta.url), "utf8");
    const pointCount = (gpx.match(/<(?:trkpt|rtept)\b/g) ?? []).length;

    assert.ok(pointCount >= 2, `${asset} needs at least two route points`);
    assert.match(gpx, /<ele>/, `${asset} should preserve route elevation`);
    assert.doesNotMatch(
      gpx,
      /Creater|OriginCreater|<wpt\b|<time>|<extensions\b|<desc>|<cmt>|<sym>|<link\b/i,
      `${asset} contains metadata that should not be public`,
    );
  }

  const everest = await readFile(
    new URL("../public/samples/everest-east-slope.gpx", import.meta.url),
    "utf8",
  );
  assert.match(everest, /<rtept\b/);
});

test("server-renders the Track4Trek homepage", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Track4Trek \| Route readiness, explained<\/title>/i);
  assert.match(html, /Know what the trail asks\./i);
  assert.match(html, /Terrain, effort and conditions/i);
  assert.match(html, /Choose a GPX route file/i);
  assert.match(html, /Trail archive/i);
  assert.match(html, /Open trail archive/i);
  assert.match(html, /Featured routes/i);
  assert.match(html, /Search the world/i);
  assert.match(html, /City, park or trail region/i);
  assert.match(html, /Langta C\+V/i);
  assert.match(html, /Lingbai Route/i);
  assert.match(html, /Wusun Ancient Trail/i);
  assert.match(html, /Mount Wutai Circuit/i);
  assert.match(html, /Everest East Slope/i);
  assert.match(html, /More routes arrive as the community maps them/i);
  assert.match(html, /OpenStreetMap contributors/i);
  assert.match(html, /Upload and analyse a route/i);
  assert.match(html, /Use light mode/i);
  assert.match(html, /role="group" aria-label="Language"/i);
  assert.match(html, />中<\/button>/i);
  assert.match(html, />Eng<\/button>/i);
  assert.match(html, /track4trek-scenery-dark/i);
  assert.match(html, /track4trek-scenery-light/i);
  assert.doesNotMatch(html, /The complete journey, before the engine/i);
});

test("server-renders the simulated analysis screen", async () => {
  const response = await render("/analyzing");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /Reading the route/i);
  assert.match(html, /Route preview progress/i);
  assert.match(html, />Cancel</i);
  assert.match(html, /Uploaded GPX data is read locally/i);
  assert.match(html, /Return to route setup/i);
});

test("server-renders the real-map result flow, metric wheels, forecasts, and notes", async () => {
  const response = await render("/results");
  assert.equal(response.status, 200);

  const html = await response.text();
  const resultsSource = await readFile(
    new URL("../app/results/page.tsx", import.meta.url),
    "utf8",
  );
  const siteHeaderSource = await readFile(
    new URL("../app/_components/site-header.tsx", import.meta.url),
    "utf8",
  );
  const intakeSource = await readFile(
    new URL("../app/_components/route-intake.tsx", import.meta.url),
    "utf8",
  );
  const analyzingSource = await readFile(
    new URL("../app/analyzing/page.tsx", import.meta.url),
    "utf8",
  );
  const trailMapSource = await readFile(
    new URL("../app/_components/trail-map.tsx", import.meta.url),
    "utf8",
  );
  const elevationSource = await readFile(
    new URL("../app/_components/elevation-profile.tsx", import.meta.url),
    "utf8",
  );
  const proWorkspaceSource = await readFile(
    new URL("../app/_components/pro-route-workspace.tsx", import.meta.url),
    "utf8",
  );
  assert.match(html, /Three-dimensional trail map/i);
  assert.match(html, /trail-map-canvas/i);
  assert.match(html, /real geographic three-dimensional terrain map/i);
  assert.match(html, /data-map-engine="MapLibre GL JS"/i);
  assert.match(html, /data-basemap-source="OpenStreetMap"/i);
  assert.match(html, /data-terrain-source="Mapterhorn"/i);
  assert.match(html, /data-contour-source="Mapterhorn DEM"/i);
  assert.match(html, /data-terrain-mode-control/i);
  assert.match(html, /role="group" aria-label="Terrain display"/i);
  assert.match(html, /aria-pressed="true"[^>]*>\s*Contour render/i);
  assert.match(html, /aria-pressed="false"[^>]*>\s*Real map/i);
  assert.match(html, /local contour terrain fallback/i);
  assert.match(html, /Total distance/i);
  assert.match(html, /Elevation range/i);
  assert.match(html, /Total ascent/i);
  assert.match(html, /Total descent/i);
  assert.match(html, /Highest elevation/i);
  assert.match(html, /Prototype values/i);
  assert.match(html, /data-contour-contrast="fixed"/i);
  assert.match(html, /data-highest-altitude="934"/i);
  assert.match(html, /data-lowest-altitude="340"/i);
  assert.match(html, /Highest altitude:.*934.*meters/i);
  assert.match(html, /Lowest altitude:.*340.*meters/i);
  assert.match(html, /Compare with another route/i);
  assert.match(siteHeaderSource, /ROUTE_COMPARISON_LEFT_STORAGE_KEY/);
  assert.match(siteHeaderSource, /src="\/results\?compare-pane=left"/);
  assert.match(siteHeaderSource, /src="\/\?compare-pane=right"/);
  assert.match(siteHeaderSource, /Side-by-side route comparison/);
  assert.match(intakeSource, /\/analyzing\?compare-pane=right/);
  assert.match(analyzingSource, /\/results\?compare-pane=right/);
  assert.match(trailMapSource, /readActiveRoutePreview\(\)/);
  assert.match(elevationSource, /readActiveRoutePreview\(\)/);
  assert.match(html, /Recommended Metric Ranges × Garmin/i);
  assert.match(html, /dial-segments/i);
  assert.doesNotMatch(html, /watch-score-marker/i);
  assert.match(html, /Hill score/i);
  assert.match(html, /Endurance score/i);
  assert.match(html, /VO₂ max/i);
  assert.match(html, /Lactate threshold/i);
  for (const metricId of [
    "hill-score",
    "endurance-score",
    "vo2-max",
    "lactate-threshold",
    "active-calories",
    "recovery-time",
  ]) {
    assert.match(html, new RegExp(`data-metric-id="${metricId}"`));
  }
  assert.match(html, /data-route-demand-state="loading"/i);
  assert.doesNotMatch(html, /low confidence|high confidence|低置信度|高置信度/i);
  assert.match(
    resultsSource,
    /const preview = readActiveRoutePreview\(\)/,
  );
  assert.equal(
    (resultsSource.match(/readActiveRoutePreview\(\)/g) ?? []).length,
    1,
    "results should read the stored preview once",
  );
  assert.match(resultsSource, /calculateRouteDemand\(preview\)/);
  assert.match(
    resultsSource,
    /<RouteDemandMetrics\s+status=\{analysisState\.status\}\s+analysis=\{analysisState\.analysis\}/,
  );
  assert.match(
    resultsSource,
    /<PostActivityForecast\s+status=\{analysisState\.status\}\s+analysis=\{analysisState\.analysis\}/,
  );
  assert.match(
    resultsSource,
    /<WeatherDifficultyChart\s+preview=\{analysisState\.preview\}\s+analysis=\{analysisState\.analysis\}/,
  );
  assert.match(resultsSource, /proContent=\{\s*<ProRouteWorkspace/);
  assert.match(resultsSource, /preview=\{analysisState\.preview\}/);
  assert.match(proWorkspaceSource, /className="pro-workspace"/);
  assert.match(proWorkspaceSource, /calculateProRouteAnalysis/);
  assert.match(proWorkspaceSource, /id="pro-dashboard"/);
  assert.match(proWorkspaceSource, /id="pro-month"/);
  assert.match(proWorkspaceSource, /function ProMonthControl/);
  assert.match(proWorkspaceSource, /text\("Starting month", "出发月份"\)/);
  assert.match(proWorkspaceSource, /text\("Trip length", "行程类型"\)/);
  assert.match(proWorkspaceSource, /id="pro-planned-days"/);
  assert.match(proWorkspaceSource, /label=\{text\("Total moving time", "全程移动时间"\)\}/);
  assert.match(proWorkspaceSource, /className="pro-endurance-stages"/);
  assert.match(proWorkspaceSource, /demandAnalysis\.endurancePlan\.stages\.map/);
  assert.match(proWorkspaceSource, /<caption className="visually-hidden">/);
  assert.match(proWorkspaceSource, /<th scope="col">/);
  assert.doesNotMatch(proWorkspaceSource, /className="pro-dashboard-outputs" aria-live/);
  assert.match(proWorkspaceSource, /pro-month-options/);
  assert.match(proWorkspaceSource, /data-pro-seasonal-factor/);
  assert.match(proWorkspaceSource, /MONTHLY_STRESS/);
  assert.match(proWorkspaceSource, /className="pro-chart-frame"/);
  assert.match(proWorkspaceSource, /className="pro-segment-table"/);
  assert.match(proWorkspaceSource, /className="pro-difficulty-audit"/);
  assert.match(proWorkspaceSource, /calculateComprehensiveRouteDifficulty/);

  const technicalStart = proWorkspaceSource.indexOf(
    '<section className="pro-technical-section"',
  );
  const dashboardStart = proWorkspaceSource.indexOf(
    '<section className="pro-dashboard"',
  );
  assert.ok(technicalStart >= 0, "Pro mode should expose a technical GPX section");
  assert.ok(dashboardStart > technicalStart, "Pro dashboard should follow the technical GPX sections");
  const technicalSource = proWorkspaceSource.slice(technicalStart, dashboardStart);
  assert.doesNotMatch(
    technicalSource,
    /requiredPaceMinPerKm|required pace|pace calculation|pace requirement/i,
    "technical GPX details must not expose a target-pace calculation",
  );
  assert.doesNotMatch(html, /6,600–7,299|45\.4–51\.0|≈90%|2,000–3,800/i);
  assert.match(html, /id="elevation"/i);
  assert.match(html, /Elevation profile/i);
  assert.match(html, /elevation-profile-canvas/i);
  assert.match(html, /aria-label="Graph view"/i);
  assert.match(html, /aria-pressed="true"[^>]*>\s*Elevation/i);
  assert.match(html, /Grade \(%\)/i);
  assert.match(html, /Interactive elevation profile over 18\.4 kilometers/i);
  assert.match(html, /Horizontal scale/i);
  assert.match(html, /id="overview-elevation-x-zoom"/i);
  assert.match(html, /id="overview-elevation-x-pan"/i);
  assert.match(html, /id="weather-x-zoom"/i);
  assert.match(html, /id="weather-x-pan"/i);
  assert.match(html, /id="surface"/i);
  assert.match(html, /Trail surface by month/i);
  assert.match(html, /id="surface-month"/i);
  assert.match(html, /Mapped base composition/i);
  assert.match(resultsSource, /<TrailSurfacePanel/);
  assert.match(proWorkspaceSource, /id="pro-profile-x-zoom"/);
  assert.match(proWorkspaceSource, /id="pro-profile-x-pan"/);
  assert.match(proWorkspaceSource, /pan=\{chartXPan\}/);
  assert.match(proWorkspaceSource, /className="pro-chart-active-point"/);
  assert.match(html, /Generic profile/i);
  assert.match(html, /Weather-adjusted difficulty/i);
  assert.match(html, /Overall route difficulty/i);
  assert.match(html, /What drives this score/i);
  assert.match(html, /Acute aerobic capacity retained/i);
  assert.match(html, /Starting month/i);
  assert.match(html, /role="slider"/i);
  assert.match(html, /Illustrative baseline/i);
  assert.match(html, /Heat: \d+ out of 100/i);
  assert.match(html, /Snow \/ ice proxy: \d+ out of 100/i);
  assert.match(html, /Storm proxy: \d+ out of 100/i);
  assert.match(html, /Visibility proxy: \d+ out of 100/i);
  assert.match(html, /day high \/ night low/i);
  assert.match(html, /cm snowfall/i);
  assert.match(html, /wind \+ severe-weather proxy/i);
  assert.match(html, /mm\/day/i);
  assert.match(html, /atmospheric proxy/i);
  assert.match(html, /atmospheric visibility/i);
  assert.match(html, /id="post-activity"/i);
  assert.match(html, /Post-activity forecast/i);
  assert.match(html, /Active calories/i);
  assert.match(html, /Recovery time/i);
  assert.doesNotMatch(html, /Aerobic training effect|Anaerobic training effect/i);
  const metricsPosition = html.indexOf('id="metrics"');
  const elevationPosition = html.indexOf('id="elevation"');
  const weatherPosition = html.indexOf('id="weather"');
  const forecastPosition = html.indexOf('id="post-activity"');
  assert.ok(metricsPosition >= 0);
  assert.ok(elevationPosition >= 0);
  assert.ok(weatherPosition >= 0);
  assert.ok(forecastPosition >= 0);
  assert.ok(elevationPosition < weatherPosition);
  assert.ok(weatherPosition < metricsPosition);
  assert.ok(metricsPosition < forecastPosition);
  assert.match(html, /Choose your result view/i);
  assert.match(html, /Essential route guidance/i);
  assert.match(html, /Advanced outdoor analysis/i);
  assert.match(html, /Track4Trek reads the GPX file locally/i);
  assert.match(html, /map providers receive ordinary tile requests/i);
  assert.match(html, /not affiliated with or endorsed by Garmin/i);
  assert.match(html, /Analyse a new route/i);
  assert.doesNotMatch(html, /result-bg-(?:alpine|snow|forest|mist|jungle)/i);
  assert.doesNotMatch(html, /Explore route data|Explore weather data|result-data-panel/i);
  assert.doesNotMatch(html, /Reference fitness profile|Illustrative Track4Trek recommendations/i);
  assert.doesNotMatch(html, /What this route may ask of you|Environmental preview|What shapes the preview|Open tools\. Clear limits\.|Behind the preview/i);
});
