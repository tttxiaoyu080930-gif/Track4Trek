# Track4Trek

Track4Trek is an open geospatial engineering project that turns a trekking route, target moving time, and pack style into an explainable route-demand profile. The future analyzer will combine terrain and weather data to estimate physical demands without presenting a medical diagnosis or an official Garmin score.

The public project domain is `siuyuk.xyz`.

## Current milestone

Phase 1 is a complete visual flow: a full-screen route landing page, compact trip survey, simulated analysis sequence, a live key-free sample map, Garmin-watch-inspired reference wheels, and plain-language methodology notes. It does not read the uploaded route, enrich elevation or weather, or calculate real recommendations yet.

Phase 2 will turn the visual upload and survey into a working data pipeline: GPX validation, route parsing, elevation enrichment, route statistics, and structured trip inputs.

## Indicator direction

The planned fitness-reference outputs are Hill Score, Endurance Score, VO₂ max, and lactate threshold. Garmin’s published units and classification tables are reference material; Track4Trek will recommend ranges for a route but will not claim to calculate an official Garmin measurement. Because Endurance Score and VO₂ max classifications depend on age and sex, those profile inputs belong in Phase 2. Lactate threshold must be represented as pace plus corresponding heart rate or power rather than as a universal 0–100 score.

## Local development

Requirements: Node.js 22.13 or newer and pnpm.

```bash
pnpm install
pnpm dev
```

Open the local address printed in the terminal. Before publishing a change, run:

```bash
pnpm build
```

## Project map

- `app/page.tsx` — full-screen route landing page
- `app/analyzing/page.tsx` — simulated progress sequence
- `app/results/page.tsx` — map-first result prototype and metric references
- `app/_components/trail-map.tsx` — MapLibre sample trail drawn over OpenFreeMap
- `app/_components/` — shared upload, map, indicator, header, and transition components
- `app/globals.css` — blue visual system, motion, and responsive layout
- `public/track4trek-hero-blue.png` — generated hiking hero background
- `public/result-bg-*` — generated and web-optimized rotating result landscapes
- `public/og.png` — Track4Trek social preview
- `docs/HOMEPAGE_BUILD_GUIDE.md` — beginner-friendly building and publishing walkthrough
- `docs/open-source-stack.md` — selected free and open-source GIS stack

## Planned open stack

MapLibre GL JS, OpenFreeMap, gpxjs, Turf.js, and Open-Meteo provide the foundation. Data sources, limitations, and score formulas will be shown clearly so the analysis remains reproducible and defensible.
