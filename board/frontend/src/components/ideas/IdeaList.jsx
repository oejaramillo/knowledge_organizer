import { useState } from "react";

const API = "http://localhost:8000";

const STATUSES = ["raw", "developing", "testable", "abandoned", "published"];

export default function IdeaList({ ideas = [], projectId, onIdeaAdded }) {
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ title: "", description: "", status: "raw" });

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/ideas/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, project_id: projectId }),
      });
      if (!res.ok) throw new Error("Failed to create idea");
      setForm({ title: "", description: "", status: "raw" });
      setShowForm(false);
      onIdeaAdded?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="detail-section detail-section--full" style={{ marginTop: "16px" }}>
      <div className="section-panel__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <h4 style={{ margin: 0, fontSize: "14px", color: "var(--text-muted)", fontWeight: 600 }}>
          Ideas
        </h4>
        <button
          className="add-btn"
          onClick={() => { setShowForm((v) => !v); setError(null); }}
          type="button"
        >
          {showForm ? "✕ Cancel" : "+ Add Idea"}
        </button>
      </div>

      {showForm && (
        <form 
        onSubmit={handleSubmit} 
        className="contributor-form" 
        style={{
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px",
              marginBottom: "20px", padding: "16px",
              background: "var(--bg-main)", borderRadius: "10px",
              border: "1px solid var(--border-color)",
            }}>
          <input
            className="form-input"
            name="title"
            placeholder="Title *"
            value={form.title}
            onChange={handleChange}
            required
          />
          <textarea
            className="form-input"
            name="description"
            placeholder="Description (optional)"
            value={form.description}
            onChange={handleChange}
            rows={3}
            style={{ resize: "vertical" }}
          />
          <select
            className="form-input"
            name="status"
            value={form.status}
            onChange={handleChange}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          {error && <p style={{ color: "var(--danger)", fontSize: "13px", margin: "4px 0" }}>{error}</p>}
          <button className="submit-btn" type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save Idea"}
          </button>
        </form>
      )}

      {ideas.length === 0 ? (
        <p className="empty-state">No ideas yet.</p>
      ) : (
        <ul className="task-list">
          {ideas.map((idea) => (
            <li key={idea.idea_id} className="task-item">
              <div className="task-item__header">
                <span style={{ fontWeight: 600 }}>{idea.title}</span>
                {idea.status && <span className="keyword-tag">{idea.status}</span>}
              </div>
              {idea.description && (
                <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
                  {idea.description}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}