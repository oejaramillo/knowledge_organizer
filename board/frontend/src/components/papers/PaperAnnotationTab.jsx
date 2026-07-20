// src/components/papers/PaperAnnotationsTab.jsx
import React, { useState, useEffect } from 'react';
import { ANNOTATION_COLORS } from './paperUtils';

const API = 'http://localhost:8000';

const TYPE_ICONS = {
  highlight: '🖊',
  note:      '📝',
  image:     '🖼',
  ink:       '✍️',
};

export default function PaperAnnotationsTab({ paperId }) {
  const [annotations, setAnnotations] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [filterColor, setFilterColor] = useState('');
  const [filterType, setFilterType]   = useState('');

  useEffect(() => {
    fetch(`${API}/api/papers/${paperId}/annotations`)
      .then(r => r.json())
      .then(data => { setAnnotations(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [paperId]);

  const colors = [...new Set(annotations.map(a => a.color).filter(Boolean))];
  const types  = [...new Set(annotations.map(a => a.annotation_type).filter(Boolean))];

  const filtered = annotations.filter(a => {
    if (filterColor && a.color !== filterColor) return false;
    if (filterType  && a.annotation_type !== filterType) return false;
    return true;
  });

  if (loading) return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading annotations…</p>;

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)', flex: 1 }}>
          {filtered.length} annotation{filtered.length !== 1 ? 's' : ''} (synced from Zotero)
        </span>

        {/* Color filter pills */}
        <div style={{ display: 'flex', gap: 4 }}>
          {colors.map(color => (
            <button
              key={color}
              onClick={() => setFilterColor(f => f === color ? '' : color)}
              style={{
                width: 20, height: 20, borderRadius: '50%',
                border: `2px solid ${filterColor === color ? '#1e293b' : color}`,
                background: color,   // ← use the hex directly
                cursor: 'pointer', padding: 0,
                opacity: filterColor && filterColor !== color ? 0.4 : 1,
                transition: 'all 0.15s',
              }}
              title={color}
            />
          ))}
        </div>

        {/* Type filter */}
        {types.length > 1 && (
          <select
            className="form-input"
            style={{ width: 'auto', fontSize: 12, padding: '4px 8px' }}
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
          >
            <option value="">All types</option>
            {types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
      </div>

      {/* Annotations */}
      {filtered.length === 0 ? (
        <p className="empty-state">
          {annotations.length === 0 ? 'No annotations synced from Zotero yet.' : 'No annotations match filter.'}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(a => {
            const borderColor = a.color || '#e2e8f0';
            const bgColor     = a.color ? `${a.color}22` : '#f8fafc'; // hex + alpha for bg
            const textColor   = 'var(--text-main)';

            return (
              <div key={a.annotation_id} style={{
                borderLeft: `4px solid ${borderColor}`,
                background: bgColor,
                borderRadius: '0 8px 8px 0',
                padding: '10px 14px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: a.highlight_text || a.user_note ? 6 : 0 }}>
                  <span style={{ fontSize: 14 }}>{TYPE_ICONS[a.annotation_type] || '📌'}</span>
                  {a.page_number && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>p. {a.page_number}</span>
                  )}
                  {a.color && (
                    <span style={{
                      fontSize: 10, padding: '1px 7px', borderRadius: 999,
                      background: a.color, color: '#fff', fontWeight: 600,
                      textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                    }}>
                      {a.color}
                    </span>
                  )}
                </div>

                {a.highlight_text && (
                  <blockquote style={{
                    margin: '0 0 6px', padding: '4px 10px',
                    borderLeft: `3px solid ${borderColor}`,
                    fontSize: 13, color: textColor, fontStyle: 'italic', lineHeight: 1.6,
                  }}>
                    "{a.highlight_text}"
                  </blockquote>
                )}

                {a.user_note && (
                  <p style={{ margin: 0, fontSize: 13, color: textColor, lineHeight: 1.5 }}>
                    💬 {a.user_note}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}