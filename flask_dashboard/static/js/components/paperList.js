// paperList.js — main paper table with inline edit (star, is_read) + filters.
const PaperList = (() => {
  let papers = [];
  let pagination = {};
  let filters = { page: 1, per_page: 25 };

  async function load(extra = {}) {
    filters = { ...filters, ...extra };
    if (App.state.projectId) filters.project_id = App.state.projectId;
    else delete filters.project_id;
    try {
      const res = await API.listPapers(filters);
      papers = res.data || [];
      pagination = res.pagination || {};
    } catch (e) {
      papers = [];
      App.toast(e.message, "error");
    }
    render();
  }

  function render() {
    const root = document.getElementById("paper-list");
    if (!root) return;
    const rows = papers.map((p) => `
      <tr data-id="${p.paper_id}" class="paper-row ${App.state.paperId === p.paper_id ? "active" : ""}">
        <td class="star-cell">
          <button class="star-btn ${p.star ? "on" : ""}" data-id="${p.paper_id}"
                  title="Star">${p.star ? "★" : "☆"}</button>
        </td>
        <td class="read-cell">
          <input type="checkbox" class="read-chk" data-id="${p.paper_id}"
                 ${p.is_read ? "checked" : ""} title="Mark read" />
        </td>
        <td class="title-cell">
          <span class="paper-title">${Util.esc(p.title)}</span>
          <span class="paper-sub">${Util.esc(p.authors || "")} · ${p.year || "—"} · ${Util.esc(p.journal || "")}</span>
        </td>
        <td><span class="status-pill s-${p.status}">${p.status}</span></td>
      </tr>`).join("");

    root.innerHTML = `
      <div class="list-toolbar">
        <input id="paper-search" type="search" placeholder="Search papers…"
               value="${Util.esc(filters.search || "")}" />
        <select id="paper-status">
          <option value="">All status</option>
          ${["unread","reading","read","processed","archived"]
            .map(s => `<option value="${s}" ${filters.status===s?"selected":""}>${s}</option>`).join("")}
        </select>
        <label class="chk-label"><input type="checkbox" id="paper-star-only"
          ${filters.star ? "checked" : ""}/> Starred</label>
      </div>
      <table class="paper-table">
        <thead><tr><th></th><th>Read</th><th>Title</th><th>Status</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4" class="empty">No papers</td></tr>'}</tbody>
      </table>
      ${renderPager()}
    `;

    bind(root);
  }

  function renderPager() {
    if (!pagination.pages || pagination.pages <= 1) return "";
    return `<div class="pager">
      <button id="prev-page" ${pagination.has_prev ? "" : "disabled"}>‹ Prev</button>
      <span>Page ${pagination.page} / ${pagination.pages} (${pagination.total})</span>
      <button id="next-page" ${pagination.has_next ? "" : "disabled"}>Next ›</button>
    </div>`;
  }

  function bind(root) {
    const search = document.getElementById("paper-search");
    search.addEventListener("input", Util.debounce((e) =>
      load({ search: e.target.value, page: 1 }), 300));
    document.getElementById("paper-status").addEventListener("change", (e) =>
      load({ status: e.target.value, page: 1 }));
    document.getElementById("paper-star-only").addEventListener("change", (e) =>
      load({ star: e.target.checked ? "true" : "", page: 1 }));

    const prev = document.getElementById("prev-page");
    const next = document.getElementById("next-page");
    if (prev) prev.addEventListener("click", () => load({ page: pagination.page - 1 }));
    if (next) next.addEventListener("click", () => load({ page: pagination.page + 1 }));

    root.querySelectorAll(".paper-row").forEach((tr) => {
      tr.addEventListener("click", (e) => {
        if (e.target.closest(".star-btn") || e.target.closest(".read-chk")) return;
        App.navigate({ view: "paper", paperId: tr.dataset.id });
      });
    });
    root.querySelectorAll(".star-btn").forEach((b) =>
      b.addEventListener("click", () => toggleStar(b.dataset.id)));
    root.querySelectorAll(".read-chk").forEach((c) =>
      c.addEventListener("change", () => setRead(c.dataset.id, c.checked)));
  }

  async function toggleStar(id) {
    const p = papers.find((x) => x.paper_id === id);
    if (!p) return;
    try {
      await API.updatePaper(id, { star: !p.star });
      p.star = !p.star;
      render();
    } catch (e) { App.toast(e.message, "error"); }
  }

  async function setRead(id, val) {
    try {
      await API.updatePaper(id, { is_read: val });
      const p = papers.find((x) => x.paper_id === id);
      if (p) p.is_read = val;
    } catch (e) { App.toast(e.message, "error"); }
  }

  return { load, render };
})();
