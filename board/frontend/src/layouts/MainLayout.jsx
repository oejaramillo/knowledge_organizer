import { Outlet } from 'react-router-dom'
import { useState } from 'react'
import ProjectTreeNav from '../components/projects/ProjectTreeNav';
import apiClient from '../api/client';

const PROVIDERS = ['', 'deepseek'];

export default function MainLayout({ projectType, onToggle }) {
  const [runningZotero, setRunningZotero] = useState(false);
  const [runningAI, setRunningAI]         = useState(false);
  const [showAIModal, setShowAIModal]     = useState(false);
  const [toast, setToast]                 = useState(null);
  const [aiOpts, setAIOpts] = useState({
    full_text: false,
    force: false,
    dry_run: false,
    key: '',
    provider: '',
  });

  const showToast = (msg, ok) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 5000);
  };

  const runZotero = async () => {
    setRunningZotero(true);
    try {
      const { data } = await apiClient.post('/tools/zotero-sync');
      showToast(data.ok ? '✅ Zotero sync completed' : `❌ Sync failed: ${data.error}`, data.ok);
    } catch { showToast('❌ Zotero sync error', false); }
    finally { setRunningZotero(false); }
  };

  const runAI = async () => {
    setShowAIModal(false);
    setRunningAI(true);
    try {
      const { data } = await apiClient.post('/tools/ai-enrichment', {
        full_text: aiOpts.full_text,
        force:     aiOpts.force,
        dry_run:   aiOpts.dry_run,
        key:       aiOpts.key || null,
        provider:  aiOpts.provider || null,
      });
      showToast(data.ok ? '✅ AI enrichment completed' : `❌ Enrichment failed: ${data.error}`, data.ok);
    } catch { showToast('❌ AI enrichment error', false); }
    finally { setRunningAI(false); }
  };

  const opt = (field) => ({
    checked: aiOpts[field],
    onChange: e => setAIOpts(p => ({ ...p, [field]: e.target.checked })),
  });

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">

      {/* Left pane */}
      <aside className="w-64 border-r border-slate-200 flex flex-col overflow-y-auto">
        {/* Toggle */}
        <div style={{ display: 'flex', gap: 6, padding: '10px 12px', borderBottom: '1px solid var(--border-color)' }}>
          {['research', 'collection'].map(type => (
            <button key={type} onClick={() => onToggle(type)} style={{
              flex: 1, padding: '5px 14px', fontSize: 12, fontWeight: 600,
              borderRadius: 999, border: '1px solid var(--border-color)', cursor: 'pointer',
              background: projectType === type ? 'var(--accent-blue)' : 'var(--bg-white)',
              color:      projectType === type ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.15s', textTransform: 'capitalize',
            }}>
              {type}
            </button>
          ))}
        </div>

        {/* Project tree */}
        <div style={{ padding: '12px 16px 4px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
          Projects
        </div>
        <ProjectTreeNav projectType={projectType} />

        {/* Tool buttons */}
        <div style={{ marginTop: 'auto', padding: '12px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 2 }}>
            Tools
          </div>
          <button disabled={runningZotero} onClick={runZotero} style={{
            padding: '7px 10px', fontSize: 12, fontWeight: 600, borderRadius: 8,
            cursor: 'pointer', border: '1px solid var(--border-color)',
            background: 'var(--bg-white)', color: 'var(--text-main)',
            textAlign: 'left', opacity: runningZotero ? 0.6 : 1,
          }}>
            {runningZotero ? '⏳ Syncing Zotero…' : '🔄 Sync Zotero'}
          </button>
          <button disabled={runningAI} onClick={() => setShowAIModal(true)} style={{
            padding: '7px 10px', fontSize: 12, fontWeight: 600, borderRadius: 8,
            cursor: 'pointer', border: '1px solid var(--border-color)',
            background: 'var(--bg-white)', color: 'var(--text-main)',
            textAlign: 'left', opacity: runningAI ? 0.6 : 1,
          }}>
            {runningAI ? '⏳ Enriching…' : '✨ AI Enrichment'}
          </button>
        </div>
      </aside>

      {/* AI Enrichment Modal */}
      {showAIModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setShowAIModal(false)}>
          <div style={{
            background: 'var(--bg-white)', borderRadius: 14, padding: 24, width: 360,
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            display: 'flex', flexDirection: 'column', gap: 14,
          }} onClick={e => e.stopPropagation()}>

            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)' }}>
              AI Enrichment Options
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Just run for a default enrichment, all items with annotations</div>

            {/* Checkboxes */}
            {[
              { field: 'full_text', label: 'Full-text mode', desc: 'Thorough but uses more tokens' },
              { field: 'force',     label: 'Force reprocess', desc: 'Re-run already processed papers' }
            ].map(({ field, label, desc }) => (
              <label key={field} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                <input type="checkbox" {...opt(field)} style={{ marginTop: 2, accentColor: 'var(--accent-blue)' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>{label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{desc}</div>
                </div>
              </label>
            ))}

            {/* Zotero key */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Single paper key (optional) for enriching a specific zotero item
              </label>
              <input
                className="form-input"
                placeholder="e.g. ABCD1234"
                value={aiOpts.key}
                onChange={e => setAIOpts(p => ({ ...p, key: e.target.value }))}
              />
            </div>

            {/* Provider */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Provider (optional)
              </label>
              <select
                className="form-input"
                value={aiOpts.provider}
                onChange={e => setAIOpts(p => ({ ...p, provider: e.target.value }))}
              >
                {PROVIDERS.map(p => <option key={p} value={p}>{p || 'Default'}</option>)}
              </select>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button onClick={() => setShowAIModal(false)} style={{
                padding: '7px 16px', fontSize: 13, borderRadius: 8,
                border: '1px solid var(--border-color)', background: 'none',
                cursor: 'pointer', color: 'var(--text-muted)',
              }}>Cancel</button>
              <button onClick={runAI} style={{
                padding: '7px 18px', fontSize: 13, fontWeight: 600, borderRadius: 8,
                border: 'none', background: 'var(--accent-blue)',
                color: '#fff', cursor: 'pointer',
              }}>Run</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: toast.ok ? '#22c55e' : '#ef4444', color: '#fff',
          padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600,
          zIndex: 9999, boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          maxWidth: '80vw', textAlign: 'center',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Right pane */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}