/** Projects page — grid + right side panel */
(function () {
  const grid = document.getElementById("projects-grid");
  const panelRoot = document.getElementById("project-panel-root");
  const panel = document.getElementById("project-panel");
  const backdrop = document.getElementById("project-panel-backdrop");
  const closeBtn = document.getElementById("project-panel-close");

  const panelImage = document.getElementById("project-panel-image");
  const panelCategory = document.getElementById("project-panel-category");
  const panelStatus = document.getElementById("project-panel-status");
  const panelTitle = document.getElementById("project-panel-title");
  const panelYear = document.getElementById("project-panel-year");
  const panelDescription = document.getElementById("project-panel-description");
  const panelServices = document.getElementById("project-panel-services");
  const panelDeliverables = document.getElementById("project-panel-deliverables");

  if (!grid || !Array.isArray(IYYO_PROJECTS)) return;

  let activeProjectId = null;

  function renderTags(listEl, items) {
    listEl.innerHTML = "";
    items.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      listEl.appendChild(li);
    });
  }

  function openPanel(project) {
    activeProjectId = project.id;
    panelImage.src = project.image;
    panelImage.alt = project.title;
    panelCategory.textContent = project.category;
    panelStatus.textContent = "";
    panelStatus.hidden = true;
    panelTitle.textContent = project.title;
    panelYear.textContent = project.year;
    panelDescription.innerHTML = project.descriptionHtml ?? `<p>${project.description}</p>`;
    renderTags(panelServices, project.services);
    renderTags(panelDeliverables, project.deliverables);

    panelRoot.hidden = false;
    requestAnimationFrame(() => {
      panelRoot.classList.add("is-open");
      panel.focus();
    });
    document.body.classList.add("panel-open");
  }

  function closePanel() {
    if (!panelRoot.classList.contains("is-open")) return;
    panelRoot.classList.remove("is-open");
    document.body.classList.remove("panel-open");
    activeProjectId = null;
    window.setTimeout(() => {
      if (!panelRoot.classList.contains("is-open")) panelRoot.hidden = true;
    }, 460);
  }

  function createCard(project, index) {
    const card = document.createElement(project.comingSoon ? "div" : "button");
    if (!project.comingSoon) card.type = "button";
    card.className = `project-card${project.comingSoon ? " project-card--coming-soon" : ""}`;
    card.setAttribute("data-animate", "scale-up");
    card.setAttribute("role", "listitem");
    card.setAttribute("aria-label", project.comingSoon ? `${project.title} coming soon` : `View ${project.title}`);
    if (!project.comingSoon) card.dataset.projectId = project.id;

    const num = String(index + 1).padStart(2, "0");

    card.innerHTML = `
      <span class="project-card-media">
        <img src="${project.image}" alt="" loading="lazy" />
      </span>
      <span class="project-card-body">
        ${project.comingSoon ? '<span class="project-card-badge">Coming Soon</span>' : ""}
        <span class="project-card-num">${num}</span>
        <span class="project-card-title">${project.title}</span>
        <span class="project-card-category">${project.category}</span>
      </span>
    `;

    if (!project.comingSoon) {
      card.addEventListener("click", () => openPanel(project));
    }
    return card;
  }

  IYYO_PROJECTS.forEach((project, index) => {
    grid.appendChild(createCard(project, index));
  });

  backdrop?.addEventListener("click", closePanel);
  closeBtn?.addEventListener("click", closePanel);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && panelRoot?.classList.contains("is-open")) {
      closePanel();
    }
  });
})();
