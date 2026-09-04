import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

test("canvas paints coalesce, pause offscreen/hidden, resume and clean up", async () => {
  const source = await readFile(new URL("../app/_components/use-canvas-render.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const effects = [];
  const frames = new Map();
  const listeners = new Map();
  let nextFrame = 0;
  let resized;
  let intersected;
  let disconnected = 0;
  let draws = 0;
  const events = {
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: (name) => listeners.delete(name),
  };
  const document = { ...events, hidden: false };
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require: (name) => name === "react"
      ? { useEffect: (effect) => effects.push(effect), useRef: (value) => ({ current: value }) }
      : { THEME_CHANGE_EVENT: "theme" },
    window: events,
    document,
    requestAnimationFrame: (callback) => { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame: (id) => frames.delete(id),
    ResizeObserver: class {
      constructor(callback) { resized = callback; }
      observe() {}
      disconnect() { disconnected++; }
    },
    IntersectionObserver: class {
      constructor(callback) { intersected = callback; }
      observe() {}
      disconnect() { disconnected++; }
    },
  });
  exports.useCanvasRender({ current: {} }, () => { draws++; });
  const cleanups = effects.map((effect) => effect());
  const flush = () => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((callback) => callback());
  };
  resized(); resized(); listeners.get("theme")();
  assert.equal(frames.size, 1, "resize and theme events share a frame");
  flush();
  assert.equal(draws, 1);
  intersected([{ isIntersecting: false }]);
  resized();
  assert.equal(frames.size, 0);
  intersected([{ isIntersecting: true }]);
  flush();
  assert.equal(draws, 2);
  document.hidden = true;
  resized(); listeners.get("visibilitychange")();
  assert.equal(frames.size, 0);
  document.hidden = false;
  listeners.get("visibilitychange")();
  flush();
  assert.equal(draws, 3);
  resized();
  cleanups.forEach((cleanup) => cleanup?.());
  assert.equal(frames.size, 0);
  assert.equal(listeners.size, 0);
  assert.equal(disconnected, 2);
});
