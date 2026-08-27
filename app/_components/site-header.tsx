import Link from "next/link";

type SiteHeaderProps = {
  active?: "plan" | "results";
  minimal?: boolean;
};

export function SiteHeader({ active, minimal = false }: SiteHeaderProps) {
  return (
    <header className={`site-header${minimal ? " is-minimal" : ""}`}>
      <Link className="site-brand" href="/" aria-label="Track4Trek home">
        <span className="brand-orbit" aria-hidden="true">
          <i />
        </span>
        <span className="brand-wordmark">Track<span>4</span>Trek</span>
      </Link>

      {!minimal && (
        <nav className="header-nav" aria-label="Main navigation">
          <Link href="/#route-input" aria-current={active === "plan" ? "page" : undefined}>
            Plan a route
          </Link>
          <Link href="/results" aria-current={active === "results" ? "page" : undefined}>
            Result preview
          </Link>
        </nav>
      )}

      <span className="phase-chip">{minimal ? "01 / 04" : "Phase 1"}</span>
    </header>
  );
}
