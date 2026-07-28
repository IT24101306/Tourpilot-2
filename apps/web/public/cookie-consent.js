/**
 * Standalone cookie banner for marketing-home.html (when not embedded in the SPA iframe).
 * Shares localStorage key with the React app.
 */
(function () {
  var KEY = "tourpilot_cookie_consent";
  var VERSION = 1;

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== VERSION || typeof parsed.analytics !== "boolean") return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function write(analytics) {
    var consent = {
      version: VERSION,
      essential: true,
      analytics: Boolean(analytics),
      decidedAt: new Date().toISOString(),
    };
    localStorage.setItem(KEY, JSON.stringify(consent));
    window.dispatchEvent(new CustomEvent("tourpilot:cookie-consent", { detail: consent }));
    return consent;
  }

  function showBanner() {
    if (document.getElementById("tp-cookie-banner")) return;
    var root = document.createElement("div");
    root.id = "tp-cookie-banner";
    root.className = "cookie-consent";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-labelledby", "cookie-consent-title");
    root.innerHTML =
      '<div class="cookie-consent__inner">' +
      '<div class="cookie-consent__copy">' +
      '<h2 id="cookie-consent-title" class="cookie-consent__title">Cookies</h2>' +
      '<p class="cookie-consent__text">We use essential cookies to keep you signed in and run TourPilot. With your OK, we also use analytics cookies to understand how the site is used. See our <a href="/terms" target="_top">Terms</a>.</p>' +
      "</div>" +
      '<div class="cookie-consent__actions">' +
      '<button type="button" class="cookie-consent__btn cookie-consent__btn--ghost" data-action="essential">Essential only</button>' +
      '<button type="button" class="cookie-consent__btn cookie-consent__btn--primary" data-action="accept">Accept all</button>' +
      "</div>" +
      "</div>";

    root.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-action]");
      if (!btn) return;
      var action = btn.getAttribute("data-action");
      if (action === "accept") write(true);
      if (action === "essential") write(false);
      root.remove();
    });

    document.body.appendChild(root);
  }

  // Inside SPA iframe — parent React banner owns consent.
  try {
    if (window.self !== window.top) {
      var settingsBtn = document.getElementById("mkt-cookie-settings");
      if (settingsBtn) {
        settingsBtn.addEventListener("click", function () {
          try {
            window.parent.dispatchEvent(new Event("tourpilot:cookie-settings"));
          } catch (err) {
            /* ignore */
          }
        });
      }
      return;
    }
  } catch (e) {
    return;
  }

  var openBtn = document.getElementById("mkt-cookie-settings");
  if (openBtn) {
    openBtn.addEventListener("click", function () {
      showBanner();
    });
  }

  if (!read()) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", showBanner);
    } else {
      showBanner();
    }
  }
})();
