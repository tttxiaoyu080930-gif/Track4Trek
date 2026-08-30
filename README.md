# Track4Trek

Track4Trek is an open geospatial engineering project for answering a practical question: **what will this route ask of me?** A user uploads a GPX route, chooses an activity and target moving time, and enters a small personal profile. The application extracts route geometry and recorded elevation, then produces transparent route-demand ranges, a route-specific seasonal weather baseline, a short live forecast, expected active calories, and a conservative recovery window.

Public project domain: [siuyuk.xyz](https://siuyuk.xyz)

Track4Trek is not affiliated with Garmin. It will not claim to calculate official Garmin metrics, diagnose fitness, or guarantee that a route is safe.

## Current state

The project is now beyond the original visual-only prototype:

- GPX files are parsed locally in the browser; no route file is uploaded to a Track4Trek server.
- The landing page includes a lazy-loaded library of five real sample routes for users without a GPX file.
- Route distance, ascent, descent, elevation range, required pace, vertical speed, elevation profile, and geographic segments are derived from the file.
- The trip survey stores activity, target moving time, gender selection, age, body weight, height, and backpack weight in kilograms.
- The result page renders the route on a real interactive 3D terrain map using MapLibre GL JS.
- Terrain and DEM-derived contour lines use the same cached Mapterhorn elevation tiles.
- Users can switch between contour rendering and the real map without remounting the map.
- Dark/light themes, English/Mandarin, responsive layouts, and reduced-motion behavior are implemented.
- Overview weather combines a twelve-month NASA POWER climatology baseline with a sampled Open-Meteo forecast when providers respond.
- Pro weather exposes the representative coordinates, all monthly index columns, route-wide daily fields, sampled hourly fields, and atmospheric inputs used by the derived indices.

The route-demand outputs are now connected to the saved route and survey through the versioned, deterministic `route-demand-v0.1` calculator. The results page reads the browser-stored `RoutePreview` once after hydration, calculates one analysis object, and passes that same object to all six dials:

- Hill Score capability range
- Endurance Score reference range
- VO₂ max route-capacity range
- Lactate-threshold pace range (trail running only when the target moving time is at least 20 minutes)
- Active-calorie range
- Recovery-time window

These are Track4Trek route-demand estimates informed by Garmin's published reference material; they are not official Garmin measurements or a reverse-engineered Garmin algorithm. Confidence fields and reason codes remain in the model for audit and are documented below, but are deliberately not shown as labels in the website interface. The overview is ordered as map, elevation profile, month-sensitive conditions, four capability metrics, and the post-activity calorie/recovery forecast. A separate Pro mode exposes a restrained GPX inspector with file counts, geometry, elevation statistics, grade distribution, extrema, separated segments, field availability, and resizable elevation/gradient charts. Its local dashboard recalculates all six outputs when activity, profile inputs, or starting month changes. Weather factors are bounded planning proxies and never replace an official forecast.

## Survey schema

| Input | Unit/options | Current use |
| --- | --- | --- |
| Activity | Hike, trail run, backpack | Select the appropriate movement-energy model |
| Target moving time | Hours and minutes | Convert route geometry into required pace and sustained effort |
| Gender | Male or female | Select Garmin Endurance/VO₂ reference classifications; not used to invent metabolic demand or calories |
| Age | Years | Select age-specific reference bands |
| Body weight | kg | Convert oxygen/energy cost into calories |
| Height | cm | Profile context and future validation; it is not an invented multiplier in the current research model |
| Backpack weight | kg | Estimate the additional metabolic cost of carried load |

The profile is stored with the parsed preview in browser `localStorage`. Survey schema version 3 replaces older previews because missing body and pack values should not be guessed.

## Algorithm research and design

### 1. Separate route demand from athlete fitness

A GPX route can describe distance, grade, elevation and target speed. It cannot measure an athlete's VO₂ max, lactate threshold, recent training history, sleep, stress, or current recovery. The model must therefore keep two ideas separate:

1. **Route demand:** the physical effort implied by the terrain, load and target time.
2. **Athlete comparison:** whether a user's known Garmin values fall above a conservative recommended range.

Garmin describes Hill Score as using VO₂ max plus months of recent uphill training, and Endurance Score as using VO₂ max plus short- and long-term activity history. Garmin does not publish either formula. Track4Trek will therefore label its output **Garmin-informed recommended capability range**, never an official or reverse-engineered Garmin score.

### 2. Route preprocessing (roadmap)

Before physiological modelling, the production pipeline should:

1. validate GPX coordinates and preserve separate track segments;
2. remove impossible jumps and duplicate points;
3. smooth noisy elevation without erasing real summits or depressions;
4. resample by horizontal distance and calculate grade over a stable local window;
5. retain total ascent/descent, ascent per kilometre, longest continuous climb, time above 2% grade, rolling vertical speed and altitude exposure;
6. solve segment speeds so that their total time equals the user's requested moving time.

This is the production-roadmap treatment; the current browser parser preserves the recorded points and derives bounded summaries, but does not yet remove every impossible jump, smooth the source elevation, or solve different segment speeds.

### 3. Hiking and backpacking oxygen cost

The strongest candidate for hiking is the Ludlow–Weyand Minimum Mechanics model. For body mass `w` (kg), carried load `l` (kg), speed `s` (m/s), grade `g` in percent, and an initially neutral terrain multiplier `t = 1`, gross oxygen demand `q` is expressed in mL·kg-body⁻¹·min⁻¹:

```text
level/uphill:
q = 3.05 + ((w + l) / w) × t × [0.32g + 3.28 + (1 + 0.19g) × 2.66s²]

downhill:
q = 3.05 + 0.73 × ((w + l) / w) × t × (3.28 + 2.66s²)
```

The original study covered walking speeds of roughly 0.4–1.6 m/s, grades from −6° to +9°, and torso loads of 18% and 31% of body mass. It is a defensible core inside those limits, but rough terrain, technical descents and extreme slopes require wider uncertainty rather than an arbitrary coefficient.

### 4. Trail-running energy cost

For trail running, the Minetti cost-of-transport polynomials are a research candidate. With decimal slope `i`, the net energy cost is:

```text
Cwalk(i) = 280.5i⁵ − 58.7i⁴ − 76.8i³ + 51.9i² + 19.6i + 2.5
Crun(i)  = 155.4i⁵ − 30.4i⁴ − 43.3i³ + 46.3i² + 19.5i + 3.6
```

`C` is in J·kg⁻¹·m⁻¹ and should be clamped to the paper's approximate grade range of −0.45 to +0.45. Segment energy is `C(i) × distance × effective mass`. The source involved elite male mountain runners and did not model backpacks; steep technical descents are particularly uncertain. The model must not be used to promise a downhill completion time.

### 5. Six modeled outputs

| Output | Transparent Track4Trek method | Important limitation |
| --- | --- | --- |
| Hill Score range | Combine ascent/km, longest continuous climb, 90th-percentile positive grade, uphill share, vertical speed and highest elevation, then map the normalized route severity to Garmin's published 1–100 category bands | Garmin's Hill Score is an athlete-history metric. A route can only suggest a capability range. |
| Endurance Score range | Combine target duration, distance, ascent and modeled active energy, then select the matching published Garmin age/sex reference band | Official Endurance Score also requires VO₂ max and 2-week to 3-month training history. |
| VO₂ max route-capacity range | Integrate segment oxygen demand, apply a bounded duration reserve and the documented acute-altitude availability factor, then widen the result by a documented uncertainty margin | This is required route capacity, not a measurement of the user's VO₂ max. |
| Lactate-threshold pace range | For trail runs lasting at least 20 minutes, convert the grade-adjusted oxygen requirement into a flat-equivalent pace window | Age and body size alone cannot predict personal lactate threshold. A measured threshold pace or heart rate is needed for personal comparison. Hikes and shorter runs show no value. |
| Active calories | Integrate active oxygen cost by segment for hiking/backpacking; use the Minetti running-energy candidate for trail running, with the selected movement and carried load | Terrain and pack effects are estimates; this will not exactly match Garmin's proprietary calculation. Minetti did not validate backpacks, so a nonzero trail-running pack is outside that source boundary. |
| Recovery window | Combine modeled calories, target duration and mean elevation into a bounded 0–96 hour route-load window | There is no validated universal conversion from one planned route to recovery hours. Garmin also uses EPOC, training history, remaining recovery, sleep and stress. |

For running, net metabolic power can be converted to oxygen demand using approximately `60 × watts-per-kg / 20.9`, then adding resting oxygen cost for a gross estimate. The current duration reserve uses the bounded candidate `f = (940 − T_minutes) / 1000` for efforts longer than ten minutes; its use in this prototype still requires external validation and should not be attributed as an official Minetti formula. An acute-altitude candidate reduces available VO₂ max by about 6.3% per 1,000 m above 300 m, but the supporting study only covered 300–2,800 m in eight trained, unacclimatized athletes. These limitations will be carried into the output uncertainty.

### 6. Recovery research boundary

If a current VO₂ max is available, segment effort can be normalized to oxygen reserve and summarized with Banister TRIMP:

```text
TRIMP = Σ minutes × x × A × exp(Bx)

men:    A = 0.64, B = 1.92
women:  A = 0.86, B = 1.67
```

`x` is relative exercise intensity. TRIMP is useful for ranking training load, but published research does not provide a universal TRIMP-to-recovery-hours equation. Until Track4Trek has validation data, the recovery output remains a broad, low-confidence heuristic. The 96-hour ceiling is only a presentation boundary comparable to Garmin's display, not Garmin's algorithm.

### 7. Confidence and validation plan

Every calculated result includes an internal confidence level and machine-readable reasons for uncertainty. Those fields support auditing and future calibration; the current website intentionally keeps them out of the visible dial labels. The implementation and validation plan is:

- **Medium confidence** is only assigned to model-based numeric estimates when the GPX has sufficient elevation coverage and the route speed, grade, carried-load ratio and altitude remain inside the cited study boundaries.
- **Low confidence** is assigned when elevation is missing or partial, a grade is clamped, speed/load/altitude is outside a source study, or the result depends on information the survey does not collect.
- Hill and Endurance ranges remain low confidence because Garmin's official scores depend on athlete history that a route file cannot provide.
- Recovery remains low confidence because there is no validated route-to-recovery-hours equation and Track4Trek does not yet have heart rate, recent training, sleep, stress or current-recovery data.
- `route-demand-v0.1` does not assign a **high confidence** level to any output. That level should only be introduced after external validation and interval calibration.
- Height is collected for profile completeness but is currently not used as a metabolic multiplier.

The stored reason codes include missing or partial elevation, clamped grade, speed/load/altitude outside the cited studies, unsupported age references, threshold inapplicability, missing heart-rate or training-history data, and an unvalidated-heuristic marker.

- unit-test monotonic behavior: more mass, steeper climbing or shorter target time must not reduce predicted demand;
- compare known routes across flat, rolling, mountainous and high-altitude conditions;
- validate calories against recorded heart-rate/power estimates and, where available, laboratory or field oxygen data;
- validate predicted route-capability bands against completed/not-completed attempts without training on the evaluation routes;
- report error distributions and calibrated intervals rather than a single precise-looking number;
- widen ranges when elevation, terrain, heart rate, training history or acclimatization data are absent.

The current parser retains coordinates, recorded elevation, timestamps, separated geometry and counts. It does not yet retain full GPX metadata, point extensions, Garmin sensor streams, trail-surface semantics, or corrected DEM values; those are separate future data contracts. Optional future profile inputs should include current VO₂ max, lactate-threshold pace/HR, max and resting HR, current Hill and Endurance Scores, recent weekly training volume, longest recent activity, elevation training and altitude acclimatization. The basic survey remains intentionally short for now.

## Research sources

Garmin documentation:

- [Hill Score science](https://www.garmin.com/en-GB/garmin-technology/running-science/running-dynamics/hill-score/) and [official category bands](https://www8.garmin.com/manuals/webhelp/GUID-EA112C95-8563-4EED-AADF-2AADFBB95646/EN-US/GUID-A805A45B-D4A6-468B-A2E4-77325B876F52.html)
- [Endurance Score science](https://www.garmin.com/en-GB/garmin-technology/running-science/physiological-measurements/endurance-score/) and [age/sex reference tables](https://www8.garmin.com/manuals/webhelp/GUID-E5C62F3F-DCE3-4197-8CA5-E419B2A55D12/EN-GB/GUID-573861DC-64B1-4120-847F-A944BA683DBA.html)
- [VO₂ max science](https://www.garmin.com/en-GB/garmin-technology/running-science/physiological-measurements/vo2-max/) and [age/sex reference tables](https://www8.garmin.com/manuals/webhelp/GUID-E5C62F3F-DCE3-4197-8CA5-E419B2A55D12/EN-GB/GUID-1FBCCD9E-19E1-4E4C-BD60-1793B5B97EB3.html)
- [Lactate-threshold science](https://www.garmin.com/en-CA/garmin-technology/running-science/physiological-measurements/lactate-threshold/)
- [Recovery-time science](https://www.garmin.com/en-US/garmin-technology/running-science/physiological-measurements/recovery-time/)
- [Garmin calorie calculation and terminology](https://support.garmin.com/en-US/?faq=lkl4cwCLlK7ox362uGQEV7&identifier=886725&tab=topics)

Primary academic sources:

- Ludlow & Weyand, [Walking economy is predictably determined by speed, grade, and gravitational load](https://doi.org/10.1152/japplphysiol.00504.2017)
- Looney et al., [Field validation of the Minimum Mechanics model](https://pmc.ncbi.nlm.nih.gov/articles/PMC8560389/)
- Minetti et al., [Energy cost of walking and running at extreme uphill and downhill slopes](https://doi.org/10.1152/japplphysiol.01177.2001)
- Wehrlin & Hallén, [Linear decrease in VO₂ max and performance with increasing altitude](https://doi.org/10.1007/s00421-005-0081-9)
- Faude et al., [Lactate-threshold concepts and methodological limitations](https://doi.org/10.2165/00007256-200939060-00003)
- Tanaka et al., [Age-predicted maximal heart-rate equation](https://doi.org/10.1016/S0735-1097(00)01054-8)
- Swain & Leutholtz, [Relationship between oxygen-reserve and heart-rate-reserve intensity](https://doi.org/10.1097/00005768-199703000-00018)
- Morton et al., [Training impulse and the impulse-response model](https://doi.org/10.1152/jappl.1990.69.3.1171)

## Technology and data

- Next.js 16, React 19, TypeScript and vinext
- MapLibre GL JS for the interactive map
- OpenStreetMap raster tiles for the basemap
- Mapterhorn terrain-rgb tiles for elevation, hillshade and DEM-derived contours
- `maplibre-contour` with a web worker for off-main-thread contour generation
- A local TypeScript GPX parser and browser storage; no route-analysis backend yet
- Open-Meteo forecast fields (up to 16 days) and NASA POWER 2001–2020 monthly climatology, fetched for representative route coordinates
- Weather indices are normalized, transparent proxies: heat, snow, storm, precipitation, atmospheric visibility, wind, UV and combined difficulty

Only sampled route coordinates and elevations are sent to the weather providers; the GPX text remains in the user's browser. The public sample-library copies retain route coordinates and elevation only: creator identity, timestamps, waypoints, notes, and vendor extensions are removed before publication. Monthly values are climatology, not a long-range forecast. Open-Meteo's forecast fields are aggregated across sampled points into route-wide daily rows; Pro also keeps a bounded set of hourly rows for inspection. NASA POWER does not provide a trail-visibility observation, so visibility and storm values are explicitly derived atmospheric proxies. Always check official forecasts and park notices before travelling.

## Local development

Requirements: Node.js 22.13 or newer and pnpm.

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Before publishing, run:

```bash
pnpm run lint
pnpm run build
  node --test tests/route-demand.test.mjs tests/pro-route-analysis.test.mjs tests/weather-model.test.mjs tests/rendered-html.test.mjs
pnpm run build:vercel
```

## Project map

- `app/page.tsx` — landing page and route intake
- `app/analyzing/page.tsx` — local parsing progress transition
- `app/results/page.tsx` — result-story composition
- `app/_components/route-intake.tsx` — GPX intake and profile survey
- `app/_lib/route-data.ts` — GPX parsing, validation, statistics and browser-storage schema
- `app/_lib/route-demand.ts` — pure route-demand calculator and versioned six-output analysis
- `app/_components/maplibre-terrain-map.tsx` — real map, terrain and DEM contours
- `app/_components/trail-map.tsx` — terrain scene, route facts and map/contour control
- `app/_components/elevation-profile.tsx` — elevation/grade profile
- `app/_components/weather-difficulty-chart.tsx` — Overview monthly weather dashboard and live strip
- `app/_components/pro-weather-workspace.tsx` — Pro weather matrix, daily/hourly tables and provider fields
- `app/_components/use-route-weather.ts` — shared cached weather request for both modes
- `app/_lib/weather.ts` — provider parsing, route sampling, indices and fallback model
- `app/_components/post-activity-forecast.tsx` — connected active-calorie and recovery dials
- `app/_components/pro-route-workspace.tsx` — GPX-only technical inspector and month-sensitive local dashboard
- `app/_lib/pro-route-analysis.ts` — deterministic GPX geometry, elevation, grade and segment summaries
- `tests/route-demand.test.mjs` — deterministic and monotonic calculator checks
- `tests/pro-route-analysis.test.mjs` — GPX inspector analysis coverage
- `tests/weather-model.test.mjs` — weather sampling, neutral missing fields and provider request coverage
- `app/globals.css` — themes, responsive layout and motion system
- `docs/HOMEPAGE_BUILD_GUIDE.md` — beginner-oriented building and publishing guide
- `docs/open-source-stack.md` — open-source GIS stack notes

## License and attribution direction

Route recommendations will be explainable and source-linked. Before production release, the project should add the selected data providers' required map attribution, a project license, privacy language, and a versioned methodology page. Garmin names and category bands are used only as reference material; Track4Trek estimates remain independent.
