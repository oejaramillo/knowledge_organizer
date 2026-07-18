// src/components/papers/PaperDetail.jsx
import React, { useState } from 'react';
import PaperClaimsTab from './PaperClaimsTab';
import PaperAnnotationsTab from './PaperAnnotationTab';
import {
  STATUS_OPTIONS, DISCIPLINE_OPTIONS, CITATION_INTENT_OPTIONS, formatAuthors
} from './paperUtils';

const API = 'http://localhost:8000';
const TABS = ['Overview', 'Claims', 'Annotations'];

export default function PaperDetail({ paper, onUpdate }) {
  const [activeTab, setActiveTab] = useState('Overview');
  const [saving, setSaving]       = useState(false);
  const [form, setForm]           = useState({
    status:               paper.status || 'unread',
    theoretical_framework: paper.theoretical_framework || '',
    discipline:           paper.discipline || [],
    citation_intent:      paper.citation_intent || [],
  });

  const setField = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const toggleArray = (field, value) => {
    setForm(f => {
      const arr = f[field] || [];
      return {
        ...f,
        [field]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value],
      };
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/papers/${paper.paper_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Save failed');
      const updated = await res.json();
      onUpdate(paper.paper_id, updated);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const authorsList = paper.authors || [];

  return (
    <div style={{ padding: '16px 20px' }}>
      {/* Full Title */}
      <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.4 }}>
        {paper.title}
      </h3>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '5px 14px',
              fontSize: 13,
              borderRadius: 6,
              border: '1px solid var(--border-color)',
              cursor: 'pointer',
              background: activeTab === tab ? 'var(--accent-blue)' : 'var(--bg-white)',
              color:      activeTab === tab ? '#fff' : 'var(--text-muted)',
              fontWeight: activeTab === tab ? 600 : 400,
              transition: 'all 0.15s',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'Overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Authors */}
            <div>
              <label style={labelStyle}>Authors</label>
              {authorsList.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>No authors synced</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {authorsList.map(pa => (
                    <span key={pa.author_id} style={authorChipStyle}>
                        {pa.full_name}
                        {pa.institution && (
                        <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>
                            · {pa.institution}
                        </span>
                        )}
                    </span>
                    ))}
                </div>
              )}
            </div>

            {/* Publication info */}
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.8 }}>
              {paper.journal && <div><strong>Journal:</strong> {paper.journal}</div>}
              {paper.volume  && <div><strong>Volume:</strong> {paper.volume}{paper.issue ? `, Issue ${paper.issue}` : ''}</div>}
              {paper.pages   && <div><strong>Pages:</strong> {paper.pages}</div>}
              {paper.doi     && (
                <div>
                  <strong>DOI:</strong>{' '}
                  <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noreferrer"
                    style={{ color: 'var(--accent-blue)' }}>
                    {paper.doi}
                  </a>
                </div>
              )}
              {paper.url && (
                <div>
                  <strong>URL:</strong>{' '}
                  <a href={paper.url} target="_blank" rel="noreferrer"
                    style={{ color: 'var(--accent-blue)' }}>
                    Link ↗
                  </a>
                </div>
              )}
            </div>

            {/* Abstract */}
            {paper.abstract && (
              <div>
                <label style={labelStyle}>Abstract</label>
                <p style={{
                  fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6,
                  margin: '4px 0 0', maxHeight: 120, overflowY: 'auto',
                }}>
                  {paper.abstract}
                </p>
              </div>
            )}
          </div>

          {/* Right column — editable fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Status */}
            <div>
              <label style={labelStyle}>Status</label>
              <select
                className="form-input"
                value={form.status}
                onChange={e => setField('status', e.target.value)}
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* Theoretical Framework */}
            <div>
              <label style={labelStyle}>Theoretical Framework</label>
              <input
                className="form-input"
                value={form.theoretical_framework}
                onChange={e => setField('theoretical_framework', e.target.value)}
                placeholder="e.g. New Institutional Economics"
              />
            </div>

            {/* Discipline */}
            <div>
              <label style={labelStyle}>Discipline</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {DISCIPLINE_OPTIONS.map(d => (
                  <button
                    key={d}
                    onClick={() => toggleArray('discipline', d)}
                    style={tagToggleStyle(form.discipline?.includes(d))}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Citation Intent */}
            <div>
              <label style={labelStyle}>Citation Intent</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {CITATION_INTENT_OPTIONS.map(ci => (
                  <button
                    key={ci}
                    onClick={() => toggleArray('citation_intent', ci)}
                    style={tagToggleStyle(form.citation_intent?.includes(ci))}
                  >
                    {ci.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Save */}
            <button
              className="action-btn action-btn--solid"
              onClick={save}
              disabled={saving}
              style={{ alignSelf: 'flex-start', marginTop: 4 }}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      )}

      {/* ── CLAIMS TAB ── */}
      {activeTab === 'Claims' && (
        <PaperClaimsTab paperId={paper.paper_id} />
      )}

      {/* ── ANNOTATIONS TAB ── */}
      {activeTab === 'Annotations' && (
        <PaperAnnotationsTab paperId={paper.paper_id} />
      )}
    </div>
  );
}

// ── Local style helpers ──
const labelStyle = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 4,
};

const authorChipStyle = {
  fontSize: 12,
  padding: '3px 10px',
  borderRadius: 999,
  background: '#f1f5f9',
  color: 'var(--text-main)',
  border: '1px solid var(--border-color)',
};

const tagToggleStyle = (active) => ({
  fontSize: 12,
  padding: '3px 10px',
  borderRadius: 999,
  border: `1px solid ${active ? 'var(--accent-blue)' : 'var(--border-color)'}`,
  background: active ? 'var(--accent-bg)' : 'transparent',
  color:      active ? 'var(--accent-blue)' : 'var(--text-muted)',
  cursor: 'pointer',
  transition: 'all 0.12s',
});