/** Landing page — logo click reveals floating quick links */
(function () {
  if (!document.body.classList.contains("page-landing")) return;

  const wrap = document.getElementById("site-mark-wrap");
  const toggle = document.getElementById("site-mark-toggle");
  const menu = document.getElementById("site-mark-menu");

  if (!wrap || !toggle || !menu) return;

  function setOpen(open) {
    wrap.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close IYYO menu" : "Open IYYO menu");
    menu.hidden = !open;
  }

  function closeMenu() {
    if (wrap.classList.contains("is-open")) setOpen(false);
  }

  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    setOpen(!wrap.classList.contains("is-open"));
  });

  menu.querySelectorAll("[data-panel-section]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const section = link.dataset.panelSection;
      closeMenu();
      window.iyyoAboutPanel?.open({ scrollTo: section });
    });
  });

  document.addEventListener("click", (event) => {
    if (!wrap.contains(event.target)) closeMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });

  window.addEventListener("hashchange", closeMenu);
})();
