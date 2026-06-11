/** About — half-width panel overlay on the landing page */
(function () {
  const root = document.getElementById("about-panel-root");
  const panel = document.getElementById("about-panel");
  const scroll = document.getElementById("about-panel-scroll");
  const backdrop = document.getElementById("about-panel-backdrop");
  const closeBtn = document.getElementById("about-panel-close");

  if (!root || !panel || !scroll) return;

  const isLanding = document.body.classList.contains("page-landing");
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const ABOUT_HASH = "#about";
  const CONTENT_URL = "partials/about-panel-content.html";
  const PANEL_OPEN_MS = prefersReducedMotion ? 0 : 1080;

  let isOpen = false;
  let isClosing = false;
  let contentReady = false;
  let riseObserver = null;

  function getLenis() {
    return window.iyyoLenis ?? null;
  }

  function hasInlineContent() {
    return Boolean(scroll.querySelector(".about-page"));
  }

  async function ensureContent() {
    if (contentReady) return;

    if (!hasInlineContent()) {
      const response = await fetch(CONTENT_URL);
      if (!response.ok) throw new Error("Failed to load about panel content");
      scroll.innerHTML = await response.text();
    }

    window.initAboutAccordion?.();
    applyRiseStagger();
    contentReady = true;
  }

  function applyRiseStagger() {
    scroll.querySelectorAll("[data-animate-rise]").forEach((el) => {
      const group = el.closest(
        ".about-services-grid, .about-team-strip, .about-accordion, .about-testimonials"
      );
      if (!group) return;
      const siblings = [...group.querySelectorAll("[data-animate-rise]")];
      const index = siblings.indexOf(el);
      if (index > 0) {
        el.style.setProperty("--rise-delay", `${index * 0.08}s`);
      }
    });
  }

  function resetRiseState() {
    scroll.querySelectorAll("[data-animate-rise]").forEach((el) => {
      el.classList.remove("is-risen");
    });
    riseObserver?.disconnect();
    riseObserver = null;
  }

  function revealVisibleRiseItems() {
    const rootRect = scroll.getBoundingClientRect();

    scroll.querySelectorAll("[data-animate-rise]:not(.is-risen)").forEach((el) => {
      const rect = el.getBoundingClientRect();
      const visible =
        rect.bottom > rootRect.top + 18 && rect.top < rootRect.bottom - 18;

      if (visible) {
        el.classList.add("is-risen");
        riseObserver?.unobserve(el);
      }
    });
  }

  function setupRiseAnimations() {
    resetRiseState();

    const riseItems = scroll.querySelectorAll("[data-animate-rise]");
    if (!riseItems.length) return;

    if (prefersReducedMotion) {
      riseItems.forEach((el) => el.classList.add("is-risen"));
      return;
    }

    riseObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-risen");
          riseObserver?.unobserve(entry.target);
        });
      },
      {
        root: scroll,
        threshold: [0, 0.12, 0.28],
        rootMargin: "0px 0px -6% 0px",
      }
    );

    riseItems.forEach((el) => riseObserver.observe(el));
    revealVisibleRiseItems();
  }

  function afterPanelOpened() {
    setupRiseAnimations();
    revealVisibleRiseItems();
    window.setTimeout(revealVisibleRiseItems, 120);
  }

  function setHash(open) {
    const base = `${window.location.pathname}${window.location.search}`;
    if (open) {
      if (window.location.hash !== ABOUT_HASH) {
        history.pushState({ aboutPanel: true }, "", `${base}${ABOUT_HASH}`);
      }
      return;
    }

    if (window.location.hash === ABOUT_HASH) {
      history.pushState(null, "", base);
    }
  }

  function scrollToSection(selector) {
    const target =
      typeof selector === "string" ? scroll.querySelector(selector) : selector;
    if (!target) return;

    const top = Math.max(0, target.offsetTop - 24);
    scroll.scrollTo({
      top,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });

    target.classList.add("is-risen");
    target
      .querySelectorAll("[data-animate-rise]")
      .forEach((el) => el.classList.add("is-risen"));
    window.setTimeout(revealVisibleRiseItems, 180);
  }

  async function openPanel({ updateHash = true, scrollTo = null } = {}) {
    if (isClosing) return;

    if (isOpen) {
      if (scrollTo) scrollToSection(scrollTo);
      return;
    }

    await ensureContent();
    isOpen = true;

    root.hidden = false;
    root.setAttribute("aria-hidden", "false");
    panel.setAttribute("aria-hidden", "false");
    document.body.classList.add("about-panel-open");

    getLenis()?.stop();

    requestAnimationFrame(() => {
      root.classList.add("is-open");
      panel.focus({ preventScroll: true });
      if (updateHash) setHash(true);
      window.setTimeout(() => {
        afterPanelOpened();
        if (scrollTo) scrollToSection(scrollTo);
      }, PANEL_OPEN_MS);
    });
  }

  function closePanel({ updateHash = true } = {}) {
    if (!isOpen || isClosing) return;
    isClosing = true;

    root.classList.remove("is-open");
    document.body.classList.remove("about-panel-open");
    getLenis()?.start();

    if (updateHash) setHash(false);

    window.setTimeout(() => {
      root.hidden = true;
      root.setAttribute("aria-hidden", "true");
      panel.setAttribute("aria-hidden", "true");
      scroll.scrollTop = 0;
      resetRiseState();
      isOpen = false;
      isClosing = false;
    }, prefersReducedMotion ? 0 : 720);
  }

  function isAboutLink(anchor) {
    if (!(anchor instanceof HTMLAnchorElement)) return false;
    const href = anchor.getAttribute("href");
    if (!href) return false;

    if (href === "#about" || href === "about.html" || href === "./about.html") {
      return true;
    }

    try {
      const url = new URL(anchor.href, window.location.href);
      const path = url.pathname;
      const onHome = path === "/" || path.endsWith("/index.html");
      return (
        path.endsWith("/about.html") ||
        (url.hash === ABOUT_HASH && (onHome || path.endsWith("index.html")))
      );
    } catch {
      return false;
    }
  }

  function bindAboutLinks(scope = document) {
    scope.querySelectorAll("a").forEach((anchor) => {
      if (!isAboutLink(anchor) || anchor.dataset.aboutBound === "true") return;
      anchor.dataset.aboutBound = "true";
      anchor.addEventListener("click", (event) => {
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }

        event.preventDefault();
        openPanel();
      });
    });
  }

  function blockLandingScroll(event) {
    if (!isOpen) return;
    event.stopPropagation();
  }

  scroll.addEventListener("scroll", revealVisibleRiseItems, { passive: true });
  scroll.addEventListener("wheel", blockLandingScroll, { capture: true });
  scroll.addEventListener("touchmove", blockLandingScroll, { capture: true });
  panel.addEventListener("wheel", blockLandingScroll, { capture: true });
  panel.addEventListener("touchmove", blockLandingScroll, { capture: true });

  backdrop?.addEventListener("click", () => closePanel());
  closeBtn?.addEventListener("click", () => closePanel());

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isOpen) closePanel();
  });

  window.addEventListener("popstate", () => {
    if (window.location.hash === ABOUT_HASH) {
      openPanel({ updateHash: false });
      return;
    }

    if (isOpen) closePanel({ updateHash: false });
  });

  scroll.addEventListener("click", (event) => {
    const anchor = event.target.closest("a");
    if (anchor && isAboutLink(anchor)) {
      event.preventDefault();
      openPanel();
    }
  });

  bindAboutLinks();

  ensureContent()
    .then(() => {
      if (prefersReducedMotion) {
        scroll.querySelectorAll("[data-animate-rise]").forEach((el) => {
          el.classList.add("is-risen");
        });
      }
    })
    .catch(() => {
      if (!hasInlineContent()) {
        scroll.innerHTML =
          '<p class="about-panel-error">Unable to load About content. Please refresh and try again.</p>';
      }
      contentReady = true;
    });

  if (isLanding && window.location.hash === ABOUT_HASH) {
    window.addEventListener(
      "load",
      () => {
        window.setTimeout(() => openPanel({ updateHash: false }), 520);
      },
      { once: true }
    );
  }

  window.iyyoAboutPanel = { open: openPanel, close: closePanel };
})();
