// src/components/papers/PaperRow.jsx
import React, { useState, useRef, useEffect } from 'react';
import PaperDetail from './PaperDetail';
import { formatAuthors, formatDocType } from './paperUtils';

const API = 'http://localhost:8000';

export default function PaperRow({ paper, isExpanded, onToggleExpand, onUpdate }) {
  const authors = formatAuthors(paper.authors);
  const [pickingDate, setPickingDate] = useState(false);

  const getLocalTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

  const [dateValue, setDateValue] = useState(() => getLocalTodayString());
  const popoverRef = useRef(null);

  // Close popover on outside click
  useEffect(() => {
    if (!pickingDate) return;
    const handler = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setPickingDate(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [pickingDate]);

  const patchPaper = async (fields) => {
    onUpdate(paper.paper_id, fields);
    try {
      await fetch(`${API}/api/papers/${paper.paper_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
    } catch {
      const revert = Object.fromEntries(Object.keys(fields).map(k => [k, paper[k]]));
      onUpdate(paper.paper_id, revert);
    }
  };

  const handleCheckbox = (e) => {
    e.stopPropagation();
    if (!paper.is_read) {
      setDateValue(getLocalTodayString());
      setPickingDate(true);
    } else {
      patchPaper({ is_read: false, date_read: null });
    }
  };

  const handleConfirmDate = (e) => {
    e.stopPropagation();
    setPickingDate(false);
    patchPaper({ is_read: true, date_read: dateValue });
  };

  const handleCancelDate = (e) => {
    e.stopPropagation();
    setPickingDate(false);
  };

  const readDate = paper.date_read
    ? new Date(paper.date_read).toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric',
        timeZone: 'UTC' // <--- Forces JS to display the UTC date instead of converting to your local time
      })
    : null;

  return (
    <div
      style={{
        border: '1px solid var(--border-color)',
        borderRadius: 8,
        overflow: pickingDate ? 'visible' : 'hidden',
        background: 'var(--bg-white)',
        transition: 'box-shadow 0.15s',
        boxShadow: isExpanded ? '0 2px 10px rgba(0,0,0,0.07)' : 'none',
        position: 'relative',
      }}
    >
      {/* Row header */}
      <div
        onClick={onToggleExpand}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        {/* Read checkbox + popover */}
        <div
          ref={popoverRef}
          style={{ position: 'relative', flexShrink: 0 }}
          onClick={e => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={paper.is_read}
            onChange={handleCheckbox}
            style={{ cursor: 'pointer', accentColor: 'var(--accent-blue)' }}
            title={paper.is_read ? 'Mark as unread' : 'Mark as read'}
          />

          {pickingDate && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 100,
              background: 'white', border: '1px solid var(--border-color)',
              borderRadius: 8, padding: '12px 14px',
              boxShadow: '0 6px 20px rgba(0,0,0,0.13)',
              display: 'flex', flexDirection: 'column', gap: 10,
              minWidth: 220,
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-main)' }}>
                When did you finish reading?
              </span>
              <input
                type="date"
                value={dateValue}
                onChange={e => setDateValue(e.target.value)}
                style={{
                  padding: '5px 8px', borderRadius: 6, fontSize: 13,
                  border: '1px solid var(--border-color)', outline: 'none',
                  cursor: 'pointer',
                }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleConfirmDate}
                  style={{
                    flex: 1, padding: '5px 0', borderRadius: 6, fontSize: 12,
                    border: 'none', background: 'var(--accent-blue)', color: 'white',
                    fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Confirm
                </button>
                <button
                  onClick={handleCancelDate}
                  style={{
                    flex: 1, padding: '5px 0', borderRadius: 6, fontSize: 12,
                    border: '1px solid var(--border-color)', background: 'white',
                    color: 'var(--text-muted)', cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Title + read date subtext */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{
            fontSize: 14,
            fontWeight: 500,
            color: paper.is_read ? 'var(--text-muted)' : 'var(--text-main)',
            textDecoration: paper.is_read ? 'line-through' : 'none',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {paper.title}
          </span>
          {paper.is_read && readDate && (
            <span style={{ fontSize: 11, color: 'var(--accent-blue)', fontWeight: 500 }}>
              Read: {readDate}
            </span>
          )}
        </div>

        {/* Author */}
        <span style={{
          fontSize: 12, color: 'var(--text-muted)', flexShrink: 0,
          maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {authors}
        </span>

        {/* Year */}
        <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0, width: 36, textAlign: 'right' }}>
          {paper.year || '—'}
        </span>

        {/* Doc type */}
        <span style={{
          fontSize: 11, padding: '2px 8px', borderRadius: 999,
          background: '#f1f5f9', color: 'var(--text-muted)',
          flexShrink: 0, whiteSpace: 'nowrap',
        }}>
          {formatDocType(paper.document_type)}
        </span>

        {/* Chevron */}
        <span style={{ color: 'var(--text-muted)', fontSize: 12, flexShrink: 0 }}>
          {isExpanded ? '▲' : '▼'}
        </span>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div style={{ borderTop: '1px solid var(--border-color)', background: 'var(--bg-main)' }}>
          <PaperDetail paper={paper} onUpdate={onUpdate} />
        </div>
      )}
    </div>
  );
}