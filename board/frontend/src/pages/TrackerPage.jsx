// pages/TrackerPage.jsx
//
// Project tracker: what am I working on, and what am I leaving behind?
//
// "Work" is any binnacle entry, meeting or reading. Nothing is stored manually:
// the project you are working on is simply the one with the most recent work,
// while the deliberate decision to set something aside lives in the project's
// own status ("paused"), so an intentional pause never looks like neglect.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/client';
import Sparkline from '../components/tracker/Sparkline';
import { formatDate, formatRelativeDays } from '../utils/date';

// Recency bands
const ACTIVE_DAYS = 14;
const COOLING_DAYS = 45;

const KIND_LABEL = {
  binnacle: 'binnacle entry',
  meeting: 'meeting',
  reading: 'reading',
};

const KIND_ICON = {
  binnacle: '📓',
  meeting: '👥',
  reading: '📖',
};

function heatColor(days) {
  if (days === null || days === undefined) return '#94a3b8';
  if (days <= 7) return '#10b981';
  if (days <= 30) return '#f59e0b';
  return '#ef4444';
}

function StatusBadge({ status }) {
  const map = {
    active:    { background: '#dcfce7', color: '#16a34a', label: 'active' },
    paused:    { background: '#fef9c3', color: '#ca8a04', label: 'on hold' },
    completed: { background: '#dbeafe', color: '#2563eb', label: 'completed' },
  };
  const style = map[status] || { background: '#f1f5f9', color: '#64748b', label: status };
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
      padding: '1px 7px', borderRadius: 999, background: style.background, color: style.color,
      whiteSpace: 'nowrap',
    }}>
      {style.label}
    </span>
  );
}

function WorkCounts({ counts, papersRead, papersTotal }) {
  return (
    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
      <span title="binnacle entries">📓 {counts.binnacle}</span>
      <span title="meetings">👥 {counts.meetings}</span>
      <span title="reading events">📖 {counts.readings}</span>
      <span title="papers read in this project">📄 {papersRead}/{papersTotal}</span>
    </div>
  );
}

