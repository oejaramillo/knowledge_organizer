// src/components/papers/PaperClaimsTab.jsx
import React, { useState, useEffect } from 'react';
import { CLAIM_TYPES, DIRECTION_OPTIONS, claimTypeStyle } from './paperUtils';

const API = 'http://localhost:8000';

const EMPTY_FORM = {
  claim_type: 'empirical',
  claim: '',
  quote: '',
  page_number: '',
  tags: '',
  // empirical fields
  direction: '',
  effect_size: '',
  population: '',
  period: '',
  confidence_level: '',
  // theoretical / conceptual
  logical_form: '',
  scope_conditions: '',
  // historical
  historical_period: '',
  geographic_scope: '',
};

export default function PaperClaimsTab({ paperId }) {
  const [claims, setClaims]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  useEffect(() => {
    fetch(`${API}/api/papers/${paperId}/claims`)
      .then(r => r.json())
      .then(data => { setClaims(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [paperId]);

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submitClaim = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.claim.trim()) { setError('Claim text is required.'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        page_number:      form.page_number ? parseInt(form.page_number) : null,
        confidence_level: form.confidence_level ? parseFloat(form.confidence_level) : null,
        tags:             form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      };
      const res = await fetch(`${API}/api/papers/${paperId}/claims`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to save');
      const created = await res.json();
      setClaims(prev => [created, ...prev]);
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch {
      setError('Could not save claim. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const deleteClaim = async (claimId) => {
    if (!window.confirm('Delete this claim?')) return;
    try {
      await fetch(`${API}/api/claims/${claimId}`, { method: 'DELETE' });
      setClaims(prev => prev.filter(c => c.claim_id !== claimId));
    } catch {
      alert('Could not delete claim.');
    }
  };

  const isEmpirical    = ['empirical'].includes(form.claim_type);
  const isTheoretical  = ['theoretical', 'conceptual'].includes(form.claim_type);
  const isHistorical   = ['historical'].includes(form.claim_type);

  if (loading) return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading claims…</p>;

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {claims.length} claim{claims.length !== 1 ? 's' : ''}
        </span>
        <button className="add-btn" onClick={() => setShowForm(v => !v)}>
          {showForm ? '✕ Cancel' : '+ Add claim'}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={submitClaim} style={{
          background: 'var(--bg-white)',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
          padding: 16,
          marginBottom: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          {error && <p style={{ color: '#ef4444', fontSize: 13, margin: 0 }}>{error}</p>}

          {/* Claim type */}
          <div>
            <label style={smallLabel}>Claim type</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {CLAIM_TYPES.map(ct => (
                <button
                  key={ct.value}
                  type="button"
                  onClick={() => setField('claim_type', ct.value)}
                  style={{
                    fontSize: 12, padding: '3px 12px', borderRadius: 999, cursor: 'pointer',
                    border: `1px solid ${form.claim_type === ct.value ? ct.color : 'var(--border-color)'}`,
                    background: form.claim_type === ct.value ? ct.color + '20' : 'transparent',
                    color: form.claim_type === ct.value ? ct.color : 'var(--text-muted)',
                    fontWeight: form.claim_type === ct.value ? 600 : 400,
                  }}
                >
                  {ct.label}
                </button>
              ))}
            </div>
          </div>

          {/* Claim text */}
          <div>
            <label style={smallLabel}>Claim *</label>
            <textarea
              className="form-input"
              rows={2}
              value={form.claim}
              onChange={e => setField('claim', e.target.value)}
              placeholder="One declarative sentence…"
              style={{ resize: 'vertical' }}
            />
          </div>

          {/* Quote + page */}
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 8 }}>
            <div>
              <label style={smallLabel}>Supporting quote</label>
              <input className="form-input" value={form.quote} onChange={e => setField('quote', e.target.value)} placeholder="Exact quote…" />
            </div>
            <div>
              <label style={smallLabel}>Page</label>
              <input className="form-input" type="number" value={form.page_number} onChange={e => setField('page_number', e.target.value)} placeholder="e.g. 42" />
            </div>
          </div>

          {/* Empirical-specific fields */}
          {isEmpirical && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={smallLabel}>Direction</label>
                <select className="form-input" value={form.direction} onChange={e => setField('direction', e.target.value)}>
                  <option value="">— select —</option>
                  {DIRECTION_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={smallLabel}>Effect size</label>
                <input className="form-input" value={form.effect_size} onChange={e => setField('effect_size', e.target.value)} placeholder="e.g. 10% increase" />
              </div>
              <div>
                <label style={smallLabel}>Population</label>
                <input className="form-input" value={form.population} onChange={e => setField('population', e.target.value)} placeholder="Who / where" />
              </div>
              <div>
                <label style={smallLabel}>Period</label>
                <input className="form-input" value={form.period} onChange={e => setField('period', e.target.value)} placeholder="e.g. 2000–2020" />
              </div>
              <div>
                <label style={smallLabel}>Confidence (0–1)</label>
                <input className="form-input" type="number" min="0" max="1" step="0.05" value={form.confidence_level} onChange={e => setField('confidence_level', e.target.value)} />
              </div>
            </div>
          )}

          {/* Theoretical / Conceptual fields */}
          {isTheoretical && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <label style={smallLabel}>Logical form</label>
                <input className="form-input" value={form.logical_form} onChange={e => setField('logical_form', e.target.value)} placeholder="If X then Y under condition Z" />
              </div>
              <div>
                <label style={smallLabel}>Scope conditions</label>
                <input className="form-input" value={form.scope_conditions} onChange={e => setField('scope_conditions', e.target.value)} placeholder="Boundary conditions / assumptions" />
              </div>
            </div>
          )}

          {/* Historical fields */}
          {isHistorical && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={smallLabel}>Historical period</label>
                <input className="form-input" value={form.historical_period} onChange={e => setField('historical_period', e.target.value)} placeholder="e.g. 1970–1982" />
              </div>
              <div>
                <label style={smallLabel}>Geographic scope</label>
                <input className="form-input" value={form.geographic_scope} onChange={e => setField('geographic_scope', e.target.value)} placeholder="e.g. Latin America" />
              </div>
            </div>
          )}

          {/* Tags */}
          <div>
            <label style={smallLabel}>Tags (comma-separated)</label>
            <input className="form-input" value={form.tags} onChange={e => setField('tags', e.target.value)} placeholder="e.g. wages, poverty, DiD" />
          </div>

          <button type="submit" className="action-btn action-btn--solid" disabled={saving} style={{ alignSelf: 'flex-start' }}>
            {saving ? 'Saving…' : 'Save claim'}
          </button>
        </form>
      )}

      {/* Claims list */}
      {claims.length === 0 ? (
        <p className="empty-state">No claims yet — add the first one.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {claims.map(c => {
            const typeStyle = claimTypeStyle(c.claim_type);
            return (
              <div key={c.claim_id} style={{
                border: '1px solid var(--border-color)',
                borderRadius: 8,
                padding: '12px 14px',
                background: 'var(--bg-white)',
                position: 'relative',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ ...typeStyle, fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 600 }}>
                    {c.claim_type}
                  </span>
                  {c.direction && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>→ {c.direction}</span>
                  )}
                  {c.page_number && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>p. {c.page_number}</span>
                  )}
                  <button onClick={() => deleteClaim(c.claim_id)} className="delete-btn" style={{ marginLeft: 'auto', fontSize: 14 }} title="Delete">✕</button>
                </div>

                <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 500 }}>{c.claim}</p>

                {c.quote && (
                  <blockquote style={{
                    margin: '6px 0', padding: '4px 10px',
                    borderLeft: '3px solid var(--border-color)',
                    fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic',
                  }}>
                    "{c.quote}"
                  </blockquote>
                )}

                {c.effect_size && <p style={metaLine}><strong>Effect:</strong> {c.effect_size}</p>}
                {c.population  && <p style={metaLine}><strong>Population:</strong> {c.population}</p>}
                {c.period      && <p style={metaLine}><strong>Period:</strong> {c.period}</p>}
                {c.logical_form && <p style={metaLine}><strong>Logical form:</strong> {c.logical_form}</p>}
                {c.historical_period && <p style={metaLine}><strong>Period:</strong> {c.historical_period} · {c.geographic_scope}</p>}

                {c.tags?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                    {c.tags.map(t => (
                      <span key={t} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: '#f1f5f9', color: 'var(--text-muted)' }}>
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const smallLabel = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: 'var(--text-muted)', textTransform: 'uppercase',
  letterSpacing: '0.04em', marginBottom: 3,
};

const metaLine = {
  margin: '3px 0', fontSize: 12, color: 'var(--text-muted)',
};