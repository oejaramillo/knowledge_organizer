// src/components/papers/PaperList.jsx
import React, { useState, useMemo } from 'react';
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
  }, [localPapers, search, filterStatus, filterType, filterRead, sortBy]);

  const readCount  = localPapers.filter(p => p.is_read).length;
  const totalCount = localPapers.length;

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