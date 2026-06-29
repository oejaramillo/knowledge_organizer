// projectList.js — left sidebar project browser with search + add.
const ProjectList = (() => {
  let projects = [];
  let search = "";

  async function load() {
    try {
      const res = await API.listProjects({ q: search, per_page: 100 });
      projects = res.data || [];
    } catch (e) {
      projects = [];
      App.toast(e.message, "error");
    }
    render();
  }

  function render() {
    const root = document.getElementById("project-list");
    if (!root) return;
    const active = App.state.projectId;
    const rows = projects.map((p) => {
      const pct = p.total_papers
        ? Math.round((p.read + p.processed) / p.total_papers * 100) : 0;
      return `
        <li class="project-item ${active === p.project_id ? "active" : ""}"
            data-id="${p.project_id}">
          <div class="project-item-head">
            <span class="project-name">${Util.esc(p.name)}</span>
            <span class="badge">${p.total_papers || 0}</span>
          </div>
          <div class="progress"><div class="progress-bar" style="width:${pct}%"></div></div>
          <div class="project-meta">${p.status} · ${p.total_claims || 0} claims</div>
        </li>`;
    }).join("");

    root.innerHTML = `
      <div class="sidebar-search">
        <input id="project-search" type="search" placeholder="Search projects…"
               value="${Util.esc(search)}" />
        <button id="add-project-btn" class="icon-btn" title="New project">+</button>
      </div>
      <li class="project-item ${!active ? "active" : ""}" data-id="">
        <div class="project-item-head"><span class="project-name">All papers</span></div>
      </li>
      ${rows || '<li class="empty">No projects</li>'}
    `;

    const si = document.getElementById("project-search");
    si.addEventListener("input", Util.debounce((e) => {
      search = e.target.value; load();
    }, 300));
    document.getElementById("add-project-btn")
      .addEventListener("click", addProject);
    root.querySelectorAll(".project-item").forEach((li) => {
      li.addEventListener("click", () => {
        App.navigate({ view: "project", projectId: li.dataset.id || null });
      });
    });
  }

  async function addProject() {
    const name = prompt("New project name:");
    if (!name) return;
    try {
      await API.createProject({ name });
      App.toast("Project created", "ok");
      load();
    } catch (e) {
      App.toast(e.message, "error");
    }
  }

  return { load, render };
})();
