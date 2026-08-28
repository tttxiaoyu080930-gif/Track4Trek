import { TransitionLink } from "./transition-link";

type SiteHeaderProps = {
  active?: "plan" | "results";
  minimal?: boolean;
};

export function SiteHeader({ active, minimal = false }: SiteHeaderProps) {
  return (
    <header className={`site-header${minimal ? " is-minimal" : ""}`}>
      <TransitionLink className="site-brand" href="/" aria-label="Track4Trek home">
        <span className="brand-orbit" aria-hidden="true">
          <i />
        </span>
        <span className="brand-wordmark">Track<span>4</span>Trek</span>
      </TransitionLink>

      {!minimal && (
        <nav className="header-nav" aria-label="Main navigation">
          <TransitionLink href="/#route-input" aria-current={active === "plan" ? "page" : undefined}>
            Plan a route
          </TransitionLink>
          <TransitionLink href="/results" aria-current={active === "results" ? "page" : undefined}>
            Result preview
          </TransitionLink>
        </nav>
      )}

      <span className="phase-chip">{minimal ? "01 / 04" : "Phase 1"}</span>
    </header>
  );
}
