"use client";

import { useLanguage } from "./_components/language-system";
import { RouteIntake } from "./_components/route-intake";

export default function Home() {
  const { text } = useLanguage();

  return (
    <main className="site-page landing-page" id="main-content">
      <a className="skip-link" href="#route-input">
        {text("Skip to route input", "跳至路线导入")}
      </a>
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="hero-copy-block">
          <p className="prototype-kicker">
            <span aria-hidden="true" /> {text("Route intelligence", "路线智能分析")}
          </p>
          <h1 id="landing-title">
            {text("Know what the trail asks.", "了解这条路线对你的要求。")}
          </h1>
          <p className="hero-summary">
            {text(
              "Terrain, effort and conditions—from one GPX route.",
              "从一份 GPX 路线，读懂地形、体能与环境条件。",
            )}
          </p>
        </div>

        <RouteIntake />
      </section>
    </main>
  );
}
