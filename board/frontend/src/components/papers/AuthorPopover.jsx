// src/components/papers/AuthorPopover.jsx
import React, { useState, useEffect, useRef } from 'react';
import PaperRow from './PaperRow';
import { formatDocType } from './paperUtils';

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
  const [author, setAuthor]       = useState(null);
  const [loading, setLoading]     = useState(true);
  const [editing, setEditing]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [form, setForm]           = useState({});
  const popoverRef                = useRef(null);

  // Position popover near anchor
  const [pos, setPos] = useState({ top: 0, left: 0 });
  useEffect(() => {
    if (anchorRef?.current) {
        const rect = anchorRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom - 12;
        const spaceAbove = rect.top - 12;
        const popoverHeight = Math.min(520, Math.max(spaceBelow, spaceAbove));

        const top = spaceBelow >= 200
        ? rect.bottom + 6                          // open downward
        : rect.top - Math.min(520, spaceAbove) - 6; // flip upward

        setPos({
        top,
        left: Math.min(rect.left + window.scrollX, window.innerWidth - 420),
        maxHeight: popoverHeight,
        });
    }
    }, [anchorRef]);

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
      if (popoverRef.current && !popoverRef.current.contains(e.target) &&
          anchorRef?.current && !anchorRef.current.contains(e.target)) {
        onClose();
      }
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
        top: pos.top,
        left: pos.left,
        zIndex: 200,
        width: 600,
        maxHeight: pos.maxHeight || '80vh',
        display: 'flex',
        flexDirection: 'column',        // ← key: children stack vertically
        background: 'var(--bg-white)',
        border: '1px solid var(--border-color)',
        borderRadius: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
        overflow: 'hidden',             // ← clip the container itself
    }}
    >
      {loading ? (
        <div style={{ padding: 24, fontSize: 13, color: 'var(--text-muted)' }}>Loading…</div>
      ) : !author ? (
        <div style={{ padding: 24, fontSize: 13, color: 'var(--text-muted)' }}>Author not found.</div>
      ) : (
        <>
          {/* Header */}
          <div style={{
            padding: '16px 16px 12px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex', gap: 14, alignItems: 'flex-start',
          }}>
            {/* Avatar */}
            {author.profile_picture
              ? <img src={author.profile_picture} alt={author.full_name}
                  style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              : AVATAR_PLACEHOLDER(author.full_name)
            }

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', marginBottom: 2 }}>
                {author.full_name}
              </div>
              {author.institution && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>🏛 {author.institution}</div>
              )}
              {author.country && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>📍 {author.country}</div>
              )}
              {author.orcid && (
                <a href={`https://orcid.org/${author.orcid}`} target="_blank" rel="noreferrer"
                  style={{ fontSize: 11, color: 'var(--accent-blue)' }}>
                  ORCID ↗
                </a>
              )}
              {author.webpage && (
                <a href={author.webpage} target="_blank" rel="noreferrer"
                  style={{ fontSize: 11, color: 'var(--accent-blue)', marginLeft: author.orcid ? 8 : 0 }}>
                  Website ↗
                </a>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button
                onClick={() => setEditing(e => !e)}
                style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 6,
                  border: '1px solid var(--border-color)', background: 'none',
                  cursor: 'pointer', color: 'var(--text-muted)',
                }}
              >
                {editing ? 'Cancel' : '✏️ Edit'}
              </button>
              <button
                onClick={onClose}
                style={{
                  fontSize: 14, padding: '2px 8px', borderRadius: 6,
                  border: 'none', background: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Edit form */}
          {editing && (
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              {[
                { key: 'institution',     label: 'Institution',      placeholder: 'University of...' },
                { key: 'country',         label: 'Country',          placeholder: 'e.g. Mexico' },
                { key: 'webpage',         label: 'Website URL',      placeholder: 'https://...' },
                { key: 'profile_picture', label: 'Profile Pic URL',  placeholder: 'https://...' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label style={labelStyle}>{label}</label>
                  <input
                    className="form-input"
                    value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                  />
                </div>
              ))}
              <button
                className="action-btn action-btn--solid"
                onClick={save}
                disabled={saving}
                style={{ alignSelf: 'flex-start' }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
          {/* Papers list — this part scrolls, not the whole popover */}
        <div style={{
        padding: '12px 16px',
        overflowY: 'auto',   // ← scroll here only
        flex: 1,             // ← takes remaining space after header/edit form
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Papers ({author.papers?.length || 0})
        </div>
            {/* Papers list */}
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Papers ({author.papers?.length || 0})
                </div>
                {author.papers?.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>No papers linked.</p>
                )}
                {author.papers?.map(paper => (
                <PaperRow
                    key={paper.paper_id}
                    paper={paper}
                    isExpanded={expandedId === paper.paper_id}
                    onToggleExpand={() => setExpandedId(id => id === paper.paper_id ? null : paper.paper_id)}
                    onUpdate={(id, fields) => {
                    setAuthor(a => ({
                        ...a,
                        papers: a.papers.map(p => p.paper_id === id ? { ...p, ...fields } : p),
                    }));
                    }}
                />
                ))}
            </div>
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