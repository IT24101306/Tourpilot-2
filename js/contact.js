/** Contact page — auto-play hero video, overlay cards, scrollable body */
(function () {
  const video = document.getElementById("contact-video");
  const hero = document.getElementById("contact-hero");
  const heroUi = document.getElementById("contact-hero-ui");
  const clockUi = document.getElementById("contact-hero-clock-ui");
  const bodySection = document.getElementById("contact-body");
  const copyright = document.getElementById("contact-copyright");

  if (!video || !hero) return;

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  let revealed = false;
  let riseObserver = null;

  function holdLastFrame() {
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;

    const target = Math.max(0, video.duration - 0.034);
    video.pause();

    const lockFrame = () => {
      video.pause();
      if (video.currentTime < target - 0.02) {
        video.currentTime = target;
      }
    };

    if (Math.abs(video.currentTime - target) > 0.01) {
      video.addEventListener("seeked", lockFrame, { once: true });
      video.currentTime = target;
    } else {
      lockFrame();
    }
  }

  function showClockUi() {
    if (!clockUi) return;
    clockUi.hidden = false;
    clockUi.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => clockUi.classList.add("is-visible"));
    window.initHeroAnalogClock?.("#contact-hero-clock");
  }

  function setupRiseAnimations() {
    const items = document.querySelectorAll("[data-contact-rise]");
    if (!items.length) return;

    if (prefersReducedMotion) {
      items.forEach((el) => el.classList.add("is-risen"));
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
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );

    items.forEach((el) => riseObserver.observe(el));
  }

  function revealContactPage() {
    if (revealed) return;
    revealed = true;

    document.body.classList.remove("contact-is-loading");
    document.body.classList.add("contact-is-ready");
    hero.classList.remove("is-playing");
    hero.classList.add("is-ready");

    holdLastFrame();

    if (heroUi) {
      heroUi.setAttribute("aria-hidden", "false");
      heroUi.classList.add("is-visible");
    }

    bodySection?.classList.add("is-visible");

    if (copyright) {
      copyright.hidden = false;
      copyright.classList.add("is-visible");
    }

    setupRiseAnimations();
    scrollToInquiry();
  }

  function scrollToInquiry() {
    if (window.location.hash !== "#contact-inquiry") return;
    const target = document.getElementById("contact-inquiry");
    if (!target) return;

    window.setTimeout(() => {
      target.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "start",
      });
    }, 80);
  }

  function startPlayback() {
    showClockUi();

    if (prefersReducedMotion) {
      video.pause();
      revealContactPage();
      return;
    }

    video.currentTime = 0;
    const playPromise = video.play();
    if (playPromise?.catch) {
      playPromise.catch(() => revealContactPage());
    }
  }

  video.addEventListener("ended", () => {
    holdLastFrame();
    revealContactPage();
  });
  video.addEventListener("error", () => revealContactPage());

  video.addEventListener("timeupdate", () => {
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;
    if (video.currentTime >= video.duration - 0.05) {
      holdLastFrame();
      revealContactPage();
    }
  });

  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
    startPlayback();
  } else {
    video.addEventListener("loadedmetadata", startPlayback, { once: true });
    video.addEventListener("error", revealContactPage, { once: true });
  }

  window.setTimeout(() => {
    if (!revealed) revealContactPage();
  }, 12000);

  function scrollToInquiry() {
    if (window.location.hash !== "#contact-inquiry") return;
    const target = document.getElementById("contact-inquiry");
    if (!target) return;

    window.setTimeout(() => {
      target.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "start",
      });
    }, revealed ? 80 : 900);
  }

  window.addEventListener("hashchange", scrollToInquiry);

  const inquiryForm = document.getElementById("contact-inquiry-form");
  inquiryForm?.addEventListener("submit", (event) => {
    event.preventDefault();

    const data = new FormData(inquiryForm);
    const name = String(data.get("name") || "").trim();
    const email = String(data.get("email") || "").trim();
    const subject = String(data.get("subject") || "Website inquiry").trim();
    const message = String(data.get("message") || "").trim();

    if (!name || !email || !message) return;

    const body = [
      `Name: ${name}`,
      `Email: ${email}`,
      "",
      message,
    ].join("\n");

    const mailto = `mailto:hello@iyyo.solutions?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  });
})();
