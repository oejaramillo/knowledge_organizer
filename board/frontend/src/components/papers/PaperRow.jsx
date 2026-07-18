// src/components/papers/PaperRow.jsx
import React from 'react';
import PaperDetail from './PaperDetail';
import { formatAuthors, formatDocType, statusBadgeStyle } from './paperUtils';

const API = 'http://localhost:8000';

export default function PaperRow({ paper, isExpanded, onToggleExpand, onUpdate }) {
  const authors = formatAuthors(paper.authors);

  const toggleRead = async (e) => {
    e.stopPropagation();
    const newVal = !paper.is_read;
    onUpdate(paper.paper_id, { is_read: newVal });
    try {
      await fetch(`${API}/api/papers/${paper.paper_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read: newVal }),
      });
    } catch {
      // revert on error
      onUpdate(paper.paper_id, { is_read: !newVal });
    }
  };

  const badgeStyle = statusBadgeStyle(paper.status);

  return (
    <div
      style={{
        border: '1px solid var(--border-color)',
        borderRadius: 8,
        overflow: 'hidden',
        background: 'var(--bg-white)',
        transition: 'box-shadow 0.15s',
        boxShadow: isExpanded ? '0 2px 10px rgba(0,0,0,0.07)' : 'none',
      }}
    >
      {/* Row header — always visible */}
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
        {/* Read checkbox */}
        <input
          type="checkbox"
          checked={paper.is_read}
          onChange={toggleRead}
          onClick={e => e.stopPropagation()}
          style={{ cursor: 'pointer', accentColor: 'var(--accent-blue)', flexShrink: 0 }}
          title={paper.is_read ? 'Mark as unread' : 'Mark as read'}
        />

        {/* Title */}
        <span style={{
          flex: 1,
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

        {/* Author */}
        <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {authors}
        </span>

        {/* Year */}
        <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0, width: 36, textAlign: 'right' }}>
          {paper.year || '—'}
        </span>

        {/* Doc type */}
        <span style={{
          fontSize: 11,
          padding: '2px 8px',
          borderRadius: 999,
          background: '#f1f5f9',
          color: 'var(--text-muted)',
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}>
          {formatDocType(paper.document_type)}
        </span>

        {/* Status badge */}
        <span style={{
          ...badgeStyle,
          fontSize: 11,
          padding: '2px 8px',
          borderRadius: 999,
          fontWeight: 600,
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}>
          {paper.status}
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