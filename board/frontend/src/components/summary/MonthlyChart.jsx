// src/components/summary/MonthlyChart.jsx
//
// 12-month bar chart. Bars are plain divs (no charting dependency) and the last
// bucket is highlighted because it is the month currently in progress.

import React from 'react';

export default function MonthlyChart({
  data = [],
  color = 'var(--accent-blue)',
  valueKey = 'value',
  unit = '',
}) {
  if (data.length === 0) {
    return <p className="empty-state">Not enough data yet.</p>;
  }

  const values = data.map(d => Number(d[valueKey]) || 0);
  const max = Math.max(...values, 1);
  const total = values.reduce((a, b) => a + b, 0);
  const currentMonth = data[data.length - 1];
  const best = data[values.indexOf(max)];

  return (
    <div>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 14, fontSize: 12, color: 'var(--text-muted)' }}>
        <span>
          <strong style={{ color: 'var(--text-main)' }}>{total.toLocaleString()}</strong> {unit} in 12 months
        </span>
        <span>
          this month: <strong style={{ color: 'var(--text-main)' }}>{(currentMonth?.[valueKey] ?? 0).toLocaleString()}</strong>
        </span>
        <span>
          best: <strong style={{ color: 'var(--text-main)' }}>{best?.month}</strong> ({(best?.[valueKey] ?? 0).toLocaleString()})
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 130 }}>
        {data.map((d, i) => {
          const value = Number(d[valueKey]) || 0;
          const isCurrent = i === data.length - 1;
          const height = value === 0 ? 2 : Math.max(6, (value / max) * 96);
          return (
            <div
              key={d.month}
              title={`${d.month}: ${value.toLocaleString()} ${unit}`}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 }}
            >
              <span style={{ fontSize: 10, fontWeight: 600, color: isCurrent ? 'var(--accent-blue)' : 'var(--text-muted)' }}>
                {value > 0 ? value.toLocaleString() : ''}
              </span>
              <div style={{
                width: '100%',
                height,
                background: value === 0 ? 'var(--border-color)' : color,
                opacity: isCurrent ? 1 : 0.55,
                borderRadius: '3px 3px 0 0',
                transition: 'height 0.3s',
              }} />
              <span style={{
                fontSize: 9, whiteSpace: 'nowrap',
                color: isCurrent ? 'var(--accent-blue)' : 'var(--text-muted)',
                fontWeight: isCurrent ? 700 : 400,
              }}>
                {d.month}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