export default function TrackerPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [busyId, setBusyId]     = useState(null);
  const [openGroups, setOpenGroups] = useState({ active: true, cooling: true, left: true, hold: true });

  const load = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/tracker/projects');
      setProjects(data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  const setStatus = async (projectId, status) => {
    setBusyId(projectId);
    try {
      await apiClient.patch(`/projects/${projectId}`, { status });
      await load();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Could not update the project');
    } finally {
      setBusyId(null);
    }
  };

  // ── grouping ──────────────────────────────────────────────────────────────
  const groups = useMemo(() => {
    const byRecency = (a, b) => (a.days_since ?? 1e6) - (b.days_since ?? 1e6);

    const onHold = projects.filter(p => p.status === 'paused').sort(byRecency);
    const working = projects
      .filter(p => p.status !== 'paused')
      .sort(byRecency);
    const workingNow = working.find(p => p.last_activity) || null;
    const rest = working.filter(p => p !== workingNow);

    return {
      workingNow,
      active:  rest.filter(p => p.days_since != null && p.days_since <= ACTIVE_DAYS),
      cooling: rest.filter(p => p.days_since != null && p.days_since > ACTIVE_DAYS && p.days_since <= COOLING_DAYS),
      left:    rest.filter(p => p.days_since == null || p.days_since > COOLING_DAYS),
      onHold,
    };
  }, [projects]);

  if (loading) {
    return <div style={{ padding: '28px 32px', color: 'var(--text-muted)', fontSize: 14 }}>Loading tracker…</div>;
  }

  if (error && projects.length === 0) {
    return (
      <div style={{ padding: '28px 32px' }}>
        <div style={{
          background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b',
          borderRadius: 10, padding: '14px 18px', fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ flex: 1 }}>⚠ {error}</span>
          <button className="action-btn" onClick={load} style={{ borderColor: '#fca5a5', color: '#991b1b' }}>Retry</button>
        </div>
      </div>
    );
  }

  const now = groups.workingNow;

  const ProjectRow = ({ p }) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 0', borderBottom: '1px solid var(--border-color)',
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: heatColor(p.days_since), flexShrink: 0 }} />

      <div style={{ flex: '1 1 220px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link to={`/projects/${p.project_id}`} style={{
            fontSize: 13, fontWeight: 600, color: 'var(--text-main)', textDecoration: 'none',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {p.name}
          </Link>
          {p.status !== 'active' && <StatusBadge status={p.status} />}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {p.last_activity
            ? <>last worked {formatRelativeDays(p.last_activity)} · {KIND_ICON[p.last_activity_kind]} {KIND_LABEL[p.last_activity_kind]}</>
            : 'no work recorded yet'}
        </div>
      </div>

      <Sparkline weeks={p.weekly} />

      <div style={{ flex: '0 0 190px', textAlign: 'right' }}>
        <WorkCounts counts={p.counts} papersRead={p.papers_read} papersTotal={p.papers_total} />
      </div>

      <button
        className="action-btn"
        disabled={busyId === p.project_id}
        onClick={() => setStatus(p.project_id, p.status === 'paused' ? 'active' : 'paused')}
        title={p.status === 'paused' ? 'Resume working on this project' : 'Set aside on purpose'}
        style={{ flexShrink: 0, minHeight: 28, padding: '3px 10px', fontSize: 11 }}
      >
        {p.status === 'paused' ? '▶ Resume' : '⏸ Hold'}
      </button>
    </div>
  );

  const Group = ({ title, hint, items, groupKey, accent }) => {
    if (items.length === 0) return null;
    const open = openGroups[groupKey];
    return (
      <div style={{ background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: 10, marginBottom: 14 }}>
        <button
          onClick={() => setOpenGroups(g => ({ ...g, [groupKey]: !g[groupKey] }))}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 18px', background: 'none', border: 'none',
            cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: accent, flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
            {title}
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, background: 'var(--border-color)', color: 'var(--text-muted)', borderRadius: 999, padding: '0 7px' }}>
            {items.length}
          </span>
          {hint && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{hint}</span>}
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
            {open ? '▲' : '▼'}
          </span>
        </button>
        {open && (
          <div style={{ padding: '0 18px 6px' }}>
            {items.map(p => <ProjectRow key={p.project_id} p={p} />)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1000 }}>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 22, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-main)' }}>Project Tracker</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
            Binnacle entries, meetings and readings count as work — the project you touched last is what you are working on.
          </div>
        </div>
        <button className="action-btn" onClick={load}>⟳ Refresh</button>
      </div>

      {error && (
        <div style={{
          background: '#fef3c7', border: '1px solid #fcd34d', color: '#92400e',
          borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12,
        }}>
          ⚠ {error}
        </div>
      )}

      {projects.length === 0 ? (
        <p className="empty-state">
          No research projects yet. Projects appear here once they are marked as “research”.
        </p>
      ) : (
        <>
          {/* ── WORKING NOW ────────────────────────────────────────────────── */}
          {now ? (
            <div style={{
              background: 'var(--bg-white)',
              border: '1px solid var(--accent-blue)',
              borderRadius: 12,
              padding: '20px 24px',
              marginBottom: 22,
              boxShadow: '0 4px 16px rgba(59,130,246,0.08)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: heatColor(now.days_since) }} />
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-blue)' }}>
                  Working now
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 320px', minWidth: 0 }}>
                  <Link to={`/projects/${now.project_id}`} style={{
                    fontSize: 20, fontWeight: 700, color: 'var(--text-main)', textDecoration: 'none',
                  }}>
                    {now.name}
                  </Link>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    Last worked {formatRelativeDays(now.last_activity)} ({formatDate(now.last_activity)}) ·{' '}
                    {KIND_ICON[now.last_activity_kind]} {KIND_LABEL[now.last_activity_kind]}
                  </div>

                  {now.last_note_snippet && (
                    <div style={{
                      marginTop: 12, padding: '10px 12px',
                      background: 'var(--bg-main)', borderRadius: 8,
                      borderLeft: '3px solid var(--accent-blue)',
                    }}>
                      {now.last_note_title && (
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-main)' }}>
                          {now.last_note_title}
                        </div>
                      )}
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55, marginTop: 2 }}>
                        {now.last_note_snippet}
                        {(now.last_note_snippet?.length ?? 0) >= 200 ? '…' : ''}
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-end' }}>
                  <Sparkline weeks={now.weekly} width={12} height={34} />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {now.work_7d} in the last 7 days · {now.work_30d} in 30
                  </div>
                  <WorkCounts counts={now.counts} papersRead={now.papers_read} papersTotal={now.papers_total} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Link to={`/projects/${now.project_id}`} className="action-btn" style={{ textDecoration: 'none' }}>
                      Open project →
                    </Link>
                    <button
                      className="action-btn"
                      disabled={busyId === now.project_id}
                      onClick={() => setStatus(now.project_id, 'paused')}
                      title="Set aside on purpose"
                    >
                      ⏸ Hold
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="empty-state" style={{ marginBottom: 22 }}>
              No work recorded on any research project yet — add a binnacle entry, a meeting or a reading.
            </p>
          )}

          {/* ── EVERYTHING ELSE ────────────────────────────────────────────── */}
          <Group
            title="Also active" groupKey="active" accent="#10b981"
            hint={`worked in the last ${ACTIVE_DAYS} days`}
            items={groups.active}
          />
          <Group
            title="Cooling off" groupKey="cooling" accent="#f59e0b"
            hint={`${ACTIVE_DAYS}–${COOLING_DAYS} days since the last work`}
            items={groups.cooling}
          />
          <Group
            title="On hold" groupKey="hold" accent="#ca8a04"
            hint="set aside on purpose"
            items={groups.onHold}
          />
          <Group
            title="Left behind" groupKey="left" accent="#ef4444"
            hint={`no work for ${COOLING_DAYS}+ days`}
            items={groups.left}
          />

          {/* ── LEGEND ─────────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
            {[
              { color: '#10b981', label: 'touched ≤ 7d' },
              { color: '#f59e0b', label: '≤ 30d' },
              { color: '#ef4444', label: '> 30d' },
              { color: '#94a3b8', label: 'never worked' },
            ].map(({ color, label }) => (
              <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
                {label}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
