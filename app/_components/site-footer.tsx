import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <Link className="footer-brand" href="/">Track<span>4</span>Trek</Link>
      <p>An independent engineering project connecting trekking with open geospatial analysis.</p>
      <p className="footer-phase">Visual prototype · Phase 1 of 4</p>
    </footer>
  );
}
