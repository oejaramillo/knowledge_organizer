// components/meetings/MeetingList.jsx
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

export default function MeetingList({ meetings = [], projectId, fetchProject, projectContributors = [] }) {
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [form, setForm] = useState({ title: "", day: "", month: "", year: "", summary: "" });
  const [selectedParticipants, setSelectedParticipants] = useState([]);

  // Most recent first
  const sorted = [...meetings].sort(
    (a, b) => new Date(b.meeting_date) - new Date(a.meeting_date)
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

  const toggleParticipant = (contributorId) => {
    setSelectedParticipants((prev) =>
      prev.includes(contributorId)
        ? prev.filter((id) => id !== contributorId)
        : [...prev, contributorId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.day || !form.month || !form.year) return;
    setSubmitting(true);

    const isoDate = `${form.year}-${String(form.month).padStart(2, "0")}-${String(form.day).padStart(2, "0")}T00:00:00`;

    try {
      const res = await fetch(`${API}/api/meetings/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          summary: form.summary,
          meeting_date: isoDate,
          project_id: projectId,
          participant_ids: selectedParticipants,
        }),
      });
      if (!res.ok) throw new Error("Failed to create meeting");
      setForm({ title: "", day: "", month: "", year: "", summary: "" });
      setSelectedParticipants([]);
      setShowForm(false);
      fetchProject();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (e, meetingId) => {
    e.stopPropagation(); // prevent toggling expand when clicking delete
    if (!window.confirm("Delete this meeting?")) return;
    await fetch(`${API}/api/meetings/${meetingId}`, { method: "DELETE" });
    fetchProject();
  };

  return (
    <div className="section-panel">
      <div className="section-panel__header">
        <h3>Meetings <span className="meeting-count">({meetings.length})</span></h3>
        <button className="add-btn" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ Add Meeting"}
        </button>
      </div>

      {showForm && (
        <form className="idea-form" onSubmit={handleSubmit}>
          <input
            className="form-input"
            name="title"
            placeholder="Meeting title"
            value={form.title}
            onChange={handleChange}
            required
          />
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input className="form-input" name="day" type="number" placeholder="DD"
              min="1" max="31" value={form.day} onChange={handleChange} style={{ width: "64px" }} required />
            <input className="form-input" name="month" type="number" placeholder="MM"
              min="1" max="12" value={form.month} onChange={handleChange} style={{ width: "64px" }} required />
            <input className="form-input" name="year" type="number" placeholder="YYYY"
              min="2000" max="2100" value={form.year} onChange={handleChange} style={{ width: "88px" }} required />
          </div>
          <textarea
            className="form-input"
            name="summary"
            placeholder="Summary (optional)"
            value={form.summary}
            onChange={handleChange}
            rows={3}
          />
          {projectContributors.length > 0 && (
            <div className="participant-selector">
              <p className="participant-selector__label">Participants</p>
              <div className="participant-selector__list">
                {projectContributors.map((pc) => (
                  <label key={pc.contributor.contributor_id} className="participant-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedParticipants.includes(pc.contributor.contributor_id)}
                      onChange={() => toggleParticipant(pc.contributor.contributor_id)}
                    />
                    {pc.contributor.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          <button className="add-btn" type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Save Meeting"}
          </button>
        </form>
      )}

      {sorted.length === 0 ? (
        <p className="empty-state">No meetings yet.</p>
      ) : (
        <ul className="meeting-list">
          {sorted.map((meeting) => {
            const isOpen = expandedIds.has(meeting.meeting_id);
            return (
              <li key={meeting.meeting_id} className={`meeting-item ${isOpen ? "meeting-item--open" : ""}`}>
                {/* Always visible: clickable header row */}
                <div className="meeting-item__header" onClick={() => toggleExpanded(meeting.meeting_id)}>
                  <span className="meeting-item__chevron">{isOpen ? "▾" : "▸"}</span>
                  <span className="meeting-item__title">{meeting.title}</span>
                  <span className="meeting-item__date-inline">{formatDate(meeting.meeting_date)}</span>
                  <button
                    className="delete-btn"
                    onClick={(e) => handleDelete(e, meeting.meeting_id)}
                    title="Delete meeting"
                  >
                    ×
                  </button>
                </div>

                {/* Expanded content */}
                {isOpen && (
                  <div className="meeting-item__body">
                    {meeting.participants && meeting.participants.length > 0 && (
                      <table className="participants-table">
                        <tbody>
                          {meeting.participants.map((p) => (
                            <tr key={p.contributor_id}>
                              <td>{p.name}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {meeting.summary && (
                      <p className="meeting-item__summary">{meeting.summary}</p>
                    )}
                    {!meeting.summary && (!meeting.participants || meeting.participants.length === 0) && (
                      <p className="empty-state">No details recorded.</p>
                    )}
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