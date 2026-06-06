/** Shared nav — mobile toggle */
(function () {
  const nav = document.getElementById("site-nav");
  const toggle = document.getElementById("nav-toggle");
  const mobile = document.getElementById("nav-menu-mobile");

  nav?.classList.add("is-visible");

  toggle?.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!open));
    if (mobile) mobile.hidden = open;
  });

  mobile?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      toggle?.setAttribute("aria-expanded", "false");
      if (mobile) mobile.hidden = true;
    });
  });
})();
