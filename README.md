# Track4Trek

Track4Trek is an open geospatial engineering project that turns a trekking route, target moving time, and pack style into an explainable route-demand profile. The future analyzer will combine terrain and weather data to estimate physical demands without presenting a medical diagnosis or an official Garmin score.

The public project domain is `siuyuk.xyz`.

## Current milestone

Phase 1 is a complete visual flow: a full-screen route landing page, compact trip survey, simulated analysis sequence, terrain placeholder, and original route-demand indicator preview. It intentionally does not read route contents, call GIS services, or calculate real scores yet.

Phase 2 will turn the visual upload and survey into a working data pipeline: GPX validation, route parsing, elevation enrichment, route statistics, and structured trip inputs.

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
- `app/results/page.tsx` — terrain and route-demand result prototype
- `app/_components/` — shared upload, terrain, indicator, header, and footer components
- `app/globals.css` — blue visual system, motion, and responsive layout
- `public/track4trek-hero-blue.png` — generated hiking hero background
- `public/og.png` — Track4Trek social preview
- `docs/HOMEPAGE_BUILD_GUIDE.md` — beginner-friendly building and publishing walkthrough
- `docs/open-source-stack.md` — selected free and open-source GIS stack

## Planned open stack

MapLibre GL JS, OpenFreeMap, gpxjs, Turf.js, and Open-Meteo provide the foundation. Data sources, limitations, and score formulas will be shown clearly so the analysis remains reproducible and defensible.
