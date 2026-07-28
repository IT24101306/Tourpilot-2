import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Marketing home iframe. Hash (#pricing, etc.) scrolls inside the iframe
 * without reloading it (changing iframe src would feel like a new page).
 */
export function MarketingHomePage() {
  const { hash } = useLocation();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { user, token, logout } = useAuth();

  function postAuth() {
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: "tourpilot-auth",
        loggedIn: Boolean(user && token),
        role: user?.role ?? null,
      },
      window.location.origin
    );
  }

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

  useEffect(() => {
    postAuth();
  }, [user, token]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "tourpilot-auth-request") {
        postAuth();
      }
      if (data.type === "tourpilot-logout") {
        logout();
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [logout, user, token]);

  return (
    <div className="marketing-home">
      <iframe
        ref={iframeRef}
        className="marketing-home__frame"
        title="TourPilot"
        src="/marketing-home.html?v=20260728-cookies"
        onLoad={() => {
          postAuth();
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
