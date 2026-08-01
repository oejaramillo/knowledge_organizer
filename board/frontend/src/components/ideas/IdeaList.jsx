import { useState } from "react";
import apiClient from "../../api/client";

const STATUSES = ["raw", "developing", "testable", "abandoned", "published"];

export default function IdeaList({ ideas = [], projectId, onIdeaAdded }) {
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ title: "", description: "", status: "raw" });

  // Edit state
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/ideas/", { ...form, project_id: projectId });
      setForm({ title: "", description: "", status: "raw" });
      setShowForm(false);
      onIdeaAdded?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (idea) => {
    setEditingId(idea.idea_id);
    setEditForm({ title: idea.title, description: idea.description ?? "", status: idea.status ?? "raw" });
  };

  const handleEditSave = async (ideaId) => {
    setEditSaving(true);
    try {
      await apiClient.patch(`/ideas/${ideaId}`, editForm);
      setEditingId(null);
      onIdeaAdded?.();
    } catch (err) {
      console.error(err);
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (ideaId) => {
    if (!confirm("Delete this idea?")) return;
    await apiClient.delete(`/ideas/${ideaId}`);
    onIdeaAdded?.();
  };

  return (
    <div className="detail-section detail-section--full" style={{ marginTop: "16px" }}>
      <div className="section-panel__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <h4 style={{ margin: 0, fontSize: "14px", color: "var(--text-muted)", fontWeight: 600 }}>Ideas</h4>
        <button className="add-btn" onClick={() => { setShowForm((v) => !v); setError(null); }} type="button">
          {showForm ? "✕ Cancel" : "+ Add Idea"}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleSubmit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "20px", padding: "16px", background: "var(--bg-main)", borderRadius: "10px", border: "1px solid var(--border-color)" }}>
          <input className="form-input" name="title" placeholder="Title *" value={form.title} onChange={handleChange} required />
          <textarea className="form-input" name="description" placeholder="Description (optional)" value={form.description} onChange={handleChange} rows={3} style={{ resize: "vertical" }} />
          <select className="form-input" name="status" value={form.status} onChange={handleChange}>
            {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
          {error && <p style={{ color: "var(--danger)", fontSize: "13px", margin: "4px 0" }}>{error}</p>}
          <button className="submit-btn" type="submit" disabled={submitting}>{submitting ? "Saving…" : "Save Idea"}</button>
        </form>
      )}

      {ideas.length === 0 ? (
        <p className="empty-state">No ideas yet.</p>
      ) : (
        <ul className="task-list">
          {ideas.map((idea) => (
            <li key={idea.idea_id} className="task-item">
              {editingId === idea.idea_id ? (
                /* ── Inline edit form ── */
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "8px 0" }}>
                  <input
                    className="form-input"
                    placeholder="Title *"
                    value={editForm.title}
                    onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                    style={{ gridColumn: "1 / -1" }}
                  />
                  <textarea
                    className="form-input"
                    placeholder="Description"
                    value={editForm.description}
                    onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                    rows={2}
                    style={{ gridColumn: "1 / -1", resize: "vertical" }}
                  />
                  <select
                    className="form-input"
                    value={editForm.status}
                    onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                  >
                    {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button
                      onClick={() => handleEditSave(idea.idea_id)}
                      disabled={editSaving}
                      style={{ padding: "5px 14px", borderRadius: 8, border: "none", background: "var(--accent-blue)", color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                    >
                      {editSaving ? "Saving…" : "Save"}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      style={{ padding: "5px 14px", borderRadius: 8, border: "1px solid var(--border-color)", background: "transparent", fontSize: 12, cursor: "pointer" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Normal row ── */
                <div className="task-item__header">
                  <span style={{ fontWeight: 600 }}>{idea.title}</span>
                  {idea.status && <span className="keyword-tag">{idea.status}</span>}
                  {idea.description && (
                    <span style={{ fontSize: 13, color: "var(--text-muted)", marginLeft: 8 }}>{idea.description}</span>
                  )}
                  <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                    <button
                      onClick={() => startEdit(idea)}
                      title="Edit"
                      style={{ background: "none", border: "1px solid var(--border-color)", borderRadius: 6, padding: "2px 8px", fontSize: 12, cursor: "pointer", color: "var(--text-muted)" }}
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(idea.idea_id)}
                      title="Delete"
                      style={{ background: "none", border: "1px solid #fca5a5", borderRadius: 6, padding: "2px 8px", fontSize: 12, cursor: "pointer", color: "#ef4444" }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}