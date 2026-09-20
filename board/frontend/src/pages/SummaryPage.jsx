// pages/SummaryPage.jsx
//
// Reading summary: a live view of what is being read, how much, and how the
// trend is moving. It refreshes on its own (see useReadingStats), so it always
// reflects the current state of the library.

import React, { useState } from 'react';
import useReadingStats, { AUTO_REFRESH_MS } from '../hooks/useReadingStats';
import StatCard from '../components/summary/StatCard';
import ActivityHeatmap from '../components/summary/ActivityHeatmap';
import MonthlyChart from '../components/summary/MonthlyChart';
import ReadingNow from '../components/summary/ReadingNow';
import { formatDate, formatRelativeDays } from '../utils/date';

// ── document type vocabulary (Zotero item types, camelCase) ──────────────────
const TYPE_LABELS = {
  journalArticle:   'Journal Article',
  book:             'Book',
  bookSection:      'Book Section',
  thesis:           'Thesis',
  conferencePaper:  'Conference Paper',
  presentation:     'Presentation',
  report:           'Report',
  preprint:         'Preprint',
  dataset:          'Dataset',
  webpage:          'Webpage',
  newspaperArticle: 'Newspaper Article',
  magazineArticle:  'Magazine Article',
  blogPost:         'Blog Post',
  manuscript:       'Manuscript',
  document:         'Document',
  letter:           'Letter',
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
  preprint:         '#14b8a6',
  dataset:          '#0ea5e9',
  webpage:          '#6b7280',
  newspaperArticle: '#f97316',
  magazineArticle:  '#fb923c',
  blogPost:         '#ec4899',
  manuscript:       '#84cc16',
  document:         '#64748b',
  letter:           '#a3a3a3',
  unknown:          '#d1d5db',
};

// ── small presentational helpers ─────────────────────────────────────────────
function Card({ children, style }) {
  return (
    <div style={{
      background: 'var(--bg-white)',
      border: '1px solid var(--border-color)',
      borderRadius: 10,
      padding: '18px 22px',
      ...style,
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ children, right }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 12, marginBottom: 14,
    }}>
      <span style={{
        fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.08em', color: 'var(--text-muted)',
      }}>
        {children}
      </span>
      {right}
    </div>
  );
}

