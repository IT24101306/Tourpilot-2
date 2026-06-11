/** HUD target cursor — dot + concentric rings */
(function () {
  if (!window.matchMedia("(pointer: fine)").matches) return;

  const cursor = document.getElementById("hud-cursor");
  if (!cursor) return;

  document.body.classList.add("has-hud-cursor");

  const interactive =
    "a, button, [role='button'], input, textarea, select, label, summary, .project-card, .contact-ui__card, .contact-social-icon, .contact-form__submit, .about-panel-close, .nav-toggle, .about-accordion-trigger, .site-mark-toggle, .site-mark-menu__link";

  let visible = false;

  document.addEventListener(
    "mousemove",
    (e) => {
      cursor.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;

      if (!visible) {
        cursor.classList.add("is-visible");
        visible = true;
      }

      cursor.classList.toggle("is-hover", Boolean(e.target.closest(interactive)));
    },
    { passive: true }
  );

  document.documentElement.addEventListener("mouseleave", () => {
    cursor.classList.remove("is-visible");
    visible = false;
  });

  document.addEventListener(
    "mousedown",
    () => cursor.classList.add("is-active"),
    { passive: true }
  );

  document.addEventListener(
    "mouseup",
    () => cursor.classList.remove("is-active"),
    { passive: true }
  );
})();
