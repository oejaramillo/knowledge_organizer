// components/meetings/MeetingList.jsx
import { useState } from "react";
import apiClient from "../../api/client";
import DateField from "../common/DateField";
import { formatDate, dateToFields, fieldsToTimestamp } from "../../utils/date";

const EMPTY_FORM = { title: "", day: "", month: "", year: "", summary: "" };

export default function MeetingList({ meetings = [], projectId, fetchProject, projectContributors = [] }) {
  const [showForm, setShowForm]       = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [form, setForm]               = useState(EMPTY_FORM);
  const [selectedParticipants, setSelectedParticipants] = useState([]);

  // Edit state
  const [editingId, setEditingId]     = useState(null);
  const [editForm, setEditForm]       = useState({});
  const [editParticipants, setEditParticipants] = useState([]);
  const [editSaving, setEditSaving]   = useState(false);

  const sorted = [...meetings].sort((a, b) => new Date(b.meeting_date) - new Date(a.meeting_date));

  const toggleExpanded = (id) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const toggleParticipant = (id, list, setList) => {
    setList(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.day || !form.month || !form.year) return;
    setSubmitting(true);
    try {
      await apiClient.post("/meetings/", {
        title: form.title, summary: form.summary,
        meeting_date: fieldsToTimestamp(form), project_id: projectId,
        participant_ids: selectedParticipants,
      });
      setForm(EMPTY_FORM);
      setSelectedParticipants([]);
      setShowForm(false);
      fetchProject();
    } catch (err) { console.error(err); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (e, meetingId) => {
    e.stopPropagation();
    if (!window.confirm("Delete this meeting?")) return;
    await apiClient.delete(`/meetings/${meetingId}`);
    fetchProject();
  };

  const startEdit = (e, meeting) => {
    e.stopPropagation();
    const fields = dateToFields(meeting.meeting_date);
    setEditingId(meeting.meeting_id);
    setEditForm({ title: meeting.title, summary: meeting.summary ?? "", ...fields });
    setEditParticipants(meeting.participants?.map(p => p.contributor_id) ?? []);
  };

  const handleEditSave = async (meetingId) => {
    setEditSaving(true);
    try {
      await apiClient.patch(`/meetings/${meetingId}`, {
        title: editForm.title,
        summary: editForm.summary || null,
        meeting_date: fieldsToTimestamp(editForm),
        participant_ids: editParticipants,
      });
      setEditingId(null);
      fetchProject();
    } catch (err) { console.error(err); }
    finally { setEditSaving(false); }
  };

  return (
    <div className="section-panel">
      <div className="section-panel__header">
        <h3>Meetings <span className="meeting-count">({meetings.length})</span></h3>
        <button className="add-btn" onClick={() => setShowForm(v => !v)}>
          {showForm ? "Cancel" : "+ Add Meeting"}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <form className="idea-form" onSubmit={handleSubmit}>
          <input className="form-input" name="title" placeholder="Meeting title" value={form.title} onChange={handleChange} required />
          <DateField
            value={{ day: form.day, month: form.month, year: form.year }}
            onChange={(next) => setForm(prev => ({ ...prev, ...next }))}
          />
          <textarea className="form-input" name="summary" placeholder="Summary (optional)" value={form.summary} onChange={handleChange} rows={3} />
          {projectContributors.length > 0 && (
            <div className="participant-selector">
              <p className="participant-selector__label">Participants</p>
              <div className="participant-selector__list">
                {projectContributors.map(pc => (
                  <label key={pc.contributor.contributor_id} className="participant-checkbox">
                    <input type="checkbox"
                      checked={selectedParticipants.includes(pc.contributor.contributor_id)}
                      onChange={() => toggleParticipant(pc.contributor.contributor_id, selectedParticipants, setSelectedParticipants)}
                    />
                    {pc.contributor.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          <button className="add-btn" type="submit" disabled={submitting}>{submitting ? "Saving..." : "Save Meeting"}</button>
        </form>
      )}

      {sorted.length === 0 ? (
        <p className="empty-state">No meetings yet.</p>
      ) : (
        <ul className="meeting-list">
          {sorted.map(meeting => {
            const isOpen    = expandedIds.has(meeting.meeting_id);
            const isEditing = editingId === meeting.meeting_id;
            return (
              <li key={meeting.meeting_id} className={`meeting-item ${isOpen ? "meeting-item--open" : ""}`}>
                <div className="meeting-item__header" onClick={() => !isEditing && toggleExpanded(meeting.meeting_id)}>
                  <span className="meeting-item__chevron">{isOpen ? "▾" : "▸"}</span>
                  <span className="meeting-item__title">{meeting.title}</span>
                  <span className="meeting-item__date-inline">{formatDate(meeting.meeting_date)}</span>
                  {/* Edit button */}
                  <button
                    onClick={(e) => isEditing ? (e.stopPropagation(), setEditingId(null)) : startEdit(e, meeting)}
                    title={isEditing ? "Cancel edit" : "Edit meeting"}
                    style={{ background: "none", border: "1px solid var(--border-color)", borderRadius: 6, padding: "2px 8px", fontSize: 12, cursor: "pointer", color: "var(--text-muted)", marginRight: 4 }}
                  >
                    {isEditing ? "✕" : "✏️"}
                  </button>
                  <button className="delete-btn" onClick={(e) => handleDelete(e, meeting.meeting_id)} title="Delete meeting">×</button>
                </div>

                {/* Inline edit form */}
                {isEditing && (
                  <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-color)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <input className="form-input" placeholder="Title *" value={editForm.title}
                      onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} style={{ gridColumn: "1 / -1" }} />
                    <div style={{ gridColumn: "1 / -1" }}>
                      <DateField
                        value={{ day: editForm.day, month: editForm.month, year: editForm.year }}
                        onChange={(next) => setEditForm(f => ({ ...f, ...next }))}
                      />
                    </div>
                    <textarea className="form-input" placeholder="Summary" value={editForm.summary}
                      onChange={e => setEditForm(f => ({ ...f, summary: e.target.value }))}
                      rows={3} style={{ gridColumn: "1 / -1", resize: "vertical" }} />
                    {projectContributors.length > 0 && (
                      <div style={{ gridColumn: "1 / -1" }} className="participant-selector">
                        <p className="participant-selector__label">Participants</p>
                        <div className="participant-selector__list">
                          {projectContributors.map(pc => (
                            <label key={pc.contributor.contributor_id} className="participant-checkbox">
                              <input type="checkbox"
                                checked={editParticipants.includes(pc.contributor.contributor_id)}
                                onChange={() => toggleParticipant(pc.contributor.contributor_id, editParticipants, setEditParticipants)}
                              />
                              {pc.contributor.name}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
                      <button onClick={() => handleEditSave(meeting.meeting_id)} disabled={editSaving}
                        style={{ padding: "5px 14px", borderRadius: 8, border: "none", background: "var(--accent-blue)", color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                        {editSaving ? "Saving…" : "Save"}
                      </button>
                      <button onClick={() => setEditingId(null)}
                        style={{ padding: "5px 14px", borderRadius: 8, border: "1px solid var(--border-color)", background: "transparent", fontSize: 12, cursor: "pointer" }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Expanded body (only when not editing) */}
                {isOpen && !isEditing && (
                  <div className="meeting-item__body">
                    {meeting.participants?.length > 0 && (
                      <table className="participants-table">
                        <tbody>
                          {meeting.participants.map(p => <tr key={p.contributor_id}><td>{p.name}</td></tr>)}
                        </tbody>
                      </table>
                    )}
                    {meeting.summary && <p className="meeting-item__summary">{meeting.summary}</p>}
                    {!meeting.summary && !meeting.participants?.length && <p className="empty-state">No details recorded.</p>}
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