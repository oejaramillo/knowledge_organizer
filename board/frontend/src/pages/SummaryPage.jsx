// pages/SummaryPage.jsx
import React, { useEffect, useState } from 'react';
import apiClient from '../api/client';



const TYPE_LABELS = {
  journalArticle:   'Journal Article',
  book:             'Book',
  bookSection:      'Book Section',
  thesis:           'Thesis',
  conferencePaper:  'Conference Paper',
  presentation:     'Presentation',
  report:           'Report',
  webpage:          'Webpage',
  newspaperArticle: 'Newspaper Article',
  blogPost:         'Blog Post',
  manuscript:       'Manuscript',
  unknown:          'Other',
};

const TYPE_COLORS = {
  journalArticle:   '#3b82f6',
  book:             '#8b5cf6',
  bookSection:      '#a78bfa',
  thesis:           '#06b6d4',
  conferencePaper:  '#10b981',
  presentation:     '#f59e0b',
  report:           '#ef4444',
  webpage:          '#6b7280',
  newspaperArticle: '#f97316',
  blogPost:         '#ec4899',
  manuscript:       '#84cc16',
  unknown:          '#d1d5db',
};

function StatCard({ label, value, sub }) {
  return (
    <div style={{
      background: 'var(--bg-white)',
      border: '1px solid var(--border-color)',
      borderRadius: 10, padding: '18px 22px',
      flex: 1, minWidth: 140,
    }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-main)', lineHeight: 1 }}>
        {value ?? '—'}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginTop: 4 }}>
        {label}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>
      )}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.08em', color: 'var(--text-muted)',
      marginBottom: 12,
    }}>
      {children}
    </div>
  );
}

export default function SummaryPage() {
  const [typePeriod, setTypePeriod] = useState('month');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiClient.get('/stats/')
      .then(r => setStats(r.data))
      .catch(() => setError('Failed to load stats'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ padding: 40, color: 'var(--text-muted)', fontSize: 14 }}>
      Loading summary…
    </div>
  );

  if (error) return (
    <div style={{ padding: 40, color: '#ef4444', fontSize: 14 }}>{error}</div>
  );

  const { total_papers, total_read, month_read, year_read,
          last_read, by_type, top_authors, monthly_trend } = stats;

  const readPct = total_papers > 0
    ? Math.round((total_read / total_papers) * 100)
    : 0;

  // Max for bar scaling
  const maxType   = Math.max(...by_type.map(t => t.total_count), 1);
  const maxAuthor = Math.max(...top_authors.map(a => a.count), 1);
  const maxMonth  = Math.max(...monthly_trend.map(m => m.count), 1);

  return (
    <div style={{ padding: '28px 32px', maxWidth: 900 }}>

      {/* ── HEADER ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-main)' }}>
          Reading Summary
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
          An overview of your reading activity across the library.
        </div>
      </div>

      {/* ── STAT CARDS ── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 32 }}>
        <StatCard label="Total in Library"  value={total_papers} />
        <StatCard
          label="Total Read"
          value={total_read}
          sub={`${readPct}% of library`}
        />
        <StatCard label="Read This Month" value={month_read} />
        <StatCard label="Read This Year"  value={year_read} />
      </div>

      {/* ── MONTHLY TREND ── */}
      {monthly_trend.length > 0 && (
        <div style={{
          background: 'var(--bg-white)',
          border: '1px solid var(--border-color)',
          borderRadius: 10, padding: '18px 22px', marginBottom: 24,
        }}>
          <SectionTitle>Monthly Readings (Last 12 Months)</SectionTitle>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
            {monthly_trend.map((m, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>
                  {m.count}
                </div>
                <div style={{
                  width: '100%',
                  height: Math.max(4, (m.count / maxMonth) * 56),
                  background: '#3b82f6',
                  borderRadius: '3px 3px 0 0',
                  transition: 'height 0.3s',
                }} />
                <div style={{ fontSize: 9, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {m.month}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── BY TYPE + TOP AUTHORS ── */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 24, flexWrap: 'wrap' }}>

        {/* Document Types */}
        <div style={{
        background: 'var(--bg-white)',
        border: '1px solid var(--border-color)',
        borderRadius: 10, padding: '18px 22px', flex: 1, minWidth: 260,
        }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <SectionTitle>By Document Type</SectionTitle>
            <div style={{ display: 'flex', border: '1px solid var(--border-color)', borderRadius: 6, overflow: 'hidden' }}>
            {[
                { key: 'month',      label: 'This month' },
                { key: 'last_month', label: 'Last month' },
                { key: 'year',       label: 'This year'  },
            ].map(({ key, label }) => (
                <button
                key={key}
                onClick={() => setTypePeriod(key)}
                style={{
                    padding: '4px 10px', fontSize: 11, fontWeight: 600,
                    border: 'none', cursor: 'pointer',
                    background: typePeriod === key ? 'var(--accent-blue)' : 'var(--bg-white)',
                    color:      typePeriod === key ? '#fff' : 'var(--text-muted)',
                    transition: 'all 0.15s',
                }}
                >
                {label}
                </button>
            ))}
            </div>
        </div>

        {(() => {
            const data = typePeriod === 'month'      ? stats.by_type_month
                    : typePeriod === 'last_month' ? stats.by_type_last_month
                    : stats.by_type_year;
            const maxVal = Math.max(...data.map(t => t.read_count), 1);

            return data.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No readings in this period.</div>
            ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {data.map((t, i) => (
                <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-main)' }}>
                        {TYPE_LABELS[t.document_type] || t.document_type}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {t.read_count}
                    </span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: 'var(--border-color)', overflow: 'hidden' }}>
                    <div style={{
                        height: '100%',
                        width: `${(t.read_count / maxVal) * 100}%`,
                        background: TYPE_COLORS[t.document_type] || '#94a3b8',
                        borderRadius: 3,
                    }} />
                    </div>
                </div>
                ))}
            </div>
            );
        })()}
        </div>

        {/* Top Authors */}
        <div style={{
          background: 'var(--bg-white)',
          border: '1px solid var(--border-color)',
          borderRadius: 10, padding: '18px 22px', flex: 1, minWidth: 260,
        }}>
          <SectionTitle>Most Read Authors</SectionTitle>
          {top_authors.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No data yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {top_authors.map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                    width: 16, textAlign: 'right', flexShrink: 0,
                  }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 12, fontWeight: 600, color: 'var(--text-main)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {a.name}
                    </div>
                    <div style={{
                      height: 4, borderRadius: 2, marginTop: 3,
                      background: '#3b82f6',
                      width: `${(a.count / maxAuthor) * 100}%`,
                      minWidth: 8,
                    }} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>
                    {a.count}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── RECENTLY READ ── */}
      <div style={{
        background: 'var(--bg-white)',
        border: '1px solid var(--border-color)',
        borderRadius: 10, padding: '18px 22px',
      }}>
        <SectionTitle>Recently Read</SectionTitle>
        {last_read.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No papers marked as read yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {last_read.map((p, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 0',
                borderBottom: i < last_read.length - 1 ? '1px solid var(--border-color)' : 'none',
              }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.05em', color: '#fff',
                  background: TYPE_COLORS[p.document_type] || '#94a3b8',
                  padding: '2px 7px', borderRadius: 4, flexShrink: 0,
                }}>
                  {TYPE_LABELS[p.document_type] || p.document_type || '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600, color: 'var(--text-main)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {p.title}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>
                  {p.year || '—'}
                </div>
                {p.date_read && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                    {p.date_read}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}