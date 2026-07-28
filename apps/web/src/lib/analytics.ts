import { COOKIE_CONSENT_EVENT, hasAnalyticsConsent, readCookieConsent } from "./cookieConsent";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let loadedMeasurementId: string | null = null;

function measurementId(): string {
  return String(import.meta.env.VITE_GA_MEASUREMENT_ID || "").trim();
}

/** Load Google Analytics only when the visitor accepted analytics cookies. */
export function applyAnalyticsConsent(): void {
  const id = measurementId();
  if (!id) return;

  if (!hasAnalyticsConsent()) {
    // Do not remove already-loaded tags mid-session; just stop new page hits.
    return;
  }

  if (loadedMeasurementId === id) return;
  loadedMeasurementId = id;

  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function gtag(...args: unknown[]) {
      window.dataLayer?.push(args);
    };
  window.gtag("js", new Date());
  window.gtag("config", id, { anonymize_ip: true });

  if (!document.getElementById("tp-ga-script")) {
    const script = document.createElement("script");
    script.id = "tp-ga-script";
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    document.head.appendChild(script);
  }
}

export function initAnalyticsConsentListener(): () => void {
  const onChange = () => applyAnalyticsConsent();
  // Apply immediately if consent already stored.
  if (readCookieConsent()) applyAnalyticsConsent();
  window.addEventListener(COOKIE_CONSENT_EVENT, onChange);
  return () => window.removeEventListener(COOKIE_CONSENT_EVENT, onChange);
}
