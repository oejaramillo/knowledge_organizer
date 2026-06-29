// app.js — client-side routing, shared state, and small utilities.

const Util = {
  esc(s) {
    if (s === null || s === undefined) return "";
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  },
  debounce(fn, ms) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  },
};

const App = (() => {
  const state = { view: "stats", projectId: null, paperId: null };

  function toast(msg, kind = "ok") {
    const host = document.getElementById("toast-host");
    const el = document.createElement("div");
    el.className = `toast ${kind}`;
    el.textContent = msg;
    host.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  // Routing via hash: #/project/<id> , #/paper/<id> , #/stats
  function parseHash() {
    const h = location.hash.replace(/^#\/?/, "");
    const parts = h.split("/").filter(Boolean);
    if (parts[0] === "paper" && parts[1])
      return { view: "paper", paperId: parts[1], projectId: state.projectId };
    if (parts[0] === "project")
      return { view: "project", projectId: parts[1] || null, paperId: null };
    return { view: "stats", projectId: state.projectId, paperId: null };
  }

  function toHash(s) {
    if (s.view === "paper" && s.paperId) return `#/paper/${s.paperId}`;
    if (s.view === "project") return `#/project/${s.projectId || ""}`;
    return "#/stats";
  }

  function navigate(patch) {
    Object.assign(state, patch);
    const newHash = toHash(state);
    if (location.hash !== newHash) location.hash = newHash;
    else route();
  }

  async function route() {
    const s = parseHash();
    Object.assign(state, s);
    // Highlight project selection regardless of view
    ProjectList.render();
    if (state.view === "paper" && state.paperId) {
      PaperList.render();
      PaperDetail.load(state.paperId);
    } else if (state.view === "project") {
      PaperDetail.clear();
      await PaperList.load({ page: 1 });
    } else {
      PaperDetail.clear ? null : null;
      await PaperList.load({ page: 1 });
      DashboardStats.load();
    }
    updateHeader();
  }

  function updateHeader() {
    const dot = document.getElementById("mode-indicator");
    if (dot) {
      dot.textContent = API.isMock() ? "Mock data" : (API.getToken() ? "Authed" : "Live");
      dot.className = "mode-pill " + (API.isMock() ? "mock" : (API.getToken() ? "authed" : "live"));
    }
  }

  function bindHeader() {
    document.getElementById("global-search").addEventListener("keydown", async (e) => {
      if (e.key !== "Enter") return;
      const q = e.target.value.trim();
      if (!q) return;
      try {
        const res = await API.search(q);
        showSearchResults(res);
      } catch (err) { toast(err.message, "error"); }
    });
    document.getElementById("stats-btn").addEventListener("click", () =>
      navigate({ view: "stats", paperId: null }));
    document.getElementById("token-btn").addEventListener("click", () => {
      const t = prompt("API token (stored locally):", API.getToken());
      if (t !== null) { API.setToken(t); updateHeader(); toast("Token saved", "ok"); }
    });
    document.getElementById("mock-btn").addEventListener("click", () => {
      API.setMock(!API.isMock());
      updateHeader();
      toast(API.isMock() ? "Mock mode ON" : "Mock mode OFF", "ok");
      route();
    });
  }

  function showSearchResults(res) {
    const root = document.getElementById("detail");
    const r = res.results || {};
    const sec = (title, items, fn) => `<section class="detail-section">
      <h3>${title} <span class="badge">${(items||[]).length}</span></h3>
      ${(items&&items.length)?`<ul class="detail-list">${items.map(fn).join("")}</ul>`:'<p class="muted">None</p>'}
    </section>`;
    root.innerHTML = `<div class="detail-head"><h2>Search: "${Util.esc(res.query)}"</h2></div>
      ${sec("Papers", r.papers, p => `<li><a href="#/paper/${p.paper_id}">${Util.esc(p.title)}</a> <span class="muted">${p.year||""}</span></li>`)}
      ${sec("Claims", r.claims, c => `<li>${Util.esc(c.claim)} <span class="muted">${Util.esc(c.claim_type||"")}</span></li>`)}
      ${sec("Authors", r.authors, a => `<li>${Util.esc(a.full_name)} <span class="muted">${Util.esc(a.institution||"")}</span></li>`)}
      ${sec("Concepts", r.concepts, c => `<li>${Util.esc(c.name)}</li>`)}
      ${sec("Methods", r.methods, m => `<li>${Util.esc(m.name)} <span class="muted">${Util.esc(m.paradigm||"")}</span></li>`)}
    `;
  }

  async function init() {
    bindHeader();
    await ProjectList.load();
    window.addEventListener("hashchange", route);
    route();
  }

  return { state, navigate, route, toast, init };
})();

document.addEventListener("DOMContentLoaded", App.init);
