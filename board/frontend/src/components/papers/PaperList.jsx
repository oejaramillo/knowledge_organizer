// src/components/papers/PaperList.jsx
import React, { useState, useMemo, useCallback } from 'react';
import PaperRow from './PaperRow';
import { STATUS_OPTIONS, DOCUMENT_TYPES } from './paperUtils';

export default function PaperList({ paperAssociations = [] }) {
  const [search, setSearch]         = useState('');
  const [filterStatus, setStatus]   = useState('');
  const [filterType, setType]       = useState('');
  const [filterRead, setRead]       = useState('');   // '', 'read', 'unread'
  const [sortBy, setSortBy]         = useState('year_desc');
  const [expandedId, setExpandedId] = useState(null);

  // Local paper state so inline toggles are instant
  const [localPapers, setLocalPapers] = useState(() =>
    paperAssociations.map(a => ({ ...a.paper, _assoc: a }))
  );

  const handlePaperUpdate = (paperId, patch) => {
    setLocalPapers(prev =>
      prev.map(p => p.paper_id === paperId ? { ...p, ...patch } : p)
    );
  };

  const filtered = useMemo(() => {
    let list = [...localPapers];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.title?.toLowerCase().includes(q) ||
        p.journal?.toLowerCase().includes(q) ||
        p.theoretical_framework?.toLowerCase().includes(q)
      );
    }
    if (filterType)   list = list.filter(p => p.document_type === filterType);
    if (filterRead === 'read')   list = list.filter(p => p.is_read);
    if (filterRead === 'unread') list = list.filter(p => !p.is_read);

    list.sort((a, b) => {
      if (sortBy === 'year_desc') return (b.year || 0) - (a.year || 0);
      if (sortBy === 'year_asc')  return (a.year || 0) - (b.year || 0);
      if (sortBy === 'title')     return (a.title || '').localeCompare(b.title || '');
      return 0;
    });

    return list;
  }, [localPapers, search, filterType, filterRead, sortBy]);

  const readCount  = localPapers.filter(p => p.is_read).length;
  const totalCount = localPapers.length;

  const [recommendationSeed, setRecommendationSeed] = useState(0);

  const unreadPapers = useMemo(() => localPapers.filter(p => !p.is_read), [localPapers]);

  const recommendedPaper = useMemo(() => {
    if (unreadPapers.length === 0) return null;
    const idx = Math.floor(Math.random() * unreadPapers.length);
    return unreadPapers[idx];
  }, [unreadPapers, recommendationSeed]); // ← seed triggers a new pick


  return (
    <div className="section-panel">
      {/* Header */}
      <div className="section-panel__header">
        <h3>
          Papers
          <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8, fontSize: 13 }}>
            {readCount}/{totalCount} read
          </span>
        </h3>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {filtered.length} showing
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: '#e2e8f0', borderRadius: 2, marginBottom: 16 }}>
        <div style={{
          height: '100%',
          width: totalCount ? `${(readCount / totalCount) * 100}%` : '0%',
          background: 'var(--accent-blue)',
          borderRadius: 2,
          transition: 'width 0.3s',
        }} />
      </div>

      {/* Paper recommendation */}
      {recommendedPaper && (
        <div style={{
          marginBottom: 16,
          padding: '12px 14px',
          background: 'var(--accent-bg)',
          border: '1px solid var(--accent-blue)',
          borderRadius: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              📖 Next read:
            </span>
            <button
              onClick={() => setRecommendationSeed(s => s + 1)}
              style={{ fontSize: 11, padding: '2px 10px', borderRadius: 6, border: '1px solid var(--accent-blue)', background: 'none', color: 'var(--accent-blue)', cursor: 'pointer' }}
            >
              🔀 Shuffle
            </button>
          </div>

          {/* Simple summary row — no expand, no actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-main)', lineHeight: 1.4 }}>
              {recommendedPaper.title}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {recommendedPaper.authors?.length > 0 && (
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {recommendedPaper.authors.slice(0, 2).map(a => a.last_name).join(', ')}
                  {recommendedPaper.authors.length > 2 ? ' et al.' : ''}
                </span>
              )}
              {recommendedPaper.year && (
                <>
                  <span style={{ fontSize: 12, color: 'var(--border-color)' }}>·</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {recommendedPaper.year}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <input
          className="form-input"
          style={{ flex: '1 1 180px', minWidth: 0 }}
          placeholder="Search title, journal, framework…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="form-input"
          style={{ flex: '0 1 130px' }}
          value={filterType}
          onChange={e => setType(e.target.value)}
        >
          <option value="">All types</option>
          {DOCUMENT_TYPES.map(t => (
            <option key={t} value={t}>{t.replace('_', ' ')}</option>
          ))}
        </select>
        <select
          className="form-input"
          style={{ flex: '0 1 120px' }}
          value={filterRead}
          onChange={e => setRead(e.target.value)}
        >
          <option value="">Read + Unread</option>
          <option value="read">Read only</option>
          <option value="unread">Unread only</option>
        </select>
        <select
          className="form-input"
          style={{ flex: '0 1 130px' }}
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
        >
          <option value="year_desc">Year ↓</option>
          <option value="year_asc">Year ↑</option>
          <option value="title">Title A–Z</option>
          <option value="status">Status</option>
        </select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <p className="empty-state">No papers match your filters.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map(paper => (
            <PaperRow
              key={paper.paper_id}
              paper={paper}
              isExpanded={expandedId === paper.paper_id}
              onToggleExpand={() =>
                setExpandedId(prev => prev === paper.paper_id ? null : paper.paper_id)
              }
              onUpdate={handlePaperUpdate}
            />
          ))}
        </div>
      )}
    </div>
  );
}   