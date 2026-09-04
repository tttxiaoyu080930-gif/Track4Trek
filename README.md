# Track4Trek

Track4Trek is an open geospatial engineering project for answering a practical question: **what will this route ask of me?** A user uploads a GPX route, chooses an activity, a single-day or multi-day plan, total moving time, and a small personal profile. The application extracts route geometry and recorded elevation, then produces transparent route-demand ranges, a route-specific seasonal weather baseline, a short live forecast, expected active calories, and a conservative recovery window.

Public project domain: [siuyuk.xyz](https://siuyuk.xyz)

Track4Trek is not affiliated with Garmin. It will not claim to calculate official Garmin metrics, diagnose fitness, or guarantee that a route is safe.

## Current state

The project is now beyond the original visual-only prototype:

- GPX files are parsed locally in the browser; no route file is uploaded to a Track4Trek server.
- The landing page includes a lazy-loaded library of five real sample routes for users without a GPX file.
- Route distance, ascent, descent, elevation range, required pace, vertical speed, elevation profile, and geographic segments are derived from the file.
- The trip survey stores activity, single-day/multi-day structure, planned days, total moving time, gender selection, age, body weight, height, and backpack weight in kilograms.
- The result page renders the route on a real interactive 3D terrain map using MapLibre GL JS.
- Terrain and DEM-derived contour lines use the same cached Mapterhorn elevation tiles.
- Users can switch between contour rendering and the real map without remounting the map.
- Overview elevation/grade, annual difficulty/weather, and Pro elevation/gradient graphs share a centered horizontal zoom slider. Elevation bars and weather points expose exact X/Y values by pointer, touch or arrow-key inspection; the Pro graph also interpolates clean visible-range boundaries when zoomed.
- Dark/light themes, English/Mandarin, responsive layouts, and reduced-motion behavior are implemented.
- Overview weather combines a twelve-month NASA POWER climatology baseline with a sampled Open-Meteo forecast when providers respond.
- OpenStreetMap surface, track type and highway tags are sampled at equal-distance points along the GPX corridor through a bounded server-side Overpass query. The result reports mapped coverage separately from explicit `surface=*` coverage.
- The monthly surface panel keeps static mapped composition separate from weather-derived mud, snow/ice and slick-rock condition proxies. Users can move through all twelve months and inspect every percentage and the bounded terrain-cost factor.
- Overview difficulty is now a comprehensive route-planning index: GPX terrain, daily Endurance demand, aerobic demand, carried load, distance-weighted altitude exposure, mapped trail surface, and selected-month weather are displayed as separate auditable components.
- Pro weather exposes the representative coordinates, all monthly index columns, route-wide daily fields, sampled hourly fields, and atmospheric inputs used by the derived indices.

The route-demand outputs are now connected to the saved route and survey through the versioned, deterministic `route-demand-v0.3` calculator. The results page reads the browser-stored `RoutePreview` once after hydration, calculates one analysis object, and passes that same object to the difficulty model and all six dials:

- Hill Score capability range
- Endurance Score reference range
- VO₂ max route-capacity range
- Lactate-threshold pace range (trail running only when the target moving time is at least 20 minutes)
- Active-calorie range
- Recovery-time window

These are Track4Trek route-demand estimates informed by Garmin's published reference material; they are not official Garmin measurements or a reverse-engineered Garmin algorithm. Confidence fields and reason codes remain in the model for audit and are documented below, but are deliberately not shown as labels in the website interface. The overview is ordered as map, elevation profile, surface conditions, month-sensitive comprehensive difficulty, four capability metrics, and the post-activity calorie/recovery forecast. A separate Pro mode exposes a restrained GPX inspector with file counts, geometry, elevation statistics, grade distribution, extrema, separated segments, field availability, and resizable elevation/gradient charts. Its local dashboard recalculates the comprehensive score and all six outputs when activity, trip structure, planned days, profile inputs, or starting month changes. Multi-day Pro output also lists every estimated daily Endurance stage, its altitude exposure, and the limiting day. Weather and monthly surface-condition factors are bounded planning proxies and never replace an official forecast or local trail report.

## Survey schema

| Input | Unit/options | Current use |
| --- | --- | --- |
| Activity | Hike, trail run, backpack | Select the appropriate movement-energy model |
| Trip structure | Single day or multi-day | Choose continuous Endurance modeling or daily-stage modeling |
| Planned days | Integer, 2–30 for multi-day | Set the number of contiguous modeled daily stages |
| Total moving time | Hours and minutes | Convert route geometry into required pace and distribute moving time across the full itinerary; plan-aware limits prevent impossible single-day or per-day durations |
| Gender | Male or female | Select Garmin Endurance/VO₂ reference classifications; not used to invent metabolic demand or calories |
| Age | Years | Select age-specific reference bands |
| Body weight | kg | Convert oxygen/energy cost into calories |
| Height | cm | Profile context and future validation; it is not an invented multiplier in the current research model |
| Backpack weight | kg | Estimate the additional metabolic cost of carried load |

The profile is stored with the parsed preview in browser `localStorage`. Survey schema version 4 adds the trip structure and planned-day count. A valid version 3 preview is migrated in memory to `single-day` with `plannedDays: 1`; the stored GPX is not silently reclassified as a multi-day trip.

The accepted moving-time window is 15 minutes to 48 hours for a single day. A multi-day plan requires at least 15 minutes per planned day and allows at most 24 hours per planned day, capped at 480 total hours. These are input-sanity boundaries, not recommended daily hiking durations.

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
| Hill Score range | Combine ascent/km, longest continuous climb, 90th-percentile positive grade, uphill share, vertical speed, highest elevation and altitude exposure, then map the normalized route severity to Garmin's published 1–100 category bands | Garmin's Hill Score is an athlete-history metric. A route can only suggest a capability range. |
| Endurance Score range | For one day, combine altitude-adjusted duration, distance, ascent and modeled active energy. For multi-day plans, preserve each stage's mean altitude, calculate every balanced daily stage separately, apply bounded overnight carry, and map the limiting adjusted day to Garmin's published age/sex reference band. | The GPX has no campsite boundaries or acclimatization history, and official Endurance Score also requires VO₂ max and 2-week to 3-month training history. |
| VO₂ max route-capacity range | Integrate segment oxygen demand, apply a bounded duration reserve and the documented acute-altitude availability factor, then widen the result by a documented uncertainty margin | This is required route capacity, not a measurement of the user's VO₂ max. |
| Lactate-threshold pace range | For trail runs lasting at least 20 minutes, convert the grade-adjusted oxygen requirement into a flat-equivalent pace window | Age and body size alone cannot predict personal lactate threshold. A measured threshold pace or heart rate is needed for personal comparison. Hikes and shorter runs show no value. |
| Active calories | Integrate active oxygen cost by segment for hiking/backpacking; use the Minetti running-energy candidate for trail running, with the selected movement and carried load | Terrain and pack effects are estimates; this will not exactly match Garmin's proprietary calculation. Minetti did not validate backpacks, so a nonzero trail-running pack is outside that source boundary. |
| Recovery window | Combine modeled calories, target duration and the altitude-exposure severity into a bounded 0–96 hour route-load window | There is no validated universal conversion from one planned route to recovery hours. Garmin also uses EPOC, training history, remaining recovery, sleep and stress. |

For running, net metabolic power can be converted to oxygen demand using approximately `60 × watts-per-kg / 20.9`, then adding resting oxygen cost for a gross estimate. The current duration reserve uses the bounded candidate `f = (940 − T_minutes) / 1000` for efforts longer than ten minutes; its use in this prototype still requires external validation and should not be attributed as an official Minetti formula.

### 6. Altitude exposure and comprehensive difficulty

Wehrlin and Hallén measured a mean VO₂ max decline of about 6.3% per 1,000 m between 300 and 2,800 m in eight trained, unacclimatized athletes. `route-demand-v0.3` applies that slope to every elevation segment and distance-weights the retained acute aerobic capacity:

```text
segment availability = clamp(1 − 0.063 × max(elevation − 300, 0) / 1000, 0.65, 1)
route availability   = Σ(segment availability × segment distance) / total distance
```

The model also records distance shares above 2,500, 3,000 and 4,000 m. Endurance demand uses altitude-adjusted time, distance/ascent and energy equivalents; VO₂ and trail-running threshold demand use the distance-weighted availability; Hill demand and recovery include a bounded altitude severity. Multi-day stages keep their own distance-weighted mean altitude. Active calories are deliberately **not** multiplied by an altitude factor: the GPX energy model already represents mechanical movement and load, while the available evidence does not justify inventing a universal extra calorie percentage.

Above 2,800 m, the linear performance relationship is a bounded extrapolation, not a validated physiological law. Acclimatization can materially improve subsequent high-altitude performance, but the current survey does not collect recent altitude exposure. Wilderness Medical Society guidance also treats ascent schedule, sleeping altitude and individual history as central to altitude-illness risk; ordinary GPX data contains none of these. Track4Trek therefore describes this as an **acute, unacclimatized performance reference**, never an AMS probability or medical prediction.

`route-difficulty-v0.2` first calculates intrinsic route demand using named Track4Trek engineering weights, then applies a separately bounded surface adjustment before weather:

```text
intrinsic = 0.30 endurance + 0.24 terrain + 0.18 aerobic
          + 0.18 altitude + 0.10 carried load

surface-adjusted = 100 × [1 − (1 − intrinsic/100) × (1 − 0.16 × surface/100)]

comprehensive = 100 × [1 − (1 − surface-adjusted/100) × (1 − 0.50 × weather/100)]
```

Each component is clamped to 0–100 and displayed in Overview and Pro mode. Surface consumes at most 16% of remaining intrinsic headroom and weather consumes at most half of what remains, so missing map data is neutral and good weather cannot make the intrinsic GPX route easier. This is a transparent comparative planning index, not a validated universal difficulty scale; its weights require future calibration against completed routes and user outcomes.

### 7. Trail surface and seasonal condition model

The GPX format usually does not encode ground surface. Track4Trek therefore samples 8–12 equal-distance midpoint coordinates and sends only those coordinates—not the GPX file—to a server-side Overpass query. Nearby OpenStreetMap `highway`, `surface` and `tracktype` tags are classified into paved/built, earth/trail, gravel, rock, sand, unknown mapped way, or unmatched/off-trail corridor. The panel publishes both the overall matched-corridor percentage and the stricter percentage with an explicit `surface=*` tag. An unmatched point means that no nearby mapped way was found within the current corridor tolerance; it does **not** prove that no trail exists.

Base composition is static map data. Month-dependent mud and snow/ice shares are separately derived from the selected monthly precipitation, humidity, heat, cold and snow proxies. Rock receives a bounded slickness increment in wet/cold months. The resulting terrain factor ranges from approximately 1.0 on firm/built ground toward 1.55 for the most costly represented surface state. This deliberately conservative range is informed by published load-carriage terrain-factor practice, but the current mixture and monthly conversion are original Track4Trek engineering calibrations, not a validated field-surface model.

If OpenStreetMap data is unavailable, surface demand is neutral and the previous route/weather score is preserved. Live closures, landslides, recent snowfall, river crossings, vegetation, trail maintenance and actual mud depth remain outside this model.

### 8. Multi-day Endurance model

The former calculator passed the total duration, distance, ascent and energy of an expedition into one continuous-effort equation. A five-day trek could therefore look like a 50-hour nonstop activity and saturate the highest Endurance category. `route-demand-v0.3` treats multi-day plans differently:

1. estimate each ordered route segment's energy at the whole-route target pace;
2. split the GPX into `N` contiguous stages with approximately equal modeled effort, proportionally dividing a segment when a stage boundary falls inside it;
3. preserve the whole-route target pace by distributing moving time by distance, distribute active energy by modeled-effort share, preserve total route distance, and scale stage ascent so the daily totals match the GPX ascent summary;
4. calculate each day's raw severity `sᵢ` with the existing duration/distance/ascent/energy equation;
5. apply a bounded carry from the preceding day and use the hardest adjusted day for the final reference band.

```text
A₁ = s₁
Aᵢ = sᵢ + 0.35 × Aᵢ₋₁ × (1 − sᵢ)
trip severity = max(A₁ … Aₙ)
```

All raw and adjusted values are clamped to `[0, 1]`. The recurrence lets incomplete overnight recovery matter but saturates instead of increasing without limit. `0.35` is a named Track4Trek planning calibration, not a Garmin parameter or a physiological constant; a future validation study should test at least the `0.25–0.45` sensitivity range. Besson et al. found different fatigue and recovery patterns when the same mountain course was completed continuously versus over four successive stages, which motivates modeling the formats separately. Straight et al. found residual effects across repeated load-carriage bouts, but its 14 male soldiers carried unusually heavy loads of 30–50% of body mass. Morton et al.'s impulse-response framework supports only the qualitative idea of recurrent, decaying fatigue; it does not model overnight trekking recovery or supply the `0.35` coefficient. These studies establish model direction—not a universal trekking coefficient.

Because ordinary GPX files do not mark camps, food stops, sleep, or planned stage boundaries, the current split assumes balanced modeled-effort days. The Pro table makes that assumption auditable. Actual camp locations, rest, nutrition, sleep, weather, terrain surface, and training history can change the hardest day substantially.

### 9. Recovery research boundary

If a current VO₂ max is available, segment effort can be normalized to oxygen reserve and summarized with Banister TRIMP:

```text
TRIMP = Σ minutes × x × A × exp(Bx)

men:    A = 0.64, B = 1.92
women:  A = 0.86, B = 1.67
```

`x` is relative exercise intensity. TRIMP is useful for ranking training load, but published research does not provide a universal TRIMP-to-recovery-hours equation. Until Track4Trek has validation data, the recovery output remains a broad, low-confidence heuristic. The 96-hour ceiling is only a presentation boundary comparable to Garmin's display, not Garmin's algorithm.

### 10. Confidence and validation plan

Every calculated result includes an internal confidence level and machine-readable reasons for uncertainty. Those fields support auditing and future calibration; the current website intentionally keeps them out of the visible dial labels. The implementation and validation plan is:

- **Medium confidence** is only assigned to model-based numeric estimates when the GPX has sufficient elevation coverage and the route speed, grade, carried-load ratio and altitude remain inside the cited study boundaries.
- **Low confidence** is assigned when elevation is missing or partial, a grade is clamped, speed/load/altitude is outside a source study, or the result depends on information the survey does not collect.
- Hill and Endurance ranges remain low confidence because Garmin's official scores depend on athlete history that a route file cannot provide.
- Recovery remains low confidence because there is no validated route-to-recovery-hours equation and Track4Trek does not yet have heart rate, recent training, sleep, stress or current-recovery data.
- `route-demand-v0.3` does not assign a **high confidence** level to any output. That level should only be introduced after external validation and interval calibration.
- Height is collected for profile completeness but is currently not used as a metabolic multiplier.

The stored reason codes include missing or partial elevation, clamped grade, speed/load/altitude outside the cited studies, unsupported age references, threshold inapplicability, missing heart-rate or training-history data, the balanced multi-day stage assumption, and an unvalidated-heuristic marker.

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
- Fulco et al., [Acclimatization to moderate altitude improves high-altitude time-trial performance](https://pubmed.ncbi.nlm.nih.gov/19911519/)
- Wilderness Medical Society, [Clinical Practice Guidelines for the Prevention and Treatment of Acute Altitude Illness: 2019 Update](https://doi.org/10.1016/j.wem.2019.04.006)
- Faude et al., [Lactate-threshold concepts and methodological limitations](https://doi.org/10.2165/00007256-200939060-00003)
- Tanaka et al., [Age-predicted maximal heart-rate equation](https://doi.org/10.1016/S0735-1097(00)01054-8)
- Swain & Leutholtz, [Relationship between oxygen-reserve and heart-rate-reserve intensity](https://doi.org/10.1097/00005768-199703000-00018)
- Besson et al., [Fatigue and Recovery after Single-Stage versus Multistage Ultramarathon Running](https://doi.org/10.1249/MSS.0000000000002303)
- Straight et al., [Repeated bouts of load carriage alter indirect markers of exercise-induced muscle damage, liver enzymes, and oxygen-carrying capacity in male soldiers](https://doi.org/10.14814/phy2.70268)
- Morton et al., [Modeling human performance in running](https://doi.org/10.1152/jappl.1990.69.3.1171)

Open geospatial references:

- OpenStreetMap Wiki, [`surface=*`](https://wiki.openstreetmap.org/wiki/Key:surface), [`tracktype=*`](https://wiki.openstreetmap.org/wiki/Key:tracktype), and [`trail_visibility=*`](https://wiki.openstreetmap.org/wiki/Key:trail_visibility) tagging references
- OpenStreetMap Wiki, [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) and [Overpass QL](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL) query documentation

## Technology and data

- Next.js 16, React 19, TypeScript and vinext
- MapLibre GL JS for the interactive map
- OpenStreetMap raster tiles for the basemap
- Mapterhorn terrain-rgb tiles for elevation, hillshade and DEM-derived contours
- `maplibre-contour` with a web worker for off-main-thread contour generation
- A local TypeScript GPX parser and browser storage; no route-analysis backend yet
- Open-Meteo forecast fields (up to 16 days) and NASA POWER 2001–2020 monthly climatology, fetched for representative route coordinates
- OpenStreetMap way tags through a bounded server-side Overpass query for representative equal-distance route points
- Weather indices are normalized, transparent proxies: heat, snow, storm, precipitation, atmospheric visibility, wind, UV and weather stress. The separate comprehensive score then combines that weather stress with intrinsic route demand.

Only sampled route coordinates and elevations are sent to weather providers, and only sampled coordinates are sent to the surface provider; the GPX text remains in the user's browser. OpenStreetMap data is © OpenStreetMap contributors and is queried through Overpass. The public sample-library copies retain route coordinates and elevation only: creator identity, timestamps, waypoints, notes, and vendor extensions are removed before publication. Monthly values are climatology, not a long-range forecast. Open-Meteo's forecast fields are aggregated across sampled points into route-wide daily rows; Pro also keeps a bounded set of hourly rows for inspection. NASA POWER does not provide a trail-visibility observation, so visibility and storm values are explicitly derived atmospheric proxies. Always check official forecasts, park notices and current local trail reports before travelling.

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
- `app/_components/trail-surface-panel.tsx` — mapped surface percentages and month-dependent condition proxies
- `app/_lib/surface.ts` — route sampling, OpenStreetMap classification and monthly surface model
- `app/api/trail/surface/route.ts` — bounded Overpass proxy and geometry matching
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

## Interaction performance

Overview elevation and weather canvases share a frame-coalesced rendering hook: resize, theme and interaction updates paint at most once per animation frame. Off-screen canvases and hidden browser tabs defer painting until visible, and observers are cleaned up on unmount. Canvas buffers are resized only when dimensions change; elevation preprocessing is reused between hover updates. Pro mode is loaded on demand. Scenery movement uses composited transforms instead of animating the full-resolution image crop. Theme changes also refresh charts inside comparison panes.

`tests/canvas-render.test.mjs` checks frame coalescing, off-screen/hidden-tab suspension, resumption and cleanup. These optimizations are not a guarantee of a particular frame rate: terrain loading still depends on device GPU and provider/network response times.

## License and attribution direction

Route recommendations will be explainable and source-linked. Before production release, the project should add the selected data providers' required map attribution, a project license, privacy language, and a versioned methodology page. Garmin names and category bands are used only as reference material; Track4Trek estimates remain independent.
