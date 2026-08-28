import { DemandDial } from "../_components/demand-dial";
import { EnvironmentCycle } from "../_components/environment-cycle";
import { RouteDataPanel, WeatherDataPanel } from "../_components/result-data-panels";
import { SiteHeader } from "../_components/site-header";
import { TrailMap } from "../_components/trail-map";
import { WeatherDifficultyChart } from "../_components/weather-difficulty-chart";

const demands = [
  {
    label: "Hill score",
    range: "70–84",
    descriptor: "Skilled",
    start: 70,
    end: 84,
    tone: "orange" as const,
    unit: "Garmin scale · 1–100",
    reason: "Garmin’s published Skilled classification band.",
  },
  {
    label: "Endurance score",
    range: "6,600–7,299",
    descriptor: "Well trained",
    start: 66,
    end: 73,
    tone: "gold" as const,
    unit: "Male · age 21–39 example",
    reason: "Garmin ratings vary by age and sex.",
  },
  {
    label: "VO₂ max",
    range: "45.4–51.0",
    descriptor: "Good",
    start: 58,
    end: 72,
    tone: "cyan" as const,
    unit: "mL/kg/min · male 20–29",
    reason: "Garmin classifications depend on age and sex.",
  },
  {
    label: "Lactate threshold",
    range: "≈90%",
    descriptor: "Threshold HR",
    start: 87,
    end: 93,
    tone: "magenta" as const,
    unit: "of max HR · experienced runner",
    reason: "Garmin reports personal pace, heart rate and power.",
  },
];

export default function ResultsPage() {
  return (
    <main className="site-page results-page" id="main-content">
      <a className="skip-link" href="#terrain-result">Skip to trail map</a>
      <EnvironmentCycle />

      <SiteHeader active="results" minimal />
      <TrailMap />
      <RouteDataPanel />

      <section className="demand-section section-frame" id="metrics" aria-labelledby="demand-title">
        <h2 className="metrics-overlay-title" id="demand-title">
          Recommended metric ranges
        </h2>

        <div className="demand-grid">
          {demands.map((demand) => <DemandDial key={demand.label} {...demand} />)}
        </div>
      </section>

      <WeatherDifficultyChart />
      <WeatherDataPanel />

      <div className="result-notes section-frame">
        <div className="result-notes-copy">
          <p>
            Track4Trek is being built with MapLibre GL JS, OpenFreeMap, gpxjs,
            Turf.js and Open-Meteo. Route geometry, trip choices, elevation and
            weather will shape the final recommendations.
          </p>
          <p>
            The ranges are planning suggestions, not medical advice, a fitness test
            or a safety guarantee. Conditions and trail access can change quickly;
            always check official forecasts, park notices and local guidance.
          </p>
          <p>
            Garmin’s public reference ranges for <a href="https://www8.garmin.com/manuals/webhelp/GUID-3A4F9C4A-8735-46C0-8DA9-65F11400B150/EN-US/GUID-A805A45B-D4A6-468B-A2E4-77325B876F52.html" target="_blank" rel="noreferrer">Hill Score</a>, <a href="https://www8.garmin.com/manuals/webhelp/GUID-EA112C95-8563-4EED-AADF-2AADFBB95646/EN-US/GUID-573861DC-64B1-4120-847F-A944BA683DBA.html" target="_blank" rel="noreferrer">Endurance Score</a>, <a href="https://www8.garmin.com/manuals/webhelp/GUID-1E5740B3-60A1-4890-B39A-7587060D785A/EN-US/GUID-1FBCCD9E-19E1-4E4C-BD60-1793B5B97EB3.html" target="_blank" rel="noreferrer">VO₂ Max</a> and <a href="https://www8.garmin.com/manuals/webhelp/GUID-3A4F9C4A-8735-46C0-8DA9-65F11400B150/EN-US/GUID-3ED97FFE-025E-47EA-9C70-DD86156617BD.html" target="_blank" rel="noreferrer">Lactate Threshold</a> inform the labels shown here. All route recommendations are original Track4Trek estimates; Track4Trek is not affiliated with or endorsed by Garmin.
          </p>
        </div>
      </div>
    </main>
  );
}
