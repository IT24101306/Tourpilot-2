import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Serves the marketing home from /marketing-home.html (copy of repo-root index.html).
 * Hash (#pricing, #services, #contact) is forwarded into the iframe.
 */
export function MarketingHomePage() {
  const { hash } = useLocation();

  useEffect(() => {
    document.documentElement.classList.add("marketing-home-active");
    document.body.classList.add("marketing-home-active");
    return () => {
      document.documentElement.classList.remove("marketing-home-active");
      document.body.classList.remove("marketing-home-active");
    };
  }, []);

  const src = `/marketing-home.html${hash || ""}`;

  return (
    <div className="marketing-home">
      <iframe className="marketing-home__frame" title="TourPilot" src={src} />
    </div>
  );
}
