// src/components/summary/ActivityHeatmap.jsx
//
// GitHub-style calendar of reading activity. Columns are weeks (Monday first),
// rows are weekdays, and the intensity comes from the pages read that day.

import React from 'react';
import { formatDate } from '../../utils/date';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Fixed thresholds keep the scale meaningful over time: a light week should not
// look intense just because the whole month was light.
const LEVELS = [
  { max: 0,   color: '#eef2f7' },
  { max: 15,  color: '#bfdbfe' },
  { max: 35,  color: '#60a5fa' },
  { max: 70,  color: '#2563eb' },
  { max: Infinity, color: '#1e3a8a' },
];

function levelFor(pages, papers) {
  if (pages <= 0) return papers > 0 ? 1 : 0;   // marked read but no page count
  return LEVELS.findIndex(l => pages <= l.max);
}

export default function ActivityHeatmap({ days = [] }) {
  if (days.length === 0) {
    return <p className="empty-state">No reading activity recorded yet.</p>;
  }

  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const totalPages = days.reduce((sum, d) => sum + d.pages, 0);
  const activeDays = days.filter(d => d.pages > 0 || d.papers > 0).length;

  // One label per month, placed on the first column of that month.
  const monthLabels = weeks.map((week, index) => {
    const first = week[0];
    if (!first) return '';
    const previous = weeks[index - 1]?.[0];
    const month = first.date.slice(0, 7);
    if (previous && previous.date.slice(0, 7) === month) return '';
    return new Date(`${month}-01T00:00:00Z`).toLocaleString('en-GB', { month: 'short' });
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 12, fontSize: 12, color: 'var(--text-muted)' }}>
        <span><strong style={{ color: 'var(--text-main)' }}>{activeDays}</strong> active days</span>
        <span><strong style={{ color: 'var(--text-main)' }}>{totalPages.toLocaleString()}</strong> pages in 26 weeks</span>
      </div>

      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
        {/* Weekday gutter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingTop: 16, flexShrink: 0 }}>
          {WEEKDAYS.map((d, i) => (
            <div key={d} style={{ height: 11, fontSize: 9, color: 'var(--text-muted)', lineHeight: '11px' }}>
              {i % 2 === 0 ? d : ''}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 3 }}>
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ height: 13, fontSize: 9, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {monthLabels[wi]}
              </div>
              {week.map((day) => {
                const level = levelFor(day.pages, day.papers);
                return (
                  <div
                    key={day.date}
                    title={`${formatDate(day.date)} — ${day.papers} paper${day.papers === 1 ? '' : 's'}, ${day.pages} pages`}
                    style={{
                      width: 11, height: 11, borderRadius: 2,
                      background: LEVELS[level].color,
                      outline: '1px solid rgba(15,23,42,0.04)',
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 12, fontSize: 10, color: 'var(--text-muted)' }}>
        <span>less</span>
        {LEVELS.map((l, i) => (
          <span key={i} style={{ width: 11, height: 11, borderRadius: 2, background: l.color, outline: '1px solid rgba(15,23,42,0.04)' }} />
        ))}
        <span>more</span>
        <span style={{ marginLeft: 10 }}>· pages per day (15 / 35 / 70)</span>
      </div>
    </div>
  );
}
