import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  COOKIE_CONSENT_EVENT,
  readCookieConsent,
  writeCookieConsent,
  type CookieConsent,
} from "../lib/cookieConsent";
import "../styles/cookie-consent.css";

export function CookieConsentBanner() {
  const [consent, setConsent] = useState<CookieConsent | null>(() =>
    typeof window === "undefined" ? null : readCookieConsent()
  );
  const [visible, setVisible] = useState(() =>
    typeof window === "undefined" ? false : !readCookieConsent()
  );

  useEffect(() => {
    const sync = () => {
      const next = readCookieConsent();
      setConsent(next);
      setVisible(!next);
    };
    const openSettings = () => setVisible(true);
    sync();
    window.addEventListener(COOKIE_CONSENT_EVENT, sync);
    window.addEventListener("tourpilot:cookie-settings", openSettings);
    return () => {
      window.removeEventListener(COOKIE_CONSENT_EVENT, sync);
      window.removeEventListener("tourpilot:cookie-settings", openSettings);
    };
  }, []);

  if (!visible) return null;

  function acceptAll() {
    writeCookieConsent(true);
    setConsent(readCookieConsent());
    setVisible(false);
  }

  function essentialOnly() {
    writeCookieConsent(false);
    setConsent(readCookieConsent());
    setVisible(false);
  }

  return (
    <div className="cookie-consent" role="dialog" aria-labelledby="cookie-consent-title" aria-live="polite">
      <div className="cookie-consent__inner">
        <div className="cookie-consent__copy">
          <h2 id="cookie-consent-title" className="cookie-consent__title">
            Cookies
          </h2>
          <p className="cookie-consent__text">
            We use essential cookies to keep you signed in and run TourPilot. With your OK, we also
            use analytics cookies to understand how the site is used
            {consent?.analytics ? " (analytics currently on)." : "."} See our{" "}
            <Link to="/terms">Terms</Link>.
          </p>
        </div>
        <div className="cookie-consent__actions">
          <button type="button" className="cookie-consent__btn cookie-consent__btn--ghost" onClick={essentialOnly}>
            Essential only
          </button>
          <button type="button" className="cookie-consent__btn cookie-consent__btn--primary" onClick={acceptAll}>
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}

/** Open the banner again from a footer link or settings. */
export function openCookieSettings(): void {
  window.dispatchEvent(new Event("tourpilot:cookie-settings"));
}
