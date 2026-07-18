import React from 'react';
import { labelStyle, EMPTY_FORM } from './taskUtils';

export default function TaskForm({ form, setField, editingTask, contributors, submitting, onSubmit, onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
      zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <form
        onSubmit={onSubmit}
        style={{
          background: 'var(--bg-white)', borderRadius: 12, padding: 24,
          width: 440, boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ margin: 0, fontSize: 15 }}>{editingTask ? 'Edit Task' : 'New Task'}</h4>
          <button type="button" onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-muted)' }}>
            ×
          </button>
        </div>

        <input
          className="form-input"
          placeholder="Title *"
          value={form.title}
          onChange={e => setField('title', e.target.value)}
          required
        />

        <textarea
          className="form-input"
          placeholder="Description (optional)"
          value={form.description}
          onChange={e => setField('description', e.target.value)}
          rows={3}
          style={{ resize: 'vertical' }}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={labelStyle}>Priority</label>
            <select className="form-input" value={form.priority} onChange={e => setField('priority', e.target.value)}>
              {['low', 'medium', 'high', 'urgent'].map(p => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Due Date</label>
            <input
              className="form-input"
              type="date"
              value={form.due_date}
              onChange={e => setField('due_date', e.target.value)}
            />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Assign to</label>
          <select className="form-input" value={form.assigned_to} onChange={e => setField('assigned_to', e.target.value)}>
            <option value="">— Unassigned —</option>
            {contributors.map(c => (
              <option key={c.contributor_id} value={c.contributor_id}>{c.name}</option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="action-btn action-btn--solid"
          style={{ marginTop: 4 }}
        >
          {submitting ? 'Saving…' : editingTask ? 'Save Changes' : 'Create Task'}
        </button>
      </form>
    </div>
  );
}