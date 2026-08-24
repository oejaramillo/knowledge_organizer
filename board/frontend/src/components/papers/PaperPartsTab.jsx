import { useState, useEffect } from 'react';
import apiClient from '../../api/client';

export default function PaperPartsTab({ paperId }) {
  const [parts, setParts]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding]     = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');

  // Date picker state: partId waiting for a date before saving
  const [datePicking, setDatePicking] = useState(null); // part_id
  const [dateForm, setDateForm]       = useState({ day: '', month: '', year: '' });

  const fetchParts = async () => {
    try {
      const { data } = await apiClient.get(`/papers/${paperId}/parts`);
      setParts(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchParts(); }, [paperId]);

  const readCount = parts.filter(p => p.is_read).length;
  const total     = parts.length;
  const progress  = total > 0 ? Math.round((readCount / total) * 100) : 0;

  const addPart = async () => {
    if (!newTitle.trim()) return;
    setAdding(true);
    try {
      await apiClient.post(`/papers/${paperId}/parts`, {
        title: newTitle.trim(),
        position: total + 1,
      });
      setNewTitle('');
      fetchParts();
    } catch (err) { console.error(err); }
    finally { setAdding(false); }
  };

  // Checking a box → open date picker; unchecking → clear immediately
  const handleCheckbox = (part) => {
    if (part.is_read) {
      // uncheck immediately
      apiClient.patch(`/papers/parts/${part.part_id}`, { is_read: false, date_read: null })
        .then(fetchParts).catch(console.error);
    } else {
      setDatePicking(part.part_id);
      setDateForm({ day: '', month: '', year: '' });
    }
  };

  const buildIsoDate = ({ day, month, year }) => {
    if (day && month && year)
      return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}T12:00:00Z`;
    return new Date().toISOString();
  };

  const confirmRead = async (partId) => {
    try {
      await apiClient.patch(`/papers/parts/${partId}`, {
        is_read:   true,
        date_read: buildIsoDate(dateForm),
      });
      setDatePicking(null);
      fetchParts();
    } catch (err) { console.error(err); }
  };

  const saveEdit = async (partId) => {
    if (!editTitle.trim()) return;
    try {
      await apiClient.patch(`/papers/parts/${partId}`, { title: editTitle.trim() });
      setEditingId(null);
      fetchParts();
    } catch (err) { console.error(err); }
  };

  const deletePart = async (partId) => {
    if (!window.confirm('Delete this part?')) return;
    try {
      await apiClient.delete(`/papers/parts/${partId}`);
      fetchParts();
    } catch (err) { console.error(err); }
  };

  if (loading) return <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading…</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Progress bar */}
      {total > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Progress
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {readCount}/{total} parts read ({progress}%)
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: 'var(--border-color)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 999,
              width: `${progress}%`,
              background: progress === 100 ? '#22c55e' : 'var(--accent-blue)',
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
      )}

      {/* Parts list */}
      {parts.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
          No parts yet. Add chapters or sections below.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {parts.map(part => (
            <li key={part.part_id} style={{
              display: 'flex', flexDirection: 'column', gap: 6,
              padding: '8px 12px', borderRadius: 8,
              background: part.is_read ? 'var(--accent-bg)' : 'var(--bg-white)',
              border: `1px solid ${datePicking === part.part_id ? 'var(--accent-blue)' : part.is_read ? 'var(--accent-blue)' : 'var(--border-color)'}`,
              transition: 'all 0.15s',
            }}>
              {/* Main row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={part.is_read || datePicking === part.part_id}
                  onChange={() => handleCheckbox(part)}
                  style={{ accentColor: 'var(--accent-blue)', width: 15, height: 15, cursor: 'pointer', flexShrink: 0 }}
                />

                {/* Title / edit inline */}
                {editingId === part.part_id ? (
                  <input
                    autoFocus
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(part.part_id); if (e.key === 'Escape') setEditingId(null); }}
                    style={{ flex: 1, fontSize: 13, border: '1px solid var(--accent-blue)', borderRadius: 6, padding: '2px 8px' }}
                  />
                ) : (
                  <span style={{
                    flex: 1, fontSize: 13,
                    color: part.is_read ? 'var(--text-muted)' : 'var(--text-main)',
                    textDecoration: part.is_read ? 'line-through' : 'none',
                  }}>
                    {part.title}
                  </span>
                )}

                {/* Date read */}
                {part.is_read && part.date_read && datePicking !== part.part_id && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(part.date_read).toLocaleDateString('en-GB')}
                  </span>
                )}

                {/* Actions */}
                {editingId === part.part_id ? (
                  <>
                    <button onClick={() => saveEdit(part.part_id)} style={actionBtn('#22c55e')}>✓</button>
                    <button onClick={() => setEditingId(null)} style={actionBtn('var(--text-muted)')}>✕</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { setEditingId(part.part_id); setEditTitle(part.title); }} style={actionBtn('var(--text-muted)')}>✎</button>
                    <button onClick={() => deletePart(part.part_id)} style={actionBtn('#ef4444')}>×</button>
                  </>
                )}
              </div>

              {/* Inline date picker — appears when checking */}
              {datePicking === part.part_id && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 25 }}>
                  <input
                    type="number" placeholder="DD" min="1" max="31"
                    value={dateForm.day}
                    onChange={e => setDateForm(f => ({ ...f, day: e.target.value }))}
                    style={{ width: 52, fontSize: 12, padding: '2px 6px', borderRadius: 6, border: '1px solid var(--border-color)' }}
                  />
                  <input
                    type="number" placeholder="MM" min="1" max="12"
                    value={dateForm.month}
                    onChange={e => setDateForm(f => ({ ...f, month: e.target.value }))}
                    style={{ width: 52, fontSize: 12, padding: '2px 6px', borderRadius: 6, border: '1px solid var(--border-color)' }}
                  />
                  <input
                    type="number" placeholder="YYYY" min="2000" max="2100"
                    value={dateForm.year}
                    onChange={e => setDateForm(f => ({ ...f, year: e.target.value }))}
                    style={{ width: 68, fontSize: 12, padding: '2px 6px', borderRadius: 6, border: '1px solid var(--border-color)' }}
                  />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>blank = today</span>
                  <button onClick={() => confirmRead(part.part_id)} style={actionBtn('#22c55e')}>✓</button>
                  <button onClick={() => setDatePicking(null)} style={actionBtn('var(--text-muted)')}>✕</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Add new part */}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="form-input"
          placeholder="Add chapter or section title…"
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addPart()}
          style={{ flex: 1 }}
        />
        <button
          onClick={addPart}
          disabled={adding || !newTitle.trim()}
          style={{
            padding: '5px 14px', borderRadius: 8, border: 'none',
            background: 'var(--accent-blue)', color: '#fff',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            opacity: adding || !newTitle.trim() ? 0.6 : 1,
          }}
        >
          {adding ? '…' : '+ Add'}
        </button>
      </div>
    </div>
  );
}

const actionBtn = (color) => ({
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 15, color, padding: '0 2px', lineHeight: 1,
  flexShrink: 0,
});