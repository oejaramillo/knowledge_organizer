// src/components/summary/StatCard.jsx

import React from 'react';
import { percentChange } from '../../utils/date';

/**
 * Headline number with an optional period-over-period delta.
 *
 * `lowerIsBetter` flips the colour of a rising delta (e.g. an unread backlog).
 */
export default function StatCard({
  label,
  value,
  sub,
  current,
  previous,
  lowerIsBetter = false,
  accent = 'var(--accent-blue)',
}) {
  const delta = current != null && previous != null
    ? percentChange(current, previous)
    : null;

  const rising  = delta != null && delta > 0;
  const falling = delta != null && delta < 0;
  const good    = lowerIsBetter ? falling : rising;
  const bad     = lowerIsBetter ? rising : falling;
  const color   = good ? '#16a34a' : bad ? '#dc2626' : 'var(--text-muted)';

  return (
    <div style={{
      background: 'var(--bg-white)',
      border: '1px solid var(--border-color)',
      borderRadius: 10,
      padding: '16px 18px',
      flex: '1 1 170px',
      minWidth: 160,
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
        {label}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.1 }}>
          {value ?? '—'}
        </span>
        {delta != null && delta !== 0 && (
          <span style={{ fontSize: 12, fontWeight: 700, color }}>
            {rising ? '▲' : '▼'} {Math.abs(delta)}%
          </span>
        )}
        {delta === 0 && (
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>=</span>
        )}
      </div>

      {(sub || previous != null) && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {sub || `${previous} previous period`}
        </div>
      )}

      <div style={{ height: 3, borderRadius: 3, background: accent, opacity: 0.85, marginTop: 2 }} />
    </div>
  );
}
