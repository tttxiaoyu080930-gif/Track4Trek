import { RouteIntake } from "./_components/route-intake";
import { SiteHeader } from "./_components/site-header";

export default function Home() {
  return (
    <main className="site-page landing-page" id="main-content">
      <a className="skip-link" href="#route-input">
        Skip to route input
      </a>
      <SiteHeader active="plan" minimal />

      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-image" aria-hidden="true" />
        <div className="landing-shade" aria-hidden="true" />
        <div className="mist-layer mist-one" aria-hidden="true" />
        <div className="mist-layer mist-two" aria-hidden="true" />

        <div className="hero-copy-block">
          <p className="prototype-kicker">
            <span aria-hidden="true" /> Route intelligence
          </p>
          <h1 id="landing-title">Know what the trail asks.</h1>
          <p className="hero-summary">
            Terrain, effort and conditions—from one GPX route.
          </p>
        </div>

        <RouteIntake />
      </section>
    </main>
  );
}
