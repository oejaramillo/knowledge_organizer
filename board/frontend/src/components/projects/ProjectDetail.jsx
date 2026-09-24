import { useCallback, useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import IdeaList from "../ideas/IdeaList";
import MeetingList from "../meetings/MeetingList";
import BinnacleList from "../binnacle/BinnacleList";
import PaperList from '../papers/PaperList';
import TaskList from "../tasks/TaskList";
import apiClient from '../../api/client'
import useProject from '../../hooks/useProject';


export default function ProjectDetail() {
  const { project_id } = useParams();

  // Cached + race-safe loading (see hooks/useProject.js)
  const { project, loading, error: loadError, reload: fetchProject } = useProject(project_id);

  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState(null);

  // Research panels (tasks/meetings/binnacle/ideas) are fetched the first time
  // one of them is opened, instead of on every project view.
  const [sections, setSections] = useState(null);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [editingContributor, setEditingContributor] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);

  const loadSections = useCallback(async () => {
    setSectionsLoading(true);
    try {
      const { data } = await apiClient.get(`/projects/${project_id}/sections`);
      setSections(data);
    } catch {
      setSections(null);
    } finally {
      setSectionsLoading(false);
    }
  }, [project_id]);

  const openSection = (section) => {
    const next = activeSection === section ? null : section;
    setActiveSection(next);
    if (next && sections === null && !sectionsLoading) loadSections();
  };

  // Children call this after a mutation: refresh the project and, if the panels
  // were already opened, their data too.
  const refreshAll = useCallback(() => {
    fetchProject();
    if (sections !== null) loadSections();
  }, [fetchProject, sections, loadSections]);

  // Form state
  const [form, setForm] = useState({ name: "", email: "", site: "", project_role: "" });
  const [savingType, setSavingType] = useState(false);
  // Autocomplete state
  const [allContributors, setAllContributors] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedContributor, setSelectedContributor] = useState(null); // existing one picked
  const suggestionsRef = useRef(null);

  // Load all contributors once when form opens
  useEffect(() => {
    if (showForm) {
      apiClient.get('/contributors/')
        .then((response) => setAllContributors(response.data))
        .catch(() => {});
    }
  }, [showForm]);

  // Reset panels whenever the project changes
  useEffect(() => {
    setActiveSection(null);
    setSections(null);
  }, [project_id]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target)) {
        setSuggestions([]);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleNameChange = (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, name: value }));
    setSelectedContributor(null); // reset selection if user types again

    if (value.length < 1) {
      setSuggestions([]);
      return;
    }

    // Filter already-linked contributor IDs
    const linkedIds = new Set(
      (project?.project_contributors ?? []).map((pc) => pc.contributor.contributor_id)
    );

    const matches = allContributors.filter(
      (c) =>
        c.name.toLowerCase().includes(value.toLowerCase()) &&
        !linkedIds.has(c.contributor_id)
    );
    setSuggestions(matches);
  };

  const handleSelectSuggestion = (contributor) => {
    setSelectedContributor(contributor);
    setForm({
      name: contributor.name,
      email: contributor.email ?? "",
      site: contributor.site ?? "",
      project_role: "",
    });
    setSuggestions([]);
  };

  const handleTypeToggle = async (newType) => {
    if (newType === project?.project_type) return;
    setSavingType(true);
    await apiClient.patch(`/projects/${project_id}`, {
      project_type: newType
    });
    setSavingType(false);
    fetchProject();
  };

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const resetForm = () => {
    setForm({ name: "", email: "", site: "", project_role: "" });
    setSelectedContributor(null);
    setSuggestions([]);
    setError(null);
    setShowForm(false);
  };

  const handleUnlink = async (contributorId) => {
    if (!confirm('Remove this contributor from the project?')) return;
    await apiClient.delete(`/projects/${project_id}/contributors/${contributorId}`);
    fetchProject();
  };

  const startEdit = (pc) => {
    setEditingContributor(pc.contributor.contributor_id);
    setEditForm({
      name: pc.contributor.name,
      email: pc.contributor.email ?? '',
      site: pc.contributor.site ?? '',
      project_role: pc.project_role ?? '',
    });
  };

  const handleEditSave = async (contributorId) => {
    setEditSaving(true);
    try {
      // The contributor record and the project link are two different rows:
      // the role lives on `project_contributors`.
      await apiClient.patch(`/contributors/${contributorId}`, {
        name: editForm.name,
        email: editForm.email || null,
        site: editForm.site || null,
      });
      await apiClient.patch(`/projects/${project_id}/contributors/${contributorId}`, {
        project_role: editForm.project_role || null,
      });
      setEditingContributor(null);
      fetchProject();
    } catch (err) {
      setError(err.message);
    } finally {
      setEditSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      let contributorId;

      if (selectedContributor) {
        // Already exists — just use their ID
        contributorId = selectedContributor.contributor_id;
      } else {
        // Create new contributor (axios resolves to the response, not the body)
        const { data: created } = await apiClient.post('/contributors/', {
          name: form.name,
          email: form.email || null,
          site: form.site || null,
        });
        contributorId = created.contributor_id;
      }

      // Link to project
      await apiClient.post(`/projects/${project_id}/contributors`, {
        contributor_id: contributorId,
        project_role: form.project_role || null,
      });

      resetForm();
      fetchProject();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="project-detail" style={{ padding: "40px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-muted)", fontSize: 14 }}>
          <span style={{
            width: 14, height: 14, borderRadius: "50%",
            border: "2px solid var(--border-color)", borderTopColor: "var(--accent-blue)",
            animation: "spin 0.8s linear infinite", display: "inline-block",
          }} />
          Loading project…
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="project-detail" style={{ padding: "40px" }}>
        <div style={{
          background: "#fee2e2", border: "1px solid #fca5a5", color: "#991b1b",
          borderRadius: 10, padding: "14px 18px", fontSize: 13,
          display: "flex", alignItems: "center", gap: 12, maxWidth: 620,
        }}>
          <span style={{ flex: 1 }}>⚠ {loadError}</span>
          <button className="action-btn" onClick={fetchProject}
            style={{ borderColor: "#fca5a5", color: "#991b1b" }}>Retry</button>
        </div>
      </div>
    );
  }

  if (!project) return <p className="empty-state" style={{ padding: "40px" }}>Project not found.</p>;

  const contributors = project.project_contributors ?? [];

  // A `collection` is a Zotero folder used as a reading list, so it only shows
  // literature: papers with their authors, parts, claims and annotations.
  // Tasks, meetings, binnacle, ideas and contributors belong to research projects.
  const isCollection = project.project_type === 'collection';

  const papersPanel = (
    <PaperList
      key={project_id}
      paperAssociations={project.paper_associations ?? []}
      projectId={project.project_id}
      onUpdate={refreshAll}
    />
  );

  return (
  <div className="project-detail">
    <div className="project-detail__header">
      <div className="detail-header">
        <div>
          <h2>{project.name}</h2>
          {project.zotero_collection_key && (
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
              Synced from Zotero collection
            </p>
          )}
        </div>

        {/* Type toggle */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {savingType && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Saving…</span>}
          {['research', 'collection'].map(type => (
            <button
              key={type}
              onClick={() => handleTypeToggle(type)}
              style={{
                padding: '4px 14px', fontSize: 12, fontWeight: 600,
                borderRadius: 999, border: '1px solid var(--border-color)',
                cursor: 'pointer',
                background: project.project_type === type ? 'var(--accent-blue)' : 'var(--bg-white)',
                color:      project.project_type === type ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.15s',
              }}
            >
              {type}
            </button>
          ))}
        </div>
      </div>
        <span className={`status-badge status-badge--${project.status}`}>
          {project.status}
        </span>
      </div>

      {project.description && (
        <p className="project-detail__description">{project.description}</p>
      )}

      {project.keywords?.length > 0 && (
        <div className="project-detail__keywords">
          {project.keywords.map((kw) => (
            <span key={kw} className="keyword-tag">{kw}</span>
          ))}
        </div>
      )}

      {isCollection ? (
        /* ── READING COLLECTION ────────────────────────────────────────────
         * A Zotero folder used as a literature list: papers only, each one
         * expandable into its overview, parts, claims and annotations. */
        <div style={{ marginTop: 24 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            flexWrap: 'wrap', marginBottom: 12,
          }}>
            <span className="keyword-tag">Reading collection</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Literature only — switch to “research” above for tasks, meetings,
              binnacle, ideas and contributors.
            </span>
          </div>
          {papersPanel}
        </div>
      ) : (
      /* ── RESEARCH PROJECT ──────────────────────────────────────────────
       * Full workspace: contributors plus the task / meeting / binnacle /
       * idea / paper panels. */
      <div className="detail-section detail-section--full" style={{ marginTop: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px", marginBottom: "14px" }}>
          <h3 style={{ margin: 0, fontSize: "15px", color: "var(--text-muted)" }}>Contributors</h3>
          <button
            onClick={() => { if (showForm) resetForm(); else setShowForm(true); }}
            style={{
              fontSize: "12px", padding: "4px 12px", borderRadius: "999px",
              border: "1px solid var(--accent-blue)",
              color: showForm ? "white" : "var(--accent-blue)",
              background: showForm ? "var(--accent-blue)" : "transparent",
              cursor: "pointer", fontWeight: 600, transition: "all 0.15s",
            }}
          >
            {showForm ? "Cancel" : "+ Add Contributor"}
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            style={{
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px",
              marginBottom: "20px", padding: "16px",
              background: "var(--bg-main)", borderRadius: "10px",
              border: "1px solid var(--border-color)",
            }}
          >
            {/* Name with autocomplete */}
            <div style={{ gridColumn: "1 / -1", position: "relative" }} ref={suggestionsRef}>
              <input
                name="name"
                type="text"
                placeholder="Name *"
                value={form.name}
                onChange={handleNameChange}
                required
                style={{
                  width: "100%", padding: "8px 12px", borderRadius: "8px",
                  border: `1px solid ${selectedContributor ? "var(--accent-blue)" : "var(--border-color)"}`,
                  fontSize: "13px", outline: "none", background: "white",
                  boxSizing: "border-box",
                }}
              />
              {selectedContributor && (
                <span style={{
                  position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)",
                  fontSize: "11px", color: "var(--accent-blue)", fontWeight: 600,
                }}>
                  existing
                </span>
              )}

              {/* Dropdown suggestions */}
              {suggestions.length > 0 && (
                <ul style={{
                  position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10,
                  background: "white", border: "1px solid var(--border-color)",
                  borderRadius: "8px", marginTop: "4px", padding: "4px 0",
                  listStyle: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  maxHeight: "180px", overflowY: "auto",
                }}>
                  {suggestions.map((c) => (
                    <li
                      key={c.contributor_id}
                      onMouseDown={() => handleSelectSuggestion(c)}
                      style={{
                        padding: "8px 12px", cursor: "pointer", fontSize: "13px",
                        display: "flex", flexDirection: "column", gap: "2px",
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--accent-bg)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "white"}
                    >
                      <span style={{ fontWeight: 600 }}>{c.name}</span>
                      {c.email && <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>{c.email}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Rest of fields — disabled if existing contributor selected */}
            {[
              { name: "project_role", placeholder: "Role (e.g. author, advisor)", disabled: false },
              { name: "email", placeholder: "Email", type: "email", disabled: !!selectedContributor },
              { name: "site", placeholder: "Website (https://...)", type: "url", disabled: !!selectedContributor },
            ].map(({ name, placeholder, type = "text", disabled }) => (
              <input
                key={name}
                name={name}
                type={type}
                placeholder={placeholder}
                value={form[name]}
                onChange={handleChange}
                disabled={disabled}
                style={{
                  padding: "8px 12px", borderRadius: "8px",
                  border: "1px solid var(--border-color)",
                  fontSize: "13px", outline: "none",
                  background: disabled ? "var(--bg-main)" : "white",
                  color: disabled ? "var(--text-muted)" : "inherit",
                  cursor: disabled ? "not-allowed" : "text",
                }}
              />
            ))}

            {error && (
              <p style={{ gridColumn: "1 / -1", color: "#ef4444", fontSize: "13px", margin: 0 }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              style={{
                gridColumn: "1 / -1", padding: "8px", borderRadius: "8px",
                border: "none", background: "var(--accent-blue)", color: "white",
                fontWeight: 600, fontSize: "13px",
                cursor: submitting ? "not-allowed" : "pointer",
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? "Saving..." : selectedContributor ? "Link Contributor" : "Create & Add Contributor"}
            </button>
          </form>
        )}

        {/* List */}
        {contributors.length === 0 ? (
          <p className="empty-state">No contributors yet.</p>
        ) : (
          <ul className="task-list">
            {contributors.map((pc) => {
              const c = pc.contributor;
              const isEditing = editingContributor === c.contributor_id;
              return (
                <li key={c.contributor_id} className="task-item">
                  {isEditing ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '8px 0' }}>
                      {[
                        { key: 'name', placeholder: 'Name *', type: 'text' },
                        { key: 'project_role', placeholder: 'Role', type: 'text' },
                        { key: 'email', placeholder: 'Email', type: 'email' },
                        { key: 'site', placeholder: 'Website', type: 'url' },
                      ].map(({ key, placeholder, type }) => (
                        <input
                          key={key}
                          type={type}
                          placeholder={placeholder}
                          value={editForm[key]}
                          onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 13 }}
                        />
                      ))}
                      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => handleEditSave(c.contributor_id)}
                          disabled={editSaving}
                          style={{ padding: '5px 14px', borderRadius: 8, border: 'none', background: 'var(--accent-blue)', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                        >
                          {editSaving ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditingContributor(null)}
                          style={{ padding: '5px 14px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'transparent', fontSize: 12, cursor: 'pointer' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="task-item__header">
                      {c.site ? (
                        <a href={c.site} target="_blank" rel="noreferrer"
                          style={{ fontWeight: 600, color: 'var(--accent-blue)', textDecoration: 'none' }}>
                          {c.name}
                        </a>
                      ) : (
                        <span style={{ fontWeight: 600 }}>{c.name}</span>
                      )}
                      {pc.project_role && <span className="keyword-tag">{pc.project_role}</span>}
                      {c.email && (
                        <a href={`mailto:${c.email}`}
                          style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none', marginLeft: 'auto' }}>
                          ✉ {c.email}
                        </a>
                      )}
                      {/* Edit / Unlink buttons */}
                      <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                        <button
                          onClick={() => startEdit(pc)}
                          title="Edit"
                          style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: 6, padding: '2px 8px', fontSize: 12, cursor: 'pointer', color: 'var(--text-muted)' }}
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleUnlink(c.contributor_id)}
                          title="Remove from project"
                          style={{ background: 'none', border: '1px solid #fca5a5', borderRadius: 6, padding: '2px 8px', fontSize: 12, cursor: 'pointer', color: '#ef4444' }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* Project action buttons */}
        <div className="project-actions" role="group" aria-label="Project actions">
          {['ideas', 'meetings', 'binnacle', 'papers', 'tasks'].map((section) => (
            <button
              key={section}
              type="button"
              className={`action-btn${activeSection === section ? ' action-btn--active' : ''}`}
              onClick={() => openSection(section)}
              aria-label={`Open ${section}`}
            >
              {section.charAt(0).toUpperCase() + section.slice(1)}
            </button>
          ))}
        </div>

        {/* Ideas */}
        {activeSection === 'ideas' && sectionsLoading && (
          <div className="section-panel" style={{ marginTop: 20, color: 'var(--text-muted)', fontSize: 13 }}>
            Loading ideas…
          </div>
        )}
        {activeSection === 'ideas' && !sectionsLoading && (
          <IdeaList
            key={project_id}
            ideas={sections?.ideas ?? []}
            projectId={project.project_id}
            onIdeaAdded={refreshAll}
          />
        )}

        {/* Meetings */}
        {activeSection === 'meetings' && sectionsLoading && (
          <div className="section-panel" style={{ marginTop: 20, color: 'var(--text-muted)', fontSize: 13 }}>
            Loading meetings…
          </div>
        )}
        {activeSection === 'meetings' && !sectionsLoading && (
          <MeetingList
            key={project_id}
            meetings={sections?.meetings ?? []}
            projectId={project.project_id}
            fetchProject={refreshAll}
            projectContributors={project.project_contributors}
          />
        )}

        {/* Binnacle */}
        {activeSection === 'binnacle' && sectionsLoading && (
          <div className="section-panel" style={{ marginTop: 20, color: 'var(--text-muted)', fontSize: 13 }}>
            Loading binnacle…
          </div>
        )}
        {activeSection === 'binnacle' && !sectionsLoading && (
          <BinnacleList
            key={project_id}
            binnacleEntries={sections?.binnacle_entries ?? []}
            projectId={project.project_id}
            fetchProject={refreshAll}
            projectContributors={project.project_contributors}
            meetings={sections?.meetings ?? []}
            tasks={sections?.tasks ?? []}
          />
        )}

        {/* Papers */}
        {activeSection === 'papers' && papersPanel}

        {/* Tasks */}
        {activeSection === 'tasks' && sectionsLoading && (
          <div className="section-panel" style={{ marginTop: 20, color: 'var(--text-muted)', fontSize: 13 }}>
            Loading tasks…
          </div>
        )}
        {activeSection === 'tasks' && !sectionsLoading && (
          <TaskList
            key={project_id}
            tasks={sections?.tasks ?? []}
            projectId={project.project_id}
            projectContributors={project.project_contributors}
            fetchProject={refreshAll}
          />
        )}

      </div>
      )}
    </div>
  );
}