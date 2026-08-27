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
  assert.match(html, /Building your route preview/i);
  assert.match(html, /No route data is being analysed in Phase 1/i);
  assert.match(html, /Preparing results/i);
});

test("server-renders the result prototype with original indicators", async () => {
  const response = await render("/results");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /What this route may ask of you/i);
  assert.match(html, /Suggested route-demand ranges/i);
  assert.match(html, /Interactive terrain and accurate route rendering arrive in Phase 3/i);
  assert.match(html, /not affiliated with or endorsed by Garmin/i);
  assert.doesNotMatch(html, /VO₂\s*max|lactate threshold|Hill Score|Endurance Score/i);
});
