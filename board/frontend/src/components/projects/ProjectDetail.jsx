import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import IdeaList from "../ideas/IdeaList";
import MeetingList from "../meetings/MeetingList";
import BinnacleList from "../binnacle/BinnacleList";
import PaperList from '../papers/PaperList';
import TaskList from "../tasks/TaskList";

const API = "http://localhost:8000";

export default function ProjectDetail() {
  const { project_id } = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState(null);

  const openSection = (section) => {
    setActiveSection((prev) => (prev === section ? null : section));
  };

  // Form state
  const [form, setForm] = useState({ name: "", email: "", site: "", project_role: "" });
  // Autocomplete state
  const [allContributors, setAllContributors] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedContributor, setSelectedContributor] = useState(null); // existing one picked
  const suggestionsRef = useRef(null);

  const fetchProject = () => {
    fetch(`${API}/api/projects/${project_id}`)
      .then((res) => res.json())
      .then((data) => { setProject(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  // Load all contributors once when form opens
  useEffect(() => {
    if (showForm) {
      fetch(`${API}/api/contributors/`)
        .then((res) => res.json())
        .then(setAllContributors)
        .catch(() => {});
    }
  }, [showForm]);

  useEffect(() => { fetchProject(); }, [project_id]);

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

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const resetForm = () => {
    setForm({ name: "", email: "", site: "", project_role: "" });
    setSelectedContributor(null);
    setSuggestions([]);
    setError(null);
    setShowForm(false);
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
        // Create new contributor
        const res = await fetch(`${API}/api/contributors/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            email: form.email || null,
            site: form.site || null,
          }),
        });
        if (!res.ok) throw new Error("Failed to create contributor");
        const created = await res.json();
        contributorId = created.contributor_id;
      }

      // Link to project
      const linkRes = await fetch(`${API}/api/projects/${project_id}/contributors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contributor_id: contributorId,
          project_role: form.project_role || null,
        }),
      });

      if (!linkRes.ok) throw new Error("Failed to link contributor to project");

      resetForm();
      fetchProject();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="empty-state" style={{ padding: "40px" }}>Loading...</p>;
  if (!project) return <p className="empty-state" style={{ padding: "40px" }}>Project not found.</p>;

  const contributors = project.project_contributors ?? [];

  return (
    <div className="project-detail">
      <div className="project-detail__header">
        <h2>{project.name}</h2>
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

      {/* Contributors section */}
      <div className="detail-section detail-section--full" style={{ marginTop: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px", marginBottom: "14px" }}>
          <h3 style={{ margin: 0, fontSize: "15px", color: "var(--text-muted)" }}>Contributors</h3>
          <button
            onClick={() => { showForm ? resetForm() : setShowForm(true); }}
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
              return (
                <li key={c.contributor_id} className="task-item">
                  <div className="task-item__header">
                    {c.site ? (
                      <a href={c.site} target="_blank" rel="noreferrer"
                        style={{ fontWeight: 600, color: "var(--accent-blue)", textDecoration: "none" }}>
                        {c.name}
                      </a>
                    ) : (
                      <span style={{ fontWeight: 600 }}>{c.name}</span>
                    )}
                    {pc.project_role && <span className="keyword-tag">{pc.project_role}</span>}
                    {c.email && (
                      <a href={`mailto:${c.email}`}
                        style={{ fontSize: "13px", color: "var(--text-muted)", textDecoration: "none", marginLeft: "auto" }}>
                        ✉ {c.email}
                      </a>
                    )}
                  </div>
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

        {/* Section panel */}
        {/* Ideas */}
        {activeSection === 'ideas' && (
          <IdeaList
            ideas={project.ideas ?? []}
            projectId={project.project_id}
            onIdeaAdded={fetchProject}
          />
        )}

        {/* Meetings */}
        {activeSection === "meetings" && (
          <MeetingList
            meetings={project.meetings}
            projectId={project.project_id}
            fetchProject={fetchProject}
            projectContributors={project.project_contributors}
          />
        )}

        {/* Binnacle */}
        {activeSection === "binnacle" && (
          <BinnacleList
            binnacleEntries={project.binnacle_entries}
            projectId={project.project_id}
            fetchProject={fetchProject}
            projectContributors={project.project_contributors}
            meetings={project.meetings}
            tasks={project.tasks}
          />
        )}

        {/* Papers */}
        {activeSection === "papers" && (
          <PaperList 
            paperAssociations={project.paper_associations ?? []} 
          />
        )}

        {/* Tasks */}
        {activeSection === "tasks" && (
            <TaskList
              tasks={project.tasks ?? []}
              projectId={project.project_id}
              projectContributors={project.project_contributors}
              fetchProject={fetchProject} 
            />
          )}

      </div>
    </div>
  );
}