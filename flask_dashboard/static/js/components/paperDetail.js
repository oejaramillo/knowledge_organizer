// paperDetail.js — right pane full paper view with attachments, annotations, claims.
const PaperDetail = (() => {
  let paper = null;

  async function load(id) {
    const root = document.getElementById("detail");
    root.innerHTML = '<div class="detail-empty">Loading…</div>';
    try {
      paper = await API.getPaper(id);
    } catch (e) {
      root.innerHTML = `<div class="detail-empty">${Util.esc(e.message)}</div>`;
      return;
    }
    render();
  }

  function clear() {
    paper = null;
    const root = document.getElementById("detail");
    if (root) root.innerHTML =
      '<div class="detail-empty">Select a paper to see details.</div>';
  }

  function list(items, fn) {
    if (!items || !items.length) return '<p class="muted">None</p>';
    return `<ul class="detail-list">${items.map(fn).join("")}</ul>`;
  }

  function render() {
    const root = document.getElementById("detail");
    if (!root || !paper) return;
    const p = paper;
    root.innerHTML = `
      <div class="detail-head">
        <h2>${Util.esc(p.title)}</h2>
        <div class="detail-meta">${Util.esc(p.authors || "")} · ${p.year || "—"}
          · ${Util.esc(p.journal || "")}</div>
        <div class="detail-actions">
          <button class="star-btn ${p.star ? "on" : ""}" id="d-star">${p.star ? "★ Starred" : "☆ Star"}</button>
          <label class="chk-label"><input type="checkbox" id="d-read" ${p.is_read ? "checked" : ""}/> Read</label>
          <select id="d-status">
            ${["unread","reading","read","processed","archived"]
              .map(s => `<option value="${s}" ${p.status===s?"selected":""}>${s}</option>`).join("")}
          </select>
          <button id="d-reenrich" class="ghost-btn">Re-enrich</button>
        </div>
      </div>

      <section class="detail-section">
        <h3>Abstract</h3>
        <p>${Util.esc(p.abstract || "—")}</p>
      </section>

      <section class="detail-section">
        <h3>Notes</h3>
        <textarea id="d-notes" rows="3" placeholder="Your notes…">${Util.esc(p.notes || "")}</textarea>
        <button id="d-save-notes" class="ghost-btn">Save notes</button>
      </section>

      <div class="detail-grid">
        <section class="detail-section">
          <h3>Methods</h3>
          ${list(p.method_links, m => `<li>${Util.esc(m.name)} <span class="muted">(${Util.esc(m.paradigm||"")})</span></li>`)}
        </section>
        <section class="detail-section">
          <h3>Concepts</h3>
          ${list(p.concept_links, c => `<li>${Util.esc(c.name)} <span class="muted">${Util.esc(c.role||"")}</span></li>`)}
        </section>
        <section class="detail-section">
          <h3>Variables</h3>
          ${list(p.variable_links, v => `<li>${Util.esc(v.name)} <span class="muted">${Util.esc(v.role||"")}</span></li>`)}
        </section>
        <section class="detail-section">
          <h3>Projects</h3>
          ${list(p.project_links, pr => `<li>${Util.esc(pr.name)}</li>`)}
        </section>
      </div>

      <section class="detail-section">
        <h3>Attachments</h3>
        ${list(p.attachments, a => `<li>📎 ${Util.esc(a.filename || "file")}
          <span class="muted">${Util.esc(a.file_path || "")}</span></li>`)}
      </section>

      <section class="detail-section">
        <h3>Annotations <span class="badge">${(p.annotations||[]).length}</span></h3>
        ${list(p.annotations, a => `<li class="annotation c-${a.color||""}">
          <span class="muted">p.${a.page_number ?? "—"}</span>
          ${Util.esc(a.highlight_text || a.user_note || "")}</li>`)}
      </section>

      <section class="detail-section">
        <div class="section-head">
          <h3>Claims <span class="badge">${(p.claims||[]).length}</span></h3>
          <button id="d-add-claim" class="ghost-btn">+ Add claim</button>
        </div>
        ${list(p.claims, c => `<li class="claim">
          <span class="status-pill">${Util.esc(c.claim_type)}</span>
          ${Util.esc(c.claim)}
          ${c.page_number ? `<span class="muted"> (p.${c.page_number})</span>`:""}</li>`)}
      </section>
    `;
    bind();
  }

  function bind() {
    const id = paper.paper_id;
    document.getElementById("d-star").addEventListener("click", async () => {
      await save({ star: !paper.star }); paper.star = !paper.star; render();
    });
    document.getElementById("d-read").addEventListener("change", (e) =>
      save({ is_read: e.target.checked }));
    document.getElementById("d-status").addEventListener("change", (e) =>
      save({ status: e.target.value }));
    document.getElementById("d-save-notes").addEventListener("click", () =>
      save({ notes: document.getElementById("d-notes").value }, true));
    document.getElementById("d-reenrich").addEventListener("click", async () => {
      try { await API.reEnrich(id); App.toast("Re-enrichment queued", "ok"); }
      catch (e) { App.toast(e.message, "error"); }
    });
    document.getElementById("d-add-claim").addEventListener("click", addClaim);
  }

  async function save(fields, toast = false) {
    try {
      await API.updatePaper(paper.paper_id, fields);
      if (toast) App.toast("Saved", "ok");
    } catch (e) { App.toast(e.message, "error"); }
  }

  async function addClaim() {
    const text = prompt("Claim (one declarative sentence):");
    if (!text) return;
    try {
      const c = await API.createClaim({ paper_id: paper.paper_id, claim: text });
      paper.claims = paper.claims || [];
      paper.claims.push(c);
      render();
      App.toast("Claim added", "ok");
    } catch (e) { App.toast(e.message, "error"); }
  }

  return { load, clear, render };
})();
