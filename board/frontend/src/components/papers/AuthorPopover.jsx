// src/components/papers/AuthorPopover.jsx
import React, { useState, useEffect, useRef } from 'react';
import PaperRow from './PaperRow';

const API = 'http://localhost:8000';

const AVATAR_PLACEHOLDER = (name) => {
  const initials = name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
  return (
    <div style={{
      width: 72, height: 72, borderRadius: '50%',
      background: 'var(--accent-blue)', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 26, fontWeight: 700, flexShrink: 0,
    }}>
      {initials}
    </div>
  );
};

export default function AuthorPopover({ authorId, anchorRef, onClose }) {
  const [author, setAuthor]           = useState(null);
  const [loading, setLoading]         = useState(true);
  const [editing, setEditing]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [expandedId, setExpandedId]   = useState(null);
  const [form, setForm]               = useState({});
  const [countries, setCountries]     = useState([]);
  const popoverRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  // Position
  useEffect(() => {
    if (anchorRef?.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      const margin = 12;
      const spaceBelow = window.innerHeight - rect.bottom - margin;
      const spaceAbove = rect.top - margin;

      let top, maxHeight;
      if (spaceBelow >= 300) {
        // Enough room below — open downward, use up to 80vh
        top = rect.bottom + 6;
        maxHeight = Math.min(spaceBelow, window.innerHeight * 0.82);
      } else if (spaceAbove >= 300) {
        // Flip upward
        maxHeight = Math.min(spaceAbove, window.innerHeight * 0.82);
        top = rect.top - maxHeight - 6;
      } else {
        // Neither side has enough — center it vertically in viewport
        maxHeight = window.innerHeight * 0.85;
        top = Math.max(margin, (window.innerHeight - maxHeight) / 2);
      }

      setPos({
        top,
        left: Math.max(margin, Math.min(rect.left, window.innerWidth - 620 - margin)),
        maxHeight,
      });
    }
  }, [anchorRef]);

  // Fetch countries
  useEffect(() => {
    fetch(`${API}/api/authors/countries`)
      .then(r => r.json())
      .then(setCountries)
      .catch(() => {});
  }, []);

  // Fetch author
  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/authors/${authorId}`)
      .then(r => r.json())
      .then(data => {
        setAuthor(data);
        setForm({
          institution:     data.institution     || '',
          country:         data.country         || '',
          profile_picture: data.profile_picture || '',
          webpage:         data.webpage         || '',
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [authorId]);

  // Click-outside close
  useEffect(() => {
    const handler = (e) => {
        if (
        popoverRef.current && !popoverRef.current.contains(e.target) &&
        anchorRef?.current && !anchorRef.current.contains(e.target) &&
        (!suggestionsRef.current || !suggestionsRef.current.contains(e.target))  // null-safe
        ) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
    }, [onClose]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/authors/${authorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const updated = await res.json();
      setAuthor(updated);
      setEditing(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        top: pos.top, left: pos.left,
        zIndex: 200, width: 600,
        maxHeight: pos.maxHeight || '80vh',
        display: 'flex', flexDirection: 'column',
        background: 'var(--bg-white)',
        border: '1px solid var(--border-color)',
        borderRadius: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
        overflow: 'hidden',
        minHeight: 0,
      }}
    >
      {loading ? (
        <div style={{ padding: 24, fontSize: 13, color: 'var(--text-muted)' }}>Loading…</div>
      ) : !author ? (
        <div style={{ padding: 24, fontSize: 13, color: 'var(--text-muted)' }}>Author not found.</div>
      ) : (
        <>
          {/* ── Header ── */}
          <div style={{
            padding: '16px 16px 12px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex', gap: 14, alignItems: 'flex-start', flexShrink: 0,
          }}>
            {author.profile_picture
              ? <img src={author.profile_picture} alt={author.full_name}
                  style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              : AVATAR_PLACEHOLDER(author.full_name)
            }
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', marginBottom: 2 }}>
                {author.full_name}
              </div>
              {author.institution && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>🏛 {author.institution}</div>}
              {author.country     && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>📍 {author.country}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
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
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button onClick={() => setEditing(e => !e)} style={btnStyle}>
                {editing ? 'Cancel' : '✏️ Edit'}
              </button>
              <button onClick={onClose} style={{ ...btnStyle, border: 'none' }}>✕</button>
            </div>
          </div>

          {/* ── Edit form ── */}
          {editing && (
            <div style={{
              padding: '12px 16px', flexShrink: 0,
              borderBottom: '1px solid var(--border-color)',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              {/* Institution */}
              <div>
                <label style={labelStyle}>Institution</label>
                <input className="form-input" value={form.institution}
                  onChange={e => setForm(f => ({ ...f, institution: e.target.value }))}
                  placeholder="University of..." />
              </div>

              {/* Country — native datalist autocomplete */}
              <div>
                <label style={labelStyle}>Country</label>
                <input
                  className="form-input"
                  value={form.country}
                  onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                  list="country-options"
                  placeholder="e.g. Mexico"
                  autoComplete="off"
                />
                <datalist id="country-options">
                  {countries.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>

              {/* Webpage */}
              <div>
                <label style={labelStyle}>Website URL</label>
                <input className="form-input" value={form.webpage}
                  onChange={e => setForm(f => ({ ...f, webpage: e.target.value }))}
                  placeholder="https://..." />
              </div>

              {/* Profile picture */}
              <div>
                <label style={labelStyle}>Profile Pic URL</label>
                <input className="form-input" value={form.profile_picture}
                  onChange={e => setForm(f => ({ ...f, profile_picture: e.target.value }))}
                  placeholder="https://..." />
                {form.profile_picture && (
                  <img src={form.profile_picture} alt="preview"
                    onError={e => { e.target.style.display = 'none'; }}
                    style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', marginTop: 4 }} />
                )}
              </div>

              <button className="action-btn action-btn--solid" onClick={save}
                disabled={saving} style={{ alignSelf: 'flex-start' }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}

          {/* ── Papers list (scrollable) ── */}
          <div style={{
            padding: '12px 16px', overflowY: 'auto', flex: 1,
            minHeight: 0,
            overscrollBehavior: 'contain',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={sectionHeaderStyle}>
              Papers ({author.papers?.length || 0})
            </div>
            {author.papers?.length === 0 && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>No papers linked.</p>
            )}
            {author.papers?.map(paper => (
              <PaperRow
                key={paper.paper_id}
                paper={paper}
                hideAuthors={true}
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
    </div>
  );
}

const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: 'var(--text-muted)', textTransform: 'uppercase',
  letterSpacing: '0.05em', marginBottom: 3,
};

const btnStyle = {
  fontSize: 11, padding: '3px 10px', borderRadius: 6,
  border: '1px solid var(--border-color)', background: 'none',
  cursor: 'pointer', color: 'var(--text-muted)',
};

const sectionHeaderStyle = {
  fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.05em',
};