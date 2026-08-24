// src/components/papers/PaperDetail.jsx
import React, { useState, useEffect, useRef } from 'react';
import PaperClaimsTab from './PaperClaimsTab';
import PaperAnnotationsTab from './PaperAnnotationTab';
import PaperPartsTab from './PaperPartsTab';
import AuthorPopover from './AuthorPopover';
import apiClient from '../../api/client'

const TABS = ['Overview', 'Parts', 'Claims', 'Annotations'];

export default function PaperDetail({ paper, onUpdate, hideAuthors = false }) {
  const [activeTab, setActiveTab] = useState('Overview');
  const [saving, setSaving]       = useState(false);
  const [form, setForm]           = useState({
    theoretical_framework: paper.theoretical_framework || '',
    discipline:            paper.discipline || [],
    rating:                paper.rating ?? null,
    is_digital:            paper.is_digital ?? false,
    is_print:              paper.is_print ?? false,
  });

  const [activeAuthor, setActiveAuthor] = useState(null); // { id, ref }
  const chipRefs = useRef({});

  useEffect(() => {
    setForm({
      theoretical_framework: paper.theoretical_framework || '',
      discipline:            paper.discipline || [],
      rating:                paper.rating ?? null,
      is_digital:            paper.is_digital ?? false,
      is_print:              paper.is_print ?? false,
    });
  }, [paper.paper_id]);

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
      const { data: updated } = await apiClient.patch(`/papers/${paper.paper_id}`, form);
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
              padding: '5px 14px', fontSize: 13, borderRadius: 6,
              border: '1px solid var(--border-color)', cursor: 'pointer',
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
            {!hideAuthors &&(
            <div>
              <label style={labelStyle}>Authors</label>
              {authorsList.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>No authors synced</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {authorsList.map(pa => (
                    <span
                      key={pa.author_id}
                      ref={el => chipRefs.current[pa.author_id] = el}
                      onClick={() => setActiveAuthor(
                        activeAuthor?.id === pa.author_id ? null : { id: pa.author_id, ref: { current: chipRefs.current[pa.author_id] } }
                      )}
                      style={{
                        ...authorChipStyle,
                        cursor: 'pointer',
                        background: activeAuthor?.id === pa.author_id ? 'var(--accent-bg)' : '#f1f5f9',
                        borderColor: activeAuthor?.id === pa.author_id ? 'var(--accent-blue)' : 'var(--border-color)',
                        color: activeAuthor?.id === pa.author_id ? 'var(--accent-blue)' : 'var(--text-main)',
                      }}
                    >
                      {pa.full_name}
                      {pa.institution && (
                        <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>· {pa.institution}</span>
                      )}
                    </span>
                  ))}
                </div>
              )}

              {/* Author popover */}
              {activeAuthor && (
                <AuthorPopover
                  authorId={activeAuthor.id}
                  anchorRef={activeAuthor.ref}
                  onClose={() => setActiveAuthor(null)}
                />
              )}
            </div>
            )}

            {/* Publication info */}
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.8 }}>
              {paper.zotero_key && <div><strong>Zotero Key:</strong> {paper.zotero_key}</div>}
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

            {/* Rating */}
            <div>
              <label style={labelStyle}>Rating</label>
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => setField('rating', form.rating === star ? null : star)}
                    style={{
                      fontSize: 22,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: form.rating >= star ? '#f59e0b' : '#d1d5db',
                      padding: '0 2px',
                      lineHeight: 1,
                      transition: 'color 0.1s',
                    }}
                    title={`${star} star${star > 1 ? 's' : ''}`}
                  >
                    ★
                  </button>
                ))}
                {form.rating && (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center', marginLeft: 4 }}>
                    {form.rating}/5
                  </span>
                )}
              </div>
            </div>

            {/* Format */}
            <div>
              <label style={labelStyle}>Format</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                {[
                  { field: 'is_digital', label: '💾 Digital (PDF)' },
                  { field: 'is_print',   label: '📖 Physical' },
                ].map(opt => (
                  <button
                    key={opt.field}
                    onClick={() => setField(opt.field, !form[opt.field])}
                    style={{
                      padding: '5px 14px', fontSize: 12, borderRadius: 999,
                      border: `1px solid ${form[opt.field] ? 'var(--accent-blue)' : 'var(--border-color)'}`,
                      background: form[opt.field] ? 'var(--accent-bg)' : 'transparent',
                      color: form[opt.field] ? 'var(--accent-blue)' : 'var(--text-muted)',
                      cursor: 'pointer', fontWeight: form[opt.field] ? 600 : 400,
                      transition: 'all 0.12s',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Theoretical Framework */}
            <div>
              <label style={labelStyle}>Theoretical Framework</label>
              <p style={{ fontSize: 13, color: 'var(--text-main)', margin: '4px 0 0', lineHeight: 1.6 }}>
                {paper.theoretical_framework || <span style={{ color: 'var(--text-muted)' }}>—</span>}
              </p>
            </div>

            {/* Discipline */}
            <div>
              <label style={labelStyle}>Discipline</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {form.discipline?.length > 0
                  ? form.discipline.map(d => (
                      <span key={d} style={tagToggleStyle(true)}>{d}</span>
                    ))
                  : <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>—</span>
                }
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

      {/* ── PARTS TAB ── */}
      {activeTab === 'Parts' && (
        <PaperPartsTab paperId={paper.paper_id} />
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