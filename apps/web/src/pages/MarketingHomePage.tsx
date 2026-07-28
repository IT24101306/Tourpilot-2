import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/**
 * Marketing home iframe. Hash (#pricing, etc.) scrolls inside the iframe
 * without reloading it (changing iframe src would feel like a new page).
 */
export function MarketingHomePage() {
  const { hash } = useLocation();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    document.documentElement.classList.add("marketing-home-active");
    document.body.classList.add("marketing-home-active");
    return () => {
      document.documentElement.classList.remove("marketing-home-active");
      document.body.classList.remove("marketing-home-active");
    };
  }, []);

  useEffect(() => {
    const section = (hash || "").replace(/^#/, "");
    if (!section) return;

    const send = () => {
      iframeRef.current?.contentWindow?.postMessage(
        { type: "tourpilot-scroll", section },
        window.location.origin
      );
    };

    send();
    const t = window.setTimeout(send, 400);
    return () => window.clearTimeout(t);
  }, [hash]);

  return (
    <div className="marketing-home">
      <iframe
        ref={iframeRef}
        className="marketing-home__frame"
        title="TourPilot"
        src="/marketing-home.html?v=20260728-trial-teal"
        onLoad={() => {
          const section = (hash || "").replace(/^#/, "");
          if (!section) return;
          iframeRef.current?.contentWindow?.postMessage(
            { type: "tourpilot-scroll", section },
            window.location.origin
          );
        }}
      />
    </div>
  );
}
