const steps = [
  {
    number: "01",
    title: "Upload the line",
    text: "Bring a GPX route from your watch, planner, or trekking archive. The route stays in your browser for the first release.",
  },
  {
    number: "02",
    title: "Set the attempt",
    text: "Choose light hiking or backpacking, set pack weight, and enter the pure moving time you want to achieve.",
  },
  {
    number: "03",
    title: "Read the demand",
    text: "See the climb, aerobic, endurance, altitude, and weather demands with assumptions and uncertainty shown beside them.",
  },
];

const openStack = ["MapLibre", "OpenFreeMap", "Open-Meteo", "Turf.js", "OpenStreetMap"];

export default function Home() {
  return (
    <main>
      <nav className="site-nav" aria-label="Main navigation">
        <a className="brand" href="#top" aria-label="Track4Trek home">
          <span className="brand-mark" aria-hidden="true">T4T</span>
          <span>Track4Trek</span>
        </a>
        <div className="nav-links">
          <a href="#how-it-works">How it works</a>
          <a href="#method">Method</a>
          <a className="nav-cta" href="#project-status">Project status</a>
        </div>
      </nav>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><span aria-hidden="true" /> Open geospatial prototype</p>
          <h1>Know what the trail asks of you.</h1>
          <p className="hero-intro">
            Turn any trekking route into an explainable demand profile—built from distance,
            climbing, altitude, target time, pack load, and weather.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#how-it-works">Explore the model <span aria-hidden="true">↗</span></a>
            <a className="button button-secondary" href="#project-status">Follow the build</a>
          </div>
          <dl className="hero-proof" aria-label="Project principles">
            <div><dt>Open</dt><dd>No commercial GIS lock-in</dd></div>
            <div><dt>Explainable</dt><dd>Every score shows its reason</dd></div>
            <div><dt>Route-first</dt><dd>No wearable account required</dd></div>
          </dl>
        </div>

        <div className="route-card" aria-label="Example route demand summary">
          <div className="route-card-head">
            <div>
              <p>Sample analysis</p>
              <h2>Mountain traverse</h2>
            </div>
            <span className="status-pill">Model preview</span>
          </div>

          <div className="terrain-plot" aria-label="Stylized elevation profile">
            <div className="grid-lines" aria-hidden="true" />
            <div className="mountain mountain-back" aria-hidden="true" />
            <div className="mountain mountain-front" aria-hidden="true" />
            <div className="route-line" aria-hidden="true">
              <i /><i /><i /><i /><i />
            </div>
            <span className="plot-label plot-start">0 km</span>
            <span className="plot-label plot-peak">2,740 m</span>
            <span className="plot-label plot-end">23.4 km</span>
          </div>

          <div className="route-stats">
            <div><span>Distance</span><strong>23.4 km</strong></div>
            <div><span>Ascent</span><strong>+1,620 m</strong></div>
            <div><span>Moving time</span><strong>7h 00m</strong></div>
          </div>

          <div className="demand-list">
            <div className="demand-row">
              <span>Aerobic</span><div className="meter"><i style={{ width: "78%" }} /></div><strong>High</strong>
            </div>
            <div className="demand-row">
              <span>Climbing</span><div className="meter"><i style={{ width: "88%" }} /></div><strong>Very high</strong>
            </div>
            <div className="demand-row">
              <span>Endurance</span><div className="meter"><i style={{ width: "67%" }} /></div><strong>High</strong>
            </div>
          </div>

          <p className="card-note">Illustrative result—not a medical or safety assessment.</p>
        </div>
      </section>

      <section className="purpose-strip" aria-label="Project statement">
        <p>Not another route directory.</p>
        <strong>A translation layer between terrain and human effort.</strong>
      </section>

      <section className="process section-shell" id="how-it-works">
        <div className="section-heading">
          <p className="eyebrow"><span aria-hidden="true" /> How it works</p>
          <h2>From a route line to a useful decision.</h2>
          <p>The first release keeps the workflow intentionally short and the reasoning visible.</p>
        </div>
        <div className="step-grid">
          {steps.map((step) => (
            <article className="step-card" key={step.number}>
              <span>{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="method section-shell" id="method">
        <div className="method-copy">
          <p className="eyebrow light"><span aria-hidden="true" /> Method, not mystery</p>
          <h2>The result should be understandable before it is impressive.</h2>
          <p>
            The platform samples elevation along the route, identifies sustained climbs,
            distributes the target time across changing gradients, and estimates demand under
            the selected load. Weather is attached to where you are expected to be—not only to
            the trailhead.
          </p>
          <a href="#principles">Read the modelling principles <span aria-hidden="true">→</span></a>
        </div>
        <div className="method-grid" id="principles">
          <article><span>01</span><h3>Ranges over verdicts</h3><p>Outputs show a plausible band and confidence, not a false pass/fail guarantee.</p></article>
          <article><span>02</span><h3>Reasons beside scores</h3><p>The hardest climb, altitude exposure, duration, and missing data remain visible.</p></article>
          <article><span>03</span><h3>Open infrastructure</h3><p>The mapping and analysis stack can be inspected, replaced, and self-hosted.</p></article>
          <article><span>04</span><h3>Validation in public</h3><p>Test routes, model versions, limitations, and changes will be documented.</p></article>
        </div>
      </section>

      <section className="open-section section-shell">
        <div>
          <p className="eyebrow"><span aria-hidden="true" /> Built in the open</p>
          <h2>Geospatial tools without platform lock-in.</h2>
        </div>
        <div className="stack-list" aria-label="Open source technology stack">
          {openStack.map((item) => <span key={item}>{item}</span>)}
        </div>
        <p className="open-note">
          Map rendering, route geometry, elevation, and weather are separated into replaceable
          providers. The analysis model remains independent of any one map company.
        </p>
      </section>

      <section className="project-status section-shell" id="project-status">
        <div>
          <p className="eyebrow light"><span aria-hidden="true" /> Now building</p>
          <h2>Homepage complete. Route analysis comes next.</h2>
        </div>
        <ol>
          <li className="done"><span>01</span><div><strong>Project foundation</strong><small>Open stack, product scope, visual language</small></div></li>
          <li className="active"><span>02</span><div><strong>Route uploader</strong><small>GPX parsing, validation, map preview</small></div></li>
          <li><span>03</span><div><strong>Terrain model</strong><small>Elevation, gradients, climbs, target pace</small></div></li>
          <li><span>04</span><div><strong>Demand report</strong><small>Fitness ranges, weather, uncertainty</small></div></li>
        </ol>
      </section>

      <footer>
        <div className="brand footer-brand"><span className="brand-mark" aria-hidden="true">T4T</span><span>Track4Trek</span></div>
        <p>An independent engineering project connecting trekking experience with open geospatial analysis.</p>
        <a href="#top">Back to top ↑</a>
      </footer>
    </main>
  );
}
