/** Projects page — auto-play hero video, reveal title, bounce-scroll hint */
(function () {
  const video = document.getElementById("projects-hero-video");
  const hero = document.getElementById("projects-hero");
  const title = document.getElementById("projects-hero-title");
  const scrollUi = document.getElementById("projects-hero-ui");
  if (!video || !hero || !title) return;

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  let revealed = false;
  let bounceStarted = false;

  function showScrollHint() {
    if (!scrollUi) return;
    scrollUi.hidden = false;
    scrollUi.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => scrollUi.classList.add("is-visible"));
  }

  function initHeroClock() {
    window.initHeroAnalogClock?.("#projects-hero-clock");
  }

  function holdLastFrame() {
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;
    const target = Math.max(0, video.duration - 0.05);
    video.pause();
    if (Math.abs(video.currentTime - target) > 0.02) {
      video.currentTime = target;
    }
  }

  function easeOutCubic(t) {
    return 1 - (1 - t) ** 3;
  }

  function easeOutBack(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  }

  function animateScrollTo(targetY, durationMs, easeFn) {
    const fromY = window.scrollY;
    const delta = targetY - fromY;
    if (Math.abs(delta) < 1) return Promise.resolve();

    return new Promise((resolve) => {
      const start = performance.now();

      function frame(now) {
        const t = Math.min(1, (now - start) / durationMs);
        window.scrollTo(0, fromY + delta * easeFn(t));
        if (t < 1) requestAnimationFrame(frame);
        else resolve();
      }

      requestAnimationFrame(frame);
    });
  }

  async function bounceScrollHint() {
    if (bounceStarted || prefersReducedMotion) return;
    bounceStarted = true;

    await new Promise((r) => setTimeout(r, 420));

    const peek = Math.min(window.innerHeight * 0.14, 132);
    const settle = Math.round(peek * 0.38);

    await animateScrollTo(peek, 620, easeOutCubic);
    await animateScrollTo(settle, 780, easeOutBack);
  }

  function revealHero() {
    if (revealed) return;
    revealed = true;

    document.body.classList.remove("projects-is-loading");
    document.body.classList.add("projects-is-ready");
    hero.classList.remove("is-playing");
    hero.classList.add("is-ready");

    holdLastFrame();
    title.hidden = false;
    title.setAttribute("aria-hidden", "false");

    requestAnimationFrame(() => {
      title.classList.add("is-visible");
      bounceScrollHint();
    });
  }

  function startPlayback() {
    showScrollHint();
    initHeroClock();

    if (prefersReducedMotion) {
      video.pause();
      revealHero();
      return;
    }

    video.currentTime = 0;
    const playPromise = video.play();
    if (playPromise?.catch) {
      playPromise.catch(() => revealHero());
    }
  }

  video.addEventListener("ended", revealHero);
  video.addEventListener("error", () => revealHero());

  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
    startPlayback();
  } else {
    video.addEventListener("loadedmetadata", startPlayback, { once: true });
    video.addEventListener("error", revealHero, { once: true });
  }
})();
