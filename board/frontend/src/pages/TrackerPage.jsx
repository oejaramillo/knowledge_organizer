import React, { useEffect, useState } from 'react';
import apiClient from '../api/client';

function daysSince(dateStr) {
  if (!dateStr) return null;
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return `${diff}d ago`;
}

function staleness(dateStr) {
  if (!dateStr) return 'none';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
  if (diff <= 7)  return 'fresh';
  if (diff <= 30) return 'warm';
  return 'stale';
}

const STALE_COLORS = {
  fresh: '#10b981',
  warm:  '#f59e0b',
  stale: '#ef4444',
  none:  '#94a3b8',
};

// States: 'backlog' → 'upnext' → 'working' → 'backlog'
const NEXT_STATE = { backlog: 'upnext', upnext: 'working', working: 'backlog' };

const STATE_BUTTON = {
  backlog:  { label: 'Backlog',  bg: 'var(--bg-white)',   color: 'var(--text-muted)', border: '1px solid var(--border-color)' },
  upnext:   { label: 'Up Next',  bg: '#f1f5f9',           color: '#475569',           border: '1px solid #cbd5e1' },
  working:  { label: 'Working',  bg: 'var(--accent-blue)', color: '#fff',             border: '1px solid var(--accent-blue)' },
};

function loadState(key) {
  try { return new Map(JSON.parse(localStorage.getItem(key) || '[]')); }
  catch { return new Map(); }
}

export default function TrackerPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  // Map of project_id → 'backlog' | 'upnext' | 'working'
  const [states, setStates] = useState(() => loadState('tracker_states'));

  useEffect(() => {
    apiClient.get('/tracker/projects')
      .then(r => setProjects(r.data))
      .catch(() => setError('Failed to load projects'))
      .finally(() => setLoading(false));
  }, []);

  const cycle = (id) => {
    setStates(prev => {
      const current = prev.get(id) || 'backlog';
      const next = new Map(prev);
      next.set(id, NEXT_STATE[current]);
      localStorage.setItem('tracker_states', JSON.stringify([...next]));
      return next;
    });
  };

  const getState = (id) => states.get(id) || 'backlog';

  if (loading) return <div style={{ padding: 40, color: 'var(--text-muted)', fontSize: 14 }}>Loading tracker…</div>;
  if (error)   return <div style={{ padding: 40, color: '#ef4444', fontSize: 14 }}>{error}</div>;

  const working  = projects.filter(p => getState(p.project_id) === 'working');
  const upnext   = projects.filter(p => getState(p.project_id) === 'upnext');
  const backlog  = projects.filter(p => getState(p.project_id) === 'backlog');

  const ProjectRow = ({ p }) => {
    const state     = getState(p.project_id);
    const stale     = staleness(p.last_entry_date);
    const dotColor  = STALE_COLORS[stale];
    const btn       = STATE_BUTTON[state];

    return (
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 14,
        padding: '14px 0',
        borderBottom: '1px solid var(--border-color)',
        opacity: state === 'backlog' ? 0.65 : 1,
      }}>
        {/* staleness dot — only meaningful for prioritized */}
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: state === 'backlog' ? '#e2e8f0' : dotColor,
          flexShrink: 0, marginTop: 5,
        }} />

        {/* content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>
              {p.name}
            </span>
            {p.status && p.status !== 'active' && (
              <span style={{
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.05em', color: 'var(--text-muted)',
                border: '1px solid var(--border-color)',
                padding: '1px 6px', borderRadius: 4,
              }}>
                {p.status}
              </span>
            )}
          </div>

          {p.last_entry_date ? (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: p.last_entry_snippet ? 4 : 0 }}>
              Last entry:{' '}
              <span style={{ color: state === 'backlog' ? 'var(--text-muted)' : dotColor, fontWeight: 600 }}>
                {daysSince(p.last_entry_date)}
              </span>
              {p.last_entry_title && (
                <span style={{ marginLeft: 6 }}>— {p.last_entry_title}</span>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
              No binnacle entries yet
            </div>
          )}

          {p.last_entry_snippet && state !== 'backlog' && (
            <div style={{
              fontSize: 11, color: 'var(--text-muted)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              maxWidth: 580,
            }}>
              {p.last_entry_snippet}{p.last_entry_snippet.length >= 160 ? '…' : ''}
            </div>
          )}
        </div>

        {/* cycle button */}
        <button
          onClick={() => cycle(p.project_id)}
          title="Click to cycle: Backlog → Up Next → Working"
          style={{
            flexShrink: 0,
            padding: '5px 12px', fontSize: 11, fontWeight: 600,
            borderRadius: 6, cursor: 'pointer',
            border: btn.border,
            background: btn.bg,
            color: btn.color,
            transition: 'all 0.15s',
            minWidth: 76, textAlign: 'center',
          }}
        >
          {btn.label}
        </button>
      </div>
    );
  };

  const Section = ({ title, items, accent }) => (
    items.length === 0 ? null : (
      <div style={{
        background: 'var(--bg-white)',
        border: '1px solid var(--border-color)',
        borderRadius: 10, padding: '14px 20px', marginBottom: 16,
      }}>
        <div style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.08em', color: accent, marginBottom: 4,
        }}>
          {title} — {items.length}
        </div>
        {items.map(p => <ProjectRow key={p.project_id} p={p} />)}
      </div>
    )
  );

  return (
    <div style={{ padding: '28px 32px', maxWidth: 860 }}>

      {/* header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-main)' }}>
          Project Tracker
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
          Click the button on any project to cycle it: Backlog → Up Next → Working.
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
          {[
            { color: '#10b981', label: 'Active ≤ 7d' },
            { color: '#f59e0b', label: 'Warm ≤ 30d'  },
            { color: '#ef4444', label: 'Stale > 30d'  },
            { color: '#94a3b8', label: 'No entries'   },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
              {label}
            </div>
          ))}
        </div>
      </div>

      <Section title="Working Now"  items={working} accent="var(--accent-blue)" />
      <Section title="Up Next"      items={upnext}  accent="#475569" />

      {/* Backlog — collapsed by default if there are prioritized items */}
      {backlog.length > 0 && (
        <BacklogSection items={backlog} ProjectRow={ProjectRow} hasPrioritized={working.length + upnext.length > 0} />
      )}
    </div>
  );
}

function BacklogSection({ items, ProjectRow, hasPrioritized }) {
  const [open, setOpen] = useState(!hasPrioritized);

  return (
    <div style={{
      background: 'var(--bg-white)',
      border: '1px solid var(--border-color)',
      borderRadius: 10, overflow: 'hidden',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px', background: 'none', border: 'none',
          cursor: 'pointer',
        }}
      >
        <span style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.08em', color: 'var(--text-muted)',
        }}>
          Backlog — {items.length}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {open ? '▲ hide' : '▼ show'}
        </span>
      </button>

      {open && (
        <div style={{ padding: '0 20px 4px' }}>
          {items.map(p => <ProjectRow key={p.project_id} p={p} />)}
        </div>
      )}
    </div>
  );
}