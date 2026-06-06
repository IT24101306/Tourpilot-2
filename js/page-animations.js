/** Scroll + load animations for About & Projects pages */
(function () {
  const animated = document.querySelectorAll("[data-animate]");
  if (!animated.length) return;

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  if (prefersReducedMotion) {
    animated.forEach((el) => el.classList.add("is-animated"));
    document.querySelector(".about-banner, .projects-banner")?.classList.add("is-ready");
    document.body.classList.add("page-animations-ready");
    return;
  }

  function staggerDelay(el) {
    const group = el.closest("[data-animate-group]");
    if (!group) return "0s";
    const items = [...group.querySelectorAll("[data-animate]")];
    const index = items.indexOf(el);
    return index < 0 ? "0s" : `${index * 0.1}s`;
  }

  function reveal(el) {
    el.style.setProperty("--animate-delay", staggerDelay(el));
    el.classList.add("is-animated");
  }

  document.querySelectorAll("[data-animate='hero']").forEach((el, index) => {
    el.style.setProperty("--animate-delay", `${index * 0.15}s`);
    requestAnimationFrame(() => el.classList.add("is-animated"));
  });

  const banner = document.querySelector(".about-banner, .projects-banner");
  if (banner) {
    requestAnimationFrame(() => banner.classList.add("is-ready"));
  }

  document.body.classList.add("page-animations-loading");

  const scrollItems = [...animated].filter((el) => el.dataset.animate !== "hero");

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        reveal(entry.target);
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -5% 0px" }
  );

  scrollItems.forEach((el) => observer.observe(el));

  window.setTimeout(() => {
    document.body.classList.remove("page-animations-loading");
    document.body.classList.add("page-animations-ready");
  }, 1200);
})();
