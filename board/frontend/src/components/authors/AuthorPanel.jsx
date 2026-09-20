// src/components/authors/AuthorPanel.jsx
//
// Author details shown in a third panel anchored to the right edge of the
// window. It replaces the old floating popover, which had to guess its own
// position from the clicked chip and often rendered off-screen.

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import PaperRow from '../papers/PaperRow';
import apiClient from '../../api/client';

const PANEL_WIDTH = 460;

function Avatar({ author }) {
  if (author.profile_picture) {
    return (
      <img
        src={author.profile_picture}
        alt={author.full_name}
        style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }

  const initials = author.full_name
    ?.split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

  return (
    <div style={{
      width: 64, height: 64, borderRadius: '50%',
      background: 'var(--accent-blue)', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 22, fontWeight: 700, flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

export default function AuthorPanel({ authorId, onClose }) {
  const [author, setAuthor]         = useState(null);
  const [loading, setLoading]       = useState(true);
  const [editing, setEditing]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [form, setForm]             = useState({});
  const [countries, setCountries]   = useState([]);
  const [error, setError]           = useState(null);
  const panelRef = useRef(null);

  // Fetch country suggestions once
  useEffect(() => {
    apiClient.get('/authors/countries')
      .then(({ data }) => setCountries(data))
      .catch(() => {});
  }, []);

  // Load the author whenever the selection changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setEditing(false);
    setExpandedId(null);

    apiClient.get(`/authors/${authorId}`)
      .then(({ data }) => {
        if (cancelled) return;
        setAuthor(data);
        setForm({
          institution:     data.institution     || '',
          country:         data.country         || '',
          profile_picture: data.profile_picture || '',
          webpage:         data.webpage         || '',
        });
      })
      .catch(() => { if (!cancelled) setAuthor(null); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [authorId]);

  // Escape closes the panel
  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => { panelRef.current?.focus(); }, [authorId]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const { data: updated } = await apiClient.patch(`/authors/${authorId}`, form);
      setAuthor(updated);
      setEditing(false);
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not save the author.');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <aside
      ref={panelRef}
      tabIndex={-1}
      aria-label="Author details"
      style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: `min(${PANEL_WIDTH}px, 100vw)`,
        zIndex: 400,
        display: 'flex', flexDirection: 'column',
        background: 'var(--bg-white)',
        borderLeft: '1px solid var(--border-color)',
        boxShadow: '-8px 0 28px rgba(15, 23, 42, 0.12)',
        outline: 'none',
      }}
    >
      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, padding: '12px 16px',
        borderBottom: '1px solid var(--border-color)',
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.08em', color: 'var(--text-muted)',
        }}>
          Author
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          {author && (
            <button className="action-btn" onClick={() => setEditing(e => !e)}>
              {editing ? 'Cancel' : '✏️ Edit'}
            </button>
          )}
          <button className="action-btn" onClick={onClose} title="Close (Esc)">✕</button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 24, fontSize: 13, color: 'var(--text-muted)' }}>Loading…</div>
      ) : !author ? (
        <div style={{ padding: 24, fontSize: 13, color: 'var(--text-muted)' }}>Author not found.</div>
      ) : (
        <>
          {/* ── Identity ── */}
          <div style={{
            display: 'flex', gap: 14, alignItems: 'flex-start',
            padding: '16px', borderBottom: '1px solid var(--border-color)',
            flexShrink: 0,
          }}>
            <Avatar author={author} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>
                {author.full_name}
              </div>
              {author.institution && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  🏛 {author.institution}
                </div>
              )}
              {author.country && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>📍 {author.country}</div>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                {author.orcid && (
                  <a href={`https://orcid.org/${author.orcid}`} target="_blank" rel="noreferrer"
                    style={{ fontSize: 11, color: 'var(--accent-blue)' }}>ORCID ↗</a>
                )}
                {author.webpage && (
                  <a href={author.webpage} target="_blank" rel="noreferrer"
                    style={{ fontSize: 11, color: 'var(--accent-blue)' }}>Website ↗</a>
                )}
              </div>
            </div>
          </div>

          {/* ── Edit form ── */}
          {editing && (
            <div style={{
              padding: 16, flexShrink: 0,
              borderBottom: '1px solid var(--border-color)',
              display: 'flex', flexDirection: 'column', gap: 10,
              background: 'var(--bg-main)',
            }}>
              {error && <p style={{ color: 'var(--danger)', fontSize: 12, margin: 0 }}>{error}</p>}

              <div>
                <label style={labelStyle}>Institution</label>
                <input className="form-input" value={form.institution}
                  onChange={e => setForm(f => ({ ...f, institution: e.target.value }))}
                  placeholder="University of..." />
              </div>

              <div>
                <label style={labelStyle}>Country</label>
                <input
                  className="form-input"
                  value={form.country}
                  onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                  list="author-country-options"
                  placeholder="e.g. Ecuador"
                  autoComplete="off"
                />
                <datalist id="author-country-options">
                  {countries.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>

              <div>
                <label style={labelStyle}>Website URL</label>
                <input className="form-input" value={form.webpage}
                  onChange={e => setForm(f => ({ ...f, webpage: e.target.value }))}
                  placeholder="https://..." />
              </div>

              <div>
                <label style={labelStyle}>Profile picture URL</label>
                <input className="form-input" value={form.profile_picture}
                  onChange={e => setForm(f => ({ ...f, profile_picture: e.target.value }))}
                  placeholder="https://..." />
                {form.profile_picture && (
                  <img src={form.profile_picture} alt="preview"
                    onError={e => { e.target.style.display = 'none'; }}
                    style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', marginTop: 6 }} />
                )}
              </div>

              <button className="submit-btn" onClick={save} disabled={saving}
                style={{ alignSelf: 'flex-start' }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}

          {/* ── Papers ── */}
          <div style={{
            flex: 1, minHeight: 0, overflowY: 'auto',
            overscrollBehavior: 'contain',
            padding: 16,
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={labelStyle}>Papers ({author.papers?.length || 0})</div>
            {author.papers?.length === 0 && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>No papers linked.</p>
            )}
            {author.papers?.map(paper => (
              <PaperRow
                key={paper.paper_id}
                paper={paper}
                hideAuthors
                isExpanded={expandedId === paper.paper_id}
                onToggleExpand={() => setExpandedId(id => id === paper.paper_id ? null : paper.paper_id)}
                onUpdate={(id, fields) =>
                  setAuthor(a => ({
                    ...a,
                    papers: a.papers.map(p => p.paper_id === id ? { ...p, ...fields } : p),
                  }))
                }
              />
            ))}
          </div>
        </>
      )}
    </aside>,
    document.body,
  );
}

const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: 'var(--text-muted)', textTransform: 'uppercase',
  letterSpacing: '0.05em', marginBottom: 3,
};
