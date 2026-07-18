// components/binnacle/BinnacleList.jsx
import { useState } from "react";

const API = "http://localhost:8000";

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

export default function BinnacleList({ binnacleEntries = [], projectId, fetchProject, projectContributors = [], meetings = [], tasks = [] }) {
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [editingEntry, setEditingEntry] = useState(null); // holds entry being edited
  const [form, setForm] = useState({
    title: "",
    content: "",
    day: "",
    month: "",
    year: "",
    author_id: "",
    meeting_id: "",
    task_id: "",
  });

  // Most recent first
  const sorted = [...binnacleEntries].sort(
    (a, b) => new Date(b.entry_date) - new Date(a.entry_date)
  );

  const toggleExpanded = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const resetForm = () => {
    setForm({ title: "", content: "", day: "", month: "", year: "", author_id: "", meeting_id: "", task_id: "" });
    setEditingEntry(null);
    setShowForm(false);
  };

  const handleEdit = (e, entry) => {
    e.stopPropagation();
    const d = new Date(entry.entry_date);
    setForm({
      title: entry.title || "",
      content: entry.content || "",
      day: String(d.getUTCDate()).padStart(2, "0"),
      month: String(d.getUTCMonth() + 1).padStart(2, "0"),
      year: String(d.getUTCFullYear()),
      author_id: entry.author_id || "",
      meeting_id: entry.meeting_id || "",
      task_id: entry.task_id || "",
    });
    setEditingEntry(entry);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.content) return;
    setSubmitting(true);

    const entryDate = form.day && form.month && form.year
      ? `${form.year}-${String(form.month).padStart(2, "0")}-${String(form.day).padStart(2, "0")}T00:00:00Z`
      : undefined;

    const payload = {
      title: form.title || null,
      content: form.content,
      project_id: projectId,
      author_id: form.author_id || null,
      meeting_id: form.meeting_id || null,
      task_id: form.task_id || null,
      ...(entryDate && { entry_date: entryDate }),
    };

    try {
      const url = editingEntry
        ? `${API}/api/binnacle/${editingEntry.binnacle_id}`
        : `${API}/api/binnacle/`;
      const method = editingEntry ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save entry");
      resetForm();
      fetchProject();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (e, binnacleId) => {
    e.stopPropagation();
    if (!window.confirm("Delete this entry?")) return;
    await fetch(`${API}/api/binnacle/${binnacleId}`, { method: "DELETE" });
    fetchProject();
  };

  return (
    <div className="section-panel">
      <div className="section-panel__header">
        <h3>Binnacle <span className="meeting-count">({binnacleEntries.length})</span></h3>
        <button className="add-btn" onClick={() => { resetForm(); setShowForm((v) => !v); }}>
          {showForm ? "Cancel" : "+ Add Entry"}
        </button>
      </div>

      {showForm && (
        <form className="idea-form" onSubmit={handleSubmit}>
          <input
            className="form-input"
            name="title"
            placeholder="Entry title (optional)"
            value={form.title}
            onChange={handleChange}
          />
          <textarea
            className="form-input"
            name="content"
            placeholder="Entry content *"
            value={form.content}
            onChange={handleChange}
            rows={4}
            required
          />

          {/* Date fields */}
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input className="form-input" name="day" type="number" placeholder="DD"
              min="1" max="31" value={form.day} onChange={handleChange} style={{ width: "64px" }} />
            <input className="form-input" name="month" type="number" placeholder="MM"
              min="1" max="12" value={form.month} onChange={handleChange} style={{ width: "64px" }} />
            <input className="form-input" name="year" type="number" placeholder="YYYY"
              min="2000" max="2100" value={form.year} onChange={handleChange} style={{ width: "88px" }} />
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Leave blank for today</span>
          </div>

          {/* Author selector */}
          {projectContributors.length > 0 && (
            <select className="form-input" name="author_id" value={form.author_id} onChange={handleChange}>
              <option value="">Author (optional)</option>
              {projectContributors.map((pc) => (
                <option key={pc.contributor.contributor_id} value={pc.contributor.contributor_id}>
                  {pc.contributor.name}
                </option>
              ))}
            </select>
          )}

          {/* Link to meeting */}
          {meetings.length > 0 && (
            <select className="form-input" name="meeting_id" value={form.meeting_id} onChange={handleChange}>
              <option value="">Link to meeting (optional)</option>
              {meetings.map((m) => (
                <option key={m.meeting_id} value={m.meeting_id}>
                  {m.title} — {formatDate(m.meeting_date)}
                </option>
              ))}
            </select>
          )}

          {/* Link to task */}
          {tasks.length > 0 && (
            <select className="form-input" name="task_id" value={form.task_id} onChange={handleChange}>
              <option value="">Link to task (optional)</option>
              {tasks.map((t) => (
                <option key={t.task_id} value={t.task_id}>
                  {t.title}
                </option>
              ))}
            </select>
          )}

          <button className="add-btn" type="submit" disabled={submitting}>
            {submitting ? "Saving..." : editingEntry ? "Update Entry" : "Save Entry"}
          </button>
        </form>
      )}

      {sorted.length === 0 ? (
        <p className="empty-state">No binnacle entries yet.</p>
      ) : (
        <ul className="meeting-list">
          {sorted.map((entry) => {
            const isOpen = expandedIds.has(entry.binnacle_id);
            return (
              <li key={entry.binnacle_id} className={`meeting-item ${isOpen ? "meeting-item--open" : ""}`}>
                {/* Collapsed header row */}
                <div className="meeting-item__header" onClick={() => toggleExpanded(entry.binnacle_id)}>
                  <span className="meeting-item__chevron">{isOpen ? "▾" : "▸"}</span>
                  <span className="meeting-item__title">{entry.title || entry.content.substring(0, 50) + (entry.content.length > 50 ? "…" : "")}</span>
                  <span className="meeting-item__date-inline">{formatDate(entry.entry_date)}</span>
                  <button className="edit-btn" onClick={(e) => handleEdit(e, entry)} title="Edit entry">✎</button>
                  <button className="delete-btn" onClick={(e) => handleDelete(e, entry.binnacle_id)} title="Delete entry">×</button>
                </div>

                {/* Expanded body */}
                {isOpen && (
                  <div className="meeting-item__body">
                    <p className="meeting-item__summary">{entry.content}</p>

                    {/* Author, linked meeting, linked task */}
                    <div className="binnacle-meta">
                      {entry.author && (
                        <span className="binnacle-meta__tag">
                          ✍ {entry.author.name}
                        </span>
                      )}
                      {entry.meeting && (
                        <span className="link-badge link-badge--meeting">
                          📅 {entry.meeting.title}
                        </span>
                      )}
                      {entry.task && (
                        <span className="link-badge link-badge--task">
                          ✓ {entry.task.title}
                        </span>
                      )}
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