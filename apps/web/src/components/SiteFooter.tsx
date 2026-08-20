import { Link } from "react-router-dom";
import { openCookieSettings } from "./CookieConsentBanner";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="site-footer__accent" aria-hidden="true" />
      <div className="site-footer__inner">
        <div className="site-footer__brand-block">
          <Link to="/" className="site-footer__brand" aria-label="TourPilot home">
            <img
              src="/images/tourpilot-logo.png"
              alt=""
              className="site-footer__logo"
              width={40}
              height={40}
              decoding="async"
            />
            <span className="site-footer__brand-copy">
              <span className="site-footer__brand-text">
                Tour<span>Pilot</span>
              </span>
              <span className="site-footer__tagline">Sri Lanka travel, made clear</span>
            </span>
          </Link>
        </div>

        <nav className="site-footer__nav" aria-label="Footer">
          <Link to="/terms">Terms & Conditions</Link>
          <Link to="/terms/privacy-policy">Privacy</Link>
          <button type="button" className="site-footer__link-btn" onClick={openCookieSettings}>
            Cookies
          </button>
          <a href="https://iyyosolutions.com" target="_blank" rel="noopener noreferrer">
            IYYO
          </a>
        </nav>

        <p className="site-footer__meta">
          <span>© {year} TourPilot</span>
          <span className="site-footer__dot" aria-hidden="true" />
          <span>
            Built by{" "}
            <a
              href="https://iyyosolutions.com"
              target="_blank"
              rel="noopener noreferrer"
              className="site-footer__link"
            >
              IYYO Solutions
            </a>
          </span>
        </p>
      </div>
    </footer>
  );
}
