// src/components/summary/ReadingNow.jsx
//
// "What am I reading right now" — papers that have at least one chapter marked
// read but are not finished, newest activity first.

import React from 'react';
import { formatRelativeDays } from '../../utils/date';

export default function ReadingNow({ items = [] }) {
  if (items.length === 0) {
    return (
      <p className="empty-state" style={{ margin: 0 }}>
        Nothing in progress. Papers with chapters marked as read appear here.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map(item => {
        const percent = item.total_parts
          ? Math.round((item.parts_read / item.total_parts) * 100)
          : 0;
        const pages = item.part_pages || item.pages_read || 0;

        return (
          <div key={item.paper_id}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{
                flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text-main)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {item.title}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                {formatRelativeDays(item.last_activity)}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
              <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--border-color)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${percent}%`,
                  background: percent === 100 ? 'var(--success)' : 'var(--accent-blue)',
                  borderRadius: 999, transition: 'width 0.3s',
                }} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                {item.parts_read}/{item.total_parts} parts · {pages.toLocaleString()} pp
              </span>
            </div>

            {item.projects && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                📁 {item.projects}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
