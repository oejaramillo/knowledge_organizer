// src/components/tracker/Sparkline.jsx
//
// Eight weekly bars showing how much work a project received. It makes the
// "worked on it one week, not the next" rhythm visible at a glance.

import React from 'react';

export default function Sparkline({ weeks = [], width = 8, height = 22, color = 'var(--accent-blue)' }) {
  if (weeks.length === 0) return null;

  const max = Math.max(...weeks.map(w => w.count), 1);
  const currentWeek = weeks[weeks.length - 1]?.week;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height }} title="work events per week (last 8 weeks)">
      {weeks.map(w => (
        <div
          key={w.week}
          title={`week of ${w.week}: ${w.count} work event${w.count === 1 ? '' : 's'}`}
          style={{
            width,
            height: w.count === 0 ? 2 : Math.max(4, (w.count / max) * height),
            background: w.count === 0
              ? 'var(--border-color)'
              : w.week === currentWeek ? color : `${color}99`,
            borderRadius: 2,
          }}
        />
      ))}
    </div>
  );
}
