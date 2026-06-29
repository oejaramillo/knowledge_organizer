// dashboardStats.js — stats visualization with inline SVG charts.
const DashboardStats = (() => {
  async function load() {
    const root = document.getElementById("detail");
    root.innerHTML = '<div class="detail-empty">Loading stats…</div>';
    let s;
    try {
      s = await API.getStats(App.state.projectId ? { project_id: App.state.projectId } : {});
    } catch (e) {
      root.innerHTML = `<div class="detail-empty">${Util.esc(e.message)}</div>`;
      return;
    }
    render(s);
  }

  function card(label, value) {
    return `<div class="stat-card"><div class="stat-value">${value}</div>
      <div class="stat-label">${label}</div></div>`;
  }

  // Simple inline SVG bar chart.
  function barChart(data, { w = 420, h = 160, pad = 28 } = {}) {
    if (!data.length) return '<p class="muted">No data</p>';
    const max = Math.max(...data.map(d => d.value), 1);
    const bw = (w - pad * 2) / data.length;
    const bars = data.map((d, i) => {
      const bh = (d.value / max) * (h - pad * 2);
      const x = pad + i * bw;
      const y = h - pad - bh;
      return `<rect x="${x + 4}" y="${y}" width="${bw - 8}" height="${bh}"
                rx="3" class="bar"></rect>
              <text x="${x + bw/2}" y="${h - pad + 14}" class="bar-x">${Util.esc(d.label)}</text>
              <text x="${x + bw/2}" y="${y - 4}" class="bar-v">${d.value}</text>`;
    }).join("");
    return `<svg viewBox="0 0 ${w} ${h}" class="chart">${bars}
      <line x1="${pad}" y1="${h-pad}" x2="${w-pad}" y2="${h-pad}" class="axis"/></svg>`;
  }

  // Inline SVG donut for read vs unread.
  function donut(read, total) {
    const r = 52, c = 2 * Math.PI * r;
    const pct = total ? read / total : 0;
    const dash = c * pct;
    return `<svg viewBox="0 0 140 140" class="donut">
      <circle cx="70" cy="70" r="${r}" class="donut-bg"/>
      <circle cx="70" cy="70" r="${r}" class="donut-fg"
        stroke-dasharray="${dash} ${c - dash}" transform="rotate(-90 70 70)"/>
      <text x="70" y="68" class="donut-pct">${Math.round(pct*100)}%</text>
      <text x="70" y="86" class="donut-sub">read</text></svg>`;
  }

  function render(s) {
    const root = document.getElementById("detail");
    const yearData = (s.by_year || []).map(d => ({ label: d.year, value: d.count }));
    const statusData = Object.entries(s.by_status || {})
      .map(([k, v]) => ({ label: k, value: v }));
    const pp = s.papers || {};
    root.innerHTML = `
      <div class="detail-head"><h2>Library statistics</h2>
        <div class="detail-meta">${App.state.projectId ? "Filtered by project" : "Whole library"}</div>
      </div>
      <div class="stat-grid">
        ${card("Papers", pp.total_papers || 0)}
        ${card("Read", pp.read_papers || 0)}
        ${card("Unread", pp.unread_papers || 0)}
        ${card("Starred", pp.starred_papers || 0)}
        ${card("Claims", (s.claims && s.claims.total) || 0)}
        ${card("Annotations", s.annotations || 0)}
      </div>
      <div class="detail-grid">
        <section class="detail-section">
          <h3>Reading progress</h3>
          ${donut(pp.read_papers || 0, pp.total_papers || 0)}
        </section>
        <section class="detail-section">
          <h3>By status</h3>
          ${barChart(statusData)}
        </section>
      </div>
      <section class="detail-section">
        <h3>Papers by year</h3>
        ${barChart(yearData, { w: 560 })}
      </section>
    `;
  }

  return { load, render };
})();
