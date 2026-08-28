import { TransitionLink } from "./transition-link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <TransitionLink className="footer-brand" href="/">Track<span>4</span>Trek</TransitionLink>
      <p>An independent engineering project connecting trekking with open geospatial analysis.</p>
      <p className="footer-phase">Visual prototype · Phase 1 of 4</p>
    </footer>
  );
}
