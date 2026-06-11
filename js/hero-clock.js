/** Shared analog hero clock — minute + second hands */
(function () {
  const activeLoops = new Map();

  function initHeroAnalogClock(clockRoot) {
    const root =
      typeof clockRoot === "string"
        ? document.querySelector(clockRoot)
        : clockRoot;
    if (!root) return;

    const key = root.id || root;
    if (activeLoops.has(key)) {
      cancelAnimationFrame(activeLoops.get(key));
      activeLoops.delete(key);
    }

    const minuteHand = root.querySelector(".projects-hero-clock__hand--minute");
    const secondHand = root.querySelector(".projects-hero-clock__hand--second");
    if (!minuteHand || !secondHand) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    function updateHands() {
      const now = new Date();
      const seconds = now.getSeconds() + now.getMilliseconds() / 1000;
      const minutes = now.getMinutes() + seconds / 60;

      secondHand.style.transform = `translateX(-50%) rotate(${seconds * 6}deg)`;
      minuteHand.style.transform = `translateX(-50%) rotate(${minutes * 6}deg)`;
      activeLoops.set(key, requestAnimationFrame(updateHands));
    }

    if (prefersReducedMotion) {
      const now = new Date();
      secondHand.style.transform = `translateX(-50%) rotate(${now.getSeconds() * 6}deg)`;
      minuteHand.style.transform = `translateX(-50%) rotate(${now.getMinutes() * 6}deg)`;
      return;
    }

    updateHands();
  }

  window.initHeroAnalogClock = initHeroAnalogClock;
})();
