# Track4Trek

Track4Trek is an open geospatial engineering project that turns a trekking route, target moving time, and pack style into an explainable route-demand profile. The future analyzer will combine terrain and weather data to estimate the physical demands of a route without claiming to provide a medical diagnosis or an official Garmin score.

The public project domain is `siuyuk.xyz`.

## Current milestone

The repository currently contains the finished project homepage. The next milestone is the interactive analyzer: GPX upload, elevation enrichment, route statistics, weather exposure, and transparent fitness guidance.

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

- `app/page.tsx` — homepage content and structure
- `app/globals.css` — visual design and responsive layout
- `app/layout.tsx` — browser and social-sharing metadata
- `public/og.png` — Track4Trek social preview
- `docs/HOMEPAGE_BUILD_GUIDE.md` — beginner-friendly building and publishing walkthrough
- `docs/open-source-stack.md` — selected free and open-source GIS stack

## Planned open stack

MapLibre GL JS, OpenFreeMap, gpxjs, Turf.js, and Open-Meteo provide the foundation. Data sources, limitations, and score formulas will be shown clearly so the analysis remains reproducible and defensible.
