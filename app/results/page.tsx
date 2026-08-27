import { DemandDial } from "../_components/demand-dial";
import { SiteFooter } from "../_components/site-footer";
import { SiteHeader } from "../_components/site-header";
import { TerrainPreview } from "../_components/terrain-preview";
import Link from "next/link";

const demands = [
  {
    label: "Aerobic demand",
    range: "62–74",
    descriptor: "High demand",
    end: 74,
    tone: "orange" as const,
    reason: "Sustained climbing across the target moving time.",
  },
  {
    label: "Climbing demand",
    range: "72–84",
    descriptor: "Very high",
    end: 84,
    tone: "gold" as const,
    reason: "1,420 m ascent with two concentrated climb blocks.",
  },
  {
    label: "Sustained endurance",
    range: "58–70",
    descriptor: "High demand",
    end: 70,
    tone: "lime" as const,
    reason: "A long attempt with limited low-effort recovery terrain.",
  },
  {
    label: "Altitude exposure",
    range: "18–30",
    descriptor: "Low–moderate",
    end: 30,
    tone: "lime" as const,
    reason: "The sample route remains below 1,000 m.",
  },
];

const methodItems = [
  ["Route geometry", "Distance, ascent, descent and steepness"],
  ["Trip plan", "Activity style, moving time and pack load"],
  ["Conditions", "Elevation and expected weather"],
  ["Confidence", "Data coverage and missing inputs"],
];

export default function ResultsPage() {
  return (
    <main className="site-page results-page" id="main-content">
      <a className="skip-link" href="#terrain-result">Skip to route result</a>
      <SiteHeader active="results" />

      <section className="result-intro section-frame" aria-labelledby="result-title">
        <div className="result-title-block">
          <p className="prototype-kicker"><span aria-hidden="true" /> Route demand preview</p>
          <h1 id="result-title">What this route may ask of you.</h1>
          <p>A planning view of terrain, sustained effort and environmental exposure.</p>
        </div>

        <div className="route-identity">
          <div>
            <span>Sample route</span>
            <strong>Lantau ridge traverse</strong>
          </div>
          <span className="confidence-chip">Medium confidence</span>
        </div>
      </section>

      <section className="terrain-section section-frame" id="terrain-result" aria-label="Terrain and route overview">
        <TerrainPreview />

        <dl className="route-summary">
          <div><dt>Distance</dt><dd>23.4 <small>km</small></dd></div>
          <div><dt>Total ascent</dt><dd>1,420 <small>m</small></dd></div>
          <div><dt>Target time</dt><dd>7:00 <small>hr</small></dd></div>
          <div><dt>Pack load</dt><dd>8–12 <small>kg</small></dd></div>
          <div><dt>Peak elevation</dt><dd>934 <small>m</small></dd></div>
        </dl>
      </section>

      <section className="demand-section section-frame" aria-labelledby="demand-title">
        <div className="demand-heading">
          <div>
            <p className="section-kicker">Track4Trek indicators</p>
            <h2 id="demand-title">Suggested route-demand ranges</h2>
          </div>
          <p>
            Scores use a 0–100 planning scale. They describe the planned attempt—not
            your health, diagnosis or measured fitness.
          </p>
        </div>

        <div className="demand-grid">
          {demands.map((demand) => <DemandDial key={demand.label} {...demand} />)}
        </div>

        <article className="weather-strip">
          <div className="weather-mark" aria-hidden="true"><span /><i /></div>
          <div>
            <span>Environmental preview</span>
            <h3>Heat stress potential · 44–58</h3>
          </div>
          <p>Moderate exposure in the sample afternoon window.</p>
          <span className="weather-status">Weather model · Phase 4</span>
        </article>
      </section>

      <section className="method-section" aria-labelledby="method-title">
        <div className="method-inner section-frame">
          <div className="method-heading">
            <p className="section-kicker">Transparent by design</p>
            <h2 id="method-title">What shapes the preview</h2>
          </div>

          <div className="method-items">
            {methodItems.map(([title, text], index) => (
              <article key={title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>

          <div className="source-panel">
            <div>
              <span>Planned open stack</span>
              <p>MapLibre GL JS · OpenFreeMap · gpxjs · Turf.js · Open-Meteo</p>
            </div>
            <p>
              Sources, assumptions and model versions will be documented as development progresses.
            </p>
          </div>

          <div className="limitations-panel">
            <p className="limitation-label">Planning note</p>
            <div>
              <h3>A suggestion, not a verdict.</h3>
              <p>
                Track4Trek provides educational planning estimates, not medical advice, a fitness
                test or a safety guarantee. Weather, access and trail surfaces can change quickly.
                Check official forecasts, park notices and local guidance before travelling.
              </p>
              <p>
                All indicators are original Track4Trek estimates. Track4Trek is not affiliated
                with or endorsed by Garmin or any other device manufacturer.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="result-actions section-frame">
        <Link className="secondary-action" href="/">Start another preview</Link>
        <a className="primary-action" href="#terrain-result">Back to route <span aria-hidden="true">↑</span></a>
      </div>

      <SiteFooter />
    </main>
  );
}
