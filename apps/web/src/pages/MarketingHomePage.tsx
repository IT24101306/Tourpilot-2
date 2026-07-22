import { useEffect } from "react";

/**
 * Serves the marketing home from /marketing-home.html (copy of repo-root index.html).
 * The root index.html is left untouched as the design source.
 */
export function MarketingHomePage() {
  useEffect(() => {
    document.documentElement.classList.add("marketing-home-active");
    document.body.classList.add("marketing-home-active");
    return () => {
      document.documentElement.classList.remove("marketing-home-active");
      document.body.classList.remove("marketing-home-active");
    };
  }, []);

  return (
    <div className="marketing-home">
      <iframe
        className="marketing-home__frame"
        title="TourPilot"
        src="/marketing-home.html"
      />
    </div>
  );
}
