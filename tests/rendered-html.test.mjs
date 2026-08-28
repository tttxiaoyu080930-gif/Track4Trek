import assert from "node:assert/strict";
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

test("server-renders the Track4Trek homepage", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Track4Trek \| Route readiness, explained<\/title>/i);
  assert.match(html, /Know what the trail asks\./i);
  assert.match(html, /Terrain, effort and conditions/i);
  assert.match(html, /Choose a GPX route file/i);
  assert.match(html, /Use sample/i);
  assert.doesNotMatch(html, /The complete journey, before the engine/i);
});

test("server-renders the simulated analysis screen", async () => {
  const response = await render("/analyzing");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /Reading the route/i);
  assert.match(html, /Route preview progress/i);
  assert.match(html, />Cancel</i);
  assert.match(html, /Phase 1 is a visual simulation/i);
});

test("server-renders the result prototype as map, metric wheels, and plain notes", async () => {
  const response = await render("/results");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /Sample trail map/i);
  assert.match(html, /trail-map-canvas/i);
  assert.match(html, /three-dimensional contour terrain prototype/i);
  assert.match(html, /Total distance/i);
  assert.match(html, /Elevation range/i);
  assert.match(html, /Total ascent/i);
  assert.match(html, /Total descent/i);
  assert.match(html, /Highest elevation/i);
  assert.match(html, /Prototype values/i);
  assert.match(html, /Explore route data/i);
  assert.match(html, /Explore weather data/i);
  assert.match(html, /data-contour-contrast="automatic"/i);
  assert.match(html, /Contour colors automatically adapt to the current landscape/i);
  assert.match(html, /data-highest-altitude="934"/i);
  assert.match(html, /data-lowest-altitude="340"/i);
  assert.match(html, /Highest altitude:.*934.*meters/i);
  assert.match(html, /Lowest altitude:.*340.*meters/i);
  assert.match(html, /Recommended metric ranges/i);
  assert.match(html, /dial-segments/i);
  assert.match(html, /Hill score/i);
  assert.match(html, /Endurance score/i);
  assert.match(html, /VO₂ max/i);
  assert.match(html, /Lactate threshold/i);
  assert.match(html, /Weather-adjusted difficulty/i);
  assert.match(html, /Starting month/i);
  assert.match(html, /role="slider"/i);
  assert.match(html, /Illustrative only/i);
  assert.match(html, /Heat: \d+ out of 100/i);
  assert.match(html, /Snow: \d+ out of 100/i);
  assert.match(html, /Storm: \d+ out of 100/i);
  assert.match(html, /Visibility: \d+ out of 100/i);
  assert.match(html, /°C day/i);
  assert.match(html, /cm snowfall/i);
  assert.match(html, /Level \d maximum/i);
  assert.match(html, /monthly estimate/i);
  assert.match(html, /km visible/i);
  assert.match(html, /trail remains visible/i);
  assert.match(html, /Track4Trek is being built with MapLibre GL JS/i);
  assert.match(html, /not affiliated with or endorsed by Garmin/i);
  assert.doesNotMatch(html, /Reference fitness profile|Illustrative Track4Trek recommendations/i);
  assert.doesNotMatch(html, /What this route may ask of you|Environmental preview|What shapes the preview|Open tools\. Clear limits\.|Behind the preview/i);
});
