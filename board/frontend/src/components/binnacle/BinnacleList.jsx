// components/binnacle/BinnacleList.jsx
import { useState } from "react";
import apiClient from '../../api/client';

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${String(d.getUTCDate()).padStart(2,"0")}/${String(d.getUTCMonth()+1).padStart(2,"0")}/${d.getUTCFullYear()}`;
}

const EMPTY_FORM = { title: "", content: "", day: "", month: "", year: "", author_id: "", meeting_id: "", task_id: "" };

export default function BinnacleList({ binnacleEntries = [], projectId, fetchProject, projectContributors = [], meetings = [], tasks = [] }) {
  const [showForm, setShowForm]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [form, setForm]             = useState(EMPTY_FORM);

  // Inline edit state (like meetings)
  const [editingId, setEditingId]   = useState(null);
  const [editForm, setEditForm]     = useState(EMPTY_FORM);
  const [editSaving, setEditSaving] = useState(false);

  const sorted = [...binnacleEntries].sort((a, b) => new Date(b.entry_date) - new Date(a.entry_date));

  const toggleExpanded = (id) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleEditChange = (e) => setEditForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const buildIsoDate = (f) =>
    f.day && f.month && f.year
      ? `${f.year}-${String(f.month).padStart(2,"0")}-${String(f.day).padStart(2,"0")}T00:00:00Z`
      : undefined;

  // ── Add new entry ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.content) return;
    setSubmitting(true);
    const entryDate = buildIsoDate(form);
    try {
      await apiClient.post("/binnacle/", {
        title: form.title || null,
        content: form.content,
        project_id: projectId,
        author_id: form.author_id || null,
        meeting_id: form.meeting_id || null,
        task_id: form.task_id || null,
        ...(entryDate && { entry_date: entryDate }),
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      fetchProject();
    } catch (err) { console.error(err); }
    finally { setSubmitting(false); }
  };

  // ── Start inline edit ──
  const startEdit = (e, entry) => {
    e.stopPropagation();
    const d = new Date(entry.entry_date);
    setEditingId(entry.binnacle_id);
    setEditForm({
      title: entry.title || "",
      content: entry.content || "",
      day: String(d.getUTCDate()).padStart(2,"0"),
      month: String(d.getUTCMonth()+1).padStart(2,"0"),
      year: String(d.getUTCFullYear()),
      author_id: entry.author?.contributor_id || "",
      meeting_id: entry.meeting?.meeting_id || "",
      task_id: entry.task?.task_id || "",
    });
    // Auto-expand so the inline form is visible
    setExpandedIds(prev => new Set(prev).add(entry.binnacle_id));
  };

  // ── Save inline edit ──
  const handleEditSave = async (binnacleId) => {
    if (!editForm.content) return;
    setEditSaving(true);
    const entryDate = buildIsoDate(editForm);
    try {
      await apiClient.patch(`/binnacle/${binnacleId}`, {
        title: editForm.title || null,
        content: editForm.content,
        author_id: editForm.author_id || null,
        meeting_id: editForm.meeting_id || null,
        task_id: editForm.task_id || null,
        ...(entryDate && { entry_date: entryDate }),
      });
      setEditingId(null);
      fetchProject();
    } catch (err) { console.error(err); }
    finally { setEditSaving(false); }
  };

  const handleDelete = async (e, binnacleId) => {
    e.stopPropagation();
    if (!window.confirm("Delete this entry?")) return;
    try {
      await apiClient.delete(`/binnacle/${binnacleId}`);
      fetchProject();
    } catch (err) { console.error(err); }
  };

  const FormFields = ({ f, onChange, idPrefix = "" }) => (
    <>
      <input className="form-input" name="title" placeholder="Entry title (optional)" value={f.title} onChange={onChange} />
      <textarea className="form-input" name="content" placeholder="Entry content *" value={f.content} onChange={onChange} rows={4} required />
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input className="form-input" name="day"   type="number" placeholder="DD"   min="1"    max="31"   value={f.day}   onChange={onChange} style={{ width: 64 }} />
        <input className="form-input" name="month" type="number" placeholder="MM"   min="1"    max="12"   value={f.month} onChange={onChange} style={{ width: 64 }} />
        <input className="form-input" name="year"  type="number" placeholder="YYYY" min="2000" max="2100" value={f.year}  onChange={onChange} style={{ width: 88 }} />
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Leave blank for today</span>
      </div>
      {projectContributors.length > 0 && (
        <select className="form-input" name="author_id" value={f.author_id} onChange={onChange}>
          <option value="">Author (optional)</option>
          {projectContributors.map(pc => (
            <option key={pc.contributor.contributor_id} value={pc.contributor.contributor_id}>{pc.contributor.name}</option>
          ))}
        </select>
      )}
      {meetings.length > 0 && (
        <select className="form-input" name="meeting_id" value={f.meeting_id} onChange={onChange}>
          <option value="">Link to meeting (optional)</option>
          {meetings.map(m => <option key={m.meeting_id} value={m.meeting_id}>{m.title} — {formatDate(m.meeting_date)}</option>)}
        </select>
      )}
      {tasks.length > 0 && (
        <select className="form-input" name="task_id" value={f.task_id} onChange={onChange}>
          <option value="">Link to task (optional)</option>
          {tasks.map(t => <option key={t.task_id} value={t.task_id}>{t.title}</option>)}
        </select>
      )}
    </>
  );

  return (
    <div className="section-panel">
      <div className="section-panel__header">
        <h3>Binnacle <span className="meeting-count">({binnacleEntries.length})</span></h3>
        <button className="add-btn" onClick={() => { setForm(EMPTY_FORM); setShowForm(v => !v); }}>
          {showForm ? "Cancel" : "+ Add Entry"}
        </button>
      </div>

      {/* Add form — only for new entries */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          style={{ padding: "12px 16px", borderTop: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: 8 }}
        >
          <FormFields f={form} onChange={handleChange} />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="submit"
              disabled={submitting}
              style={{ padding: "5px 14px", borderRadius: 8, border: "none", background: "var(--accent-blue)", color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              {submitting ? "Saving..." : "Save Entry"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              style={{ padding: "5px 14px", borderRadius: 8, border: "1px solid var(--border-color)", background: "transparent", fontSize: 12, cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {sorted.length === 0 ? (
        <p className="empty-state">No binnacle entries yet.</p>
      ) : (
        <ul className="meeting-list">
          {sorted.map(entry => {
            const isOpen    = expandedIds.has(entry.binnacle_id);
            const isEditing = editingId === entry.binnacle_id;
            return (
              <li key={entry.binnacle_id} className={`meeting-item ${isOpen ? "meeting-item--open" : ""}`}>
                {/* Header row */}
                <div className="meeting-item__header" onClick={() => !isEditing && toggleExpanded(entry.binnacle_id)}>
                  <span className="meeting-item__chevron">{isOpen ? "▾" : "▸"}</span>
                  <span className="meeting-item__title">
                    {entry.title || entry.content.substring(0, 50) + (entry.content.length > 50 ? "…" : "")}
                  </span>
                  <span className="meeting-item__date-inline">{formatDate(entry.entry_date)}</span>
                  <button
                    className="edit-btn"
                    onClick={(e) => isEditing ? (e.stopPropagation(), setEditingId(null)) : startEdit(e, entry)}
                    title={isEditing ? "Cancel edit" : "Edit entry"}
                  >
                    {isEditing ? "✕" : "✎"}
                  </button>
                  <button className="delete-btn" onClick={(e) => handleDelete(e, entry.binnacle_id)} title="Delete entry">×</button>
                </div>

                {/* Inline edit form */}
                {isEditing && (
                  <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: 8 }}>
                    <FormFields f={editForm} onChange={handleEditChange} />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => handleEditSave(entry.binnacle_id)}
                        disabled={editSaving}
                        style={{ padding: "5px 14px", borderRadius: 8, border: "none", background: "var(--accent-blue)", color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                      >
                        {editSaving ? "Saving…" : "Update Entry"}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        style={{ padding: "5px 14px", borderRadius: 8, border: "1px solid var(--border-color)", background: "transparent", fontSize: 12, cursor: "pointer" }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Expanded body — only when not editing */}
                {isOpen && !isEditing && (
                  <div className="meeting-item__body">
                    <p className="meeting-item__summary">{entry.content}</p>
                    <div className="binnacle-meta">
                      {entry.author && <span className="binnacle-meta__tag">✍ {entry.author.name}</span>}
                      {entry.meeting && <span className="link-badge link-badge--meeting">📅 {entry.meeting.title}</span>}
                      {entry.task && <span className="link-badge link-badge--task">✓ {entry.task.title}</span>}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}