// api.js — fetch wrapper with auth header support and a mock-data fallback.

const API = (() => {
  const TOKEN_KEY = "rkm_api_token";
  const MOCK_KEY = "rkm_mock_mode";

  const getToken = () => localStorage.getItem(TOKEN_KEY) || "";
  const setToken = (t) => localStorage.setItem(TOKEN_KEY, t || "");
  const isMock = () => localStorage.getItem(MOCK_KEY) === "1";
  const setMock = (on) => localStorage.setItem(MOCK_KEY, on ? "1" : "0");

  function buildQuery(params = {}) {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") q.append(k, v);
    });
    const s = q.toString();
    return s ? `?${s}` : "";
  }

  async function request(method, path, { params, body, auth = false } = {}) {
    // Mock mode: serve static JSON for GET endpoints.
    if (isMock() && method === "GET") {
      return mockResponse(path, params);
    }
    const headers = { "Content-Type": "application/json" };
    if (auth) headers["Authorization"] = `Bearer ${getToken()}`;

    const res = await fetch(`/api${path}${buildQuery(params)}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    let data = null;
    try { data = await res.json(); } catch (_) { /* no body */ }

    if (!res.ok) {
      const msg = (data && data.error) || `Request failed (${res.status})`;
      const err = new Error(msg);
      err.status = res.status;
      err.details = data && data.details;
      throw err;
    }
    return data;
  }

  // Map API paths to bundled mock JSON files.
  async function mockResponse(path, params) {
    const load = async (f) => (await fetch(`/mock-data/${f}`)).json();
    if (path.startsWith("/projects")) return load("projects.json");
    if (path.startsWith("/papers")) return load("papers.json");
    if (path.startsWith("/stats")) return load("stats.json");
    if (path.startsWith("/project/")) {
      const all = await load("projects.json");
      const p = all.data.find((x) => path.endsWith(x.project_id)) || all.data[0];
      const papers = await load("papers.json");
      return { ...p, papers: papers.data };
    }
    if (path.startsWith("/paper/")) {
      const all = await load("papers.json");
      const p = all.data.find((x) => path.endsWith(x.paper_id)) || all.data[0];
      return {
        ...p, authors_list: [], project_links: [], attachments: [],
        annotations: [], claims: [], concept_links: [], method_links: [],
        variable_links: [], abstract: "Mock abstract for offline preview.",
      };
    }
    if (path.startsWith("/ideas")) {
      return { data: [], pagination: { page: 1, per_page: 25, total: 0, pages: 0 } };
    }
    if (path.startsWith("/search")) return { query: params && params.q, results: {} };
    return {};
  }

  return {
    getToken, setToken, isMock, setMock,
    // Projects
    listProjects: (params) => request("GET", "/projects", { params }),
    getProject: (id) => request("GET", `/project/${id}`),
    createProject: (body) => request("POST", "/project", { body, auth: true }),
    // Papers
    listPapers: (params) => request("GET", "/papers", { params }),
    getPaper: (id) => request("GET", `/paper/${id}`),
    updatePaper: (id, body) => request("POST", `/paper/${id}`, { body, auth: true }),
    reEnrich: (id) => request("POST", `/paper/${id}/re_enrich`, { auth: true }),
    // Claims
    createClaim: (body) => request("POST", "/claim", { body, auth: true }),
    updateClaim: (id, body) => request("PATCH", `/claim/${id}`, { body, auth: true }),
    // Stats / search
    getStats: (params) => request("GET", "/stats", { params }),
    search: (q) => request("GET", "/search", { params: { q } }),
    // Ideas
    listIdeas: (params) => request("GET", "/ideas", { params }),
    createIdea: (body) => request("POST", "/idea", { body, auth: true }),
  };
})();
