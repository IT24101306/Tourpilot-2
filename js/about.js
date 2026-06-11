/** About panel — accordion panels */
(function () {
  function initAboutAccordion() {
    const accordion = document.getElementById("about-accordion");
    if (!accordion || accordion.dataset.bound === "true") return;

    accordion.dataset.bound = "true";

    accordion.querySelectorAll(".about-accordion-trigger").forEach((trigger) => {
      trigger.addEventListener("click", () => {
        const item = trigger.closest(".about-accordion-item");
        const panel = item?.querySelector(".about-accordion-panel");
        if (!item || !panel) return;

        const isOpen = item.classList.contains("is-open");

        accordion.querySelectorAll(".about-accordion-item").forEach((other) => {
          other.classList.remove("is-open");
          const btn = other.querySelector(".about-accordion-trigger");
          const otherPanel = other.querySelector(".about-accordion-panel");
          btn?.setAttribute("aria-expanded", "false");
          if (otherPanel) otherPanel.hidden = true;
        });

        if (!isOpen) {
          item.classList.add("is-open");
          trigger.setAttribute("aria-expanded", "true");
          panel.hidden = false;
        }
      });
    });
  }

  window.initAboutAccordion = initAboutAccordion;
  initAboutAccordion();
})();