function SegmentedControl({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', border: '1px solid var(--border-color)', borderRadius: 6, overflow: 'hidden' }}>
      {options.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          style={{
            padding: '4px 10px', fontSize: 11, fontWeight: 600,
            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            background: value === key ? 'var(--accent-blue)' : 'var(--bg-white)',
            color: value === key ? '#fff' : 'var(--text-muted)',
            transition: 'all 0.15s',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default function SummaryPage() {
  const { stats, error, loading, refreshing, updatedAt, refresh } = useReadingStats();
  const [typePeriod, setTypePeriod] = useState('month');
  const [metric, setMetric] = useState('papers');

  // ── loading / error shells ────────────────────────────────────────────────
  if (loading && !stats) {
    return (
      <div style={{ padding: '28px 32px', color: 'var(--text-muted)', fontSize: 14 }}>
        Loading reading summary…
      </div>
    );
  }

  if (!stats) {
    return (
      <div style={{ padding: '28px 32px' }}>
        <div style={{
          background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b',
          borderRadius: 10, padding: '14px 18px', fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ flex: 1 }}>⚠ {error || 'Could not load the reading summary.'}</span>
          <button className="action-btn" onClick={refresh} style={{ borderColor: '#fca5a5', color: '#991b1b' }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const {
    total_papers, total_read, month_read, last_month_read, year_read, backlog_unread,
    pages_total, pages_this_month, pages_last_month, pages_this_year,
    monthly_trend, monthly_pages, daily_activity, streak,
    currently_reading, projects, last_read, top_authors,
  } = stats;

  const readPct = total_papers > 0 ? Math.round((total_read / total_papers) * 100) : 0;
  const pagesPerRead = total_read > 0 ? Math.round(pages_total / total_read) : 0;
  const maxAuthorRead = Math.max(...top_authors.map(a => a.read_count), 1);

  const typeData = typePeriod === 'month'      ? stats.by_type_month
                 : typePeriod === 'last_month' ? stats.by_type_last_month
                 : stats.by_type_year;
  const maxType = Math.max(...typeData.map(t => t.read_count), 1);

  const chartData = metric === 'papers'
    ? monthly_trend
    : monthly_pages.map(m => ({ month: m.month, value: m.pages }));

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1120 }}>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-main)' }}>
            Reading Summary
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
            What you are reading, how much, and how it is trending.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            title={`Refreshes every ${Math.round(AUTO_REFRESH_MS / 1000)}s, and when this tab regains focus`}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}
          >
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: error ? 'var(--danger)' : '#22c55e',
              boxShadow: error ? 'none' : '0 0 0 3px rgba(34,197,94,0.18)',
            }} />
            live
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {refreshing
              ? 'updating…'
              : updatedAt
                ? `updated ${updatedAt.toLocaleTimeString('en-GB')}`
                : ''}
          </span>
          <button className="action-btn" onClick={refresh} disabled={refreshing}>
            ⟳ Refresh
          </button>
        </div>
      </div>

      {/* A refresh failure keeps the last snapshot visible, with a warning. */}
      {error && (
        <div style={{
          background: '#fef3c7', border: '1px solid #fcd34d', color: '#92400e',
          borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: 12,
        }}>
          ⚠ Showing the last successful update — refresh failed: {error}
        </div>
      )}

      {/* ── RIGHT NOW ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24, alignItems: 'stretch' }}>
        <Card style={{ flex: '0 1 260px', minWidth: 240, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <SectionTitle>Pulse</SectionTitle>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 30, fontWeight: 700, color: 'var(--text-main)', lineHeight: 1 }}>
              {streak.current}
            </span>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              day{streak.current === 1 ? '' : 's'} in a row
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: -8 }}>
            🔥 longest streak {streak.longest}d · {streak.active_days} active days total
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Last finished</div>
            {last_read.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nothing marked as read yet.</div>
            ) : (
              <>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.4 }}>
                  {last_read[0].title}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {formatDate(last_read[0].date_read)} · {formatRelativeDays(last_read[0].date_read)}
                </div>
              </>
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 12, display: 'flex', gap: 16 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-main)' }}>{backlog_unread}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>unread</div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-main)' }}>{pagesPerRead || '—'}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>pages / paper</div>
            </div>
          </div>
        </Card>

        <Card style={{ flex: '1 1 420px', minWidth: 300 }}>
          <SectionTitle
            right={<span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{currently_reading.length} in progress</span>}
          >
            In progress now
          </SectionTitle>
          <ReadingNow items={currently_reading} />
        </Card>
      </div>

      {/* ── HEADLINE NUMBERS ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <StatCard
          label="Read this month"
          value={month_read}
          current={month_read}
          previous={last_month_read}
          sub={`${last_month_read} last month`}
        />
        <StatCard
          label="Pages this month"
          value={pages_this_month.toLocaleString()}
          current={pages_this_month}
          previous={pages_last_month}
          sub={`${pages_last_month.toLocaleString()} last month`}
          accent="#8b5cf6"
        />
        <StatCard
          label="Read this year"
          value={year_read}
          sub={`${pages_this_year.toLocaleString()} pages`}
        />
        <StatCard
          label="Library progress"
          value={`${readPct}%`}
          sub={`${total_read} of ${total_papers} read`}
          accent="#10b981"
        />
        <StatCard
          label="Backlog"
          value={backlog_unread}
          sub="marked unread"
          accent="#f59e0b"
        />
      </div>

      {/* ── ACTIVITY HEATMAP ───────────────────────────────────────────────── */}
      <Card style={{ marginBottom: 24 }}>
        <SectionTitle right={<span style={{ fontSize: 11, color: 'var(--text-muted)' }}>last 26 weeks</span>}>
          Reading activity
        </SectionTitle>
        <ActivityHeatmap days={daily_activity} />
      </Card>

      {/* ── MONTHLY TREND ──────────────────────────────────────────────────── */}
      <Card style={{ marginBottom: 24 }}>
        <SectionTitle
          right={
            <SegmentedControl
              value={metric}
              onChange={setMetric}
              options={[{ key: 'papers', label: 'Papers' }, { key: 'pages', label: 'Pages' }]}
            />
          }
        >
          Monthly trend
        </SectionTitle>
        <MonthlyChart
          data={chartData}
          valueKey={metric === 'papers' ? 'count' : 'value'}
          unit={metric}
          color={metric === 'papers' ? 'var(--accent-blue)' : '#8b5cf6'}
        />
      </Card>

      {/* ── BY TYPE + AUTHORS ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <Card style={{ flex: '1 1 320px', minWidth: 280 }}>
          <SectionTitle
            right={
              <SegmentedControl
                value={typePeriod}
                onChange={setTypePeriod}
                options={[
                  { key: 'month', label: 'Month' },
                  { key: 'last_month', label: 'Prev' },
                  { key: 'year', label: 'Year' },
                ]}
              />
            }
          >
            By document type
          </SectionTitle>

          {typeData.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No readings in this period.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {typeData.map(t => (
                <div key={t.document_type}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-main)' }}>
                      {TYPE_LABELS[t.document_type] || t.document_type}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.read_count}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: 'var(--border-color)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${(t.read_count / maxType) * 100}%`,
                      background: TYPE_COLORS[t.document_type] || '#94a3b8',
                      borderRadius: 3,
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card style={{ flex: '1 1 320px', minWidth: 280 }}>
          <SectionTitle right={<span style={{ fontSize: 11, color: 'var(--text-muted)' }}>by papers read</span>}>
            Most read authors
          </SectionTitle>
          {top_authors.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No data yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {top_authors.map((a, i) => (
                <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', width: 16, textAlign: 'right', flexShrink: 0 }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {a.name}
                    </div>
                    <div style={{ height: 4, borderRadius: 2, marginTop: 3, background: '#3b82f6', width: `${(a.read_count / maxAuthorRead) * 100}%`, minWidth: a.read_count > 0 ? 8 : 0 }} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>
                    {a.read_count}<span style={{ opacity: 0.6 }}>/{a.count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ── PROJECTS ───────────────────────────────────────────────────────── */}
      <Card style={{ marginBottom: 24 }}>
        <SectionTitle right={<span style={{ fontSize: 11, color: 'var(--text-muted)' }}>top 8 by papers read</span>}>
          Where the reading happens
        </SectionTitle>
        {projects.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No project has papers yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {projects.map(p => {
              const pct = p.total_papers > 0 ? Math.round((p.read_papers / p.total_papers) * 100) : 0;
              return (
                <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ flex: '0 1 220px', fontSize: 12, fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name}
                  </span>
                  <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--border-color)', overflow: 'hidden', minWidth: 80 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent-blue)', borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, width: 132, textAlign: 'right' }}>
                    {p.read_papers}/{p.total_papers} · {p.pages_read.toLocaleString()} pp
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ── RECENTLY READ ──────────────────────────────────────────────────── */}
      <Card>
        <SectionTitle right={<span style={{ fontSize: 11, color: 'var(--text-muted)' }}>last 10</span>}>
          Recently read
        </SectionTitle>
        {last_read.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No papers marked as read yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {last_read.map((p, i) => (
              <div key={p.paper_id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 0',
                borderBottom: i < last_read.length - 1 ? '1px solid var(--border-color)' : 'none',
              }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                  color: '#fff', background: TYPE_COLORS[p.document_type] || '#94a3b8',
                  padding: '2px 7px', borderRadius: 4, flexShrink: 0,
                }}>
                  {TYPE_LABELS[p.document_type] || p.document_type || '?'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.title}
                  </div>
                  {p.projects && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      📁 {p.projects}
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{p.year || '—'}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, width: 92, textAlign: 'right' }}>
                  {formatDate(p.date_read)}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, width: 62, textAlign: 'right' }}>
                  {formatRelativeDays(p.date_read)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
