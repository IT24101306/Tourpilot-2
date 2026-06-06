/** Projects page — grid + right side panel */
(function () {
  const grid = document.getElementById("projects-grid");
  const panelRoot = document.getElementById("project-panel-root");
  const panel = document.getElementById("project-panel");
  const backdrop = document.getElementById("project-panel-backdrop");
  const closeBtn = document.getElementById("project-panel-close");

  const panelImage = document.getElementById("project-panel-image");
  const panelCategory = document.getElementById("project-panel-category");
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
    panelTitle.textContent = project.title;
    panelYear.textContent = project.year;
    panelDescription.textContent = project.description;
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
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "project-card";
    btn.setAttribute("data-animate", "scale-up");
    btn.setAttribute("role", "listitem");
    btn.setAttribute("aria-label", `View ${project.title}`);
    btn.dataset.projectId = project.id;

    const num = String(index + 1).padStart(2, "0");

    btn.innerHTML = `
      <span class="project-card-media">
        <img src="${project.image}" alt="" loading="lazy" />
      </span>
      <span class="project-card-body">
        <span class="project-card-num">${num}</span>
        <span class="project-card-title">${project.title}</span>
        <span class="project-card-category">${project.category}</span>
      </span>
    `;

    btn.addEventListener("click", () => openPanel(project));
    return btn;
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
