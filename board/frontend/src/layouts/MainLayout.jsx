{/* ============================================================================
 * MAIN LAYOUT COMPONENT - RESEARCH DASHBOARD SHELL
 * ============================================================================
 * This component provides the primary layout structure for the Research
 * Knowledge Management System's web interface. It combines navigation,
 * project management, and tool execution in a cohesive dashboard experience.
 *
 * KEY FEATURES:
 * 1. Two-pane layout: sidebar navigation + main content area
 * 2. Project type filtering and hierarchical project navigation
 * 3. Integrated tool execution (Zotero sync, AI enrichment)
 * 4. Modal interfaces for complex tool configuration
 * 5. Toast notifications for user feedback
 * 6. Responsive design with overflow handling
 *
 * COMPONENT STRUCTURE:
 * - Left Sidebar: Project filtering, navigation tree, tool buttons
 * - Main Content: Router outlet for dynamic content (Outlet component)
 * - Overlays: Modals for AI configuration, toast notifications
 *
 * STATE MANAGEMENT:
 * - Tool execution states (loading indicators)
 * - Modal visibility and configuration
 * - Toast notification system
 * - AI enrichment options and parameters
 * ============================================================================ */}

import { Outlet, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import ProjectTreeNav from '../components/projects/ProjectTreeNav';
import apiClient from '../api/client';

// ── CONFIGURATION CONSTANTS ────────────────────────────────────────────────
// Available AI providers for enrichment processing
// Empty string represents default/auto-selection
const PROVIDERS = ['', 'deepseek'];

export default function MainLayout({ projectType, onToggle }) {
  /* ── COMPONENT STATE MANAGEMENT ──────────────────────────────────────────
   * Manages various UI states and tool execution status */

  // Tool execution states - prevent concurrent operations
  const [runningZotero, setRunningZotero] = useState(false);
  const [runningAI, setRunningAI] = useState(false);

  const navigate = useNavigate();

  // Modal and notification states
  const [showAIModal, setShowAIModal] = useState(false);
  const [toast, setToast] = useState(null);

  // AI enrichment configuration options
  const [aiOpts, setAIOpts] = useState({
    full_text: false,  // Use full PDF text vs annotation-driven processing
    force: false,      // Reprocess already completed papers
    dry_run: false,    // Preview mode without actual processing
    key: '',           // Specific Zotero key for single-paper processing
    provider: '',      // AI provider selection (empty = default)
  });

  /* ── NOTIFICATION SYSTEM ─────────────────────────────────────────────────
   * Toast notification handler for user feedback */
  const showToast = (msg, ok) => {
    setToast({ msg, ok });
    // Auto-dismiss after 5 seconds
    setTimeout(() => setToast(null), 5000);
  };

  /* ── ZOTERO SYNCHRONIZATION HANDLER ─────────────────────────────────────
   * Triggers backend Zotero sync operation with user feedback */
  const runZotero = async () => {
    setRunningZotero(true);
    try {
      // Call backend API endpoint for Zotero synchronization
      const { data } = await apiClient.post('/tools/zotero-sync');

      // Show success/error feedback based on API response
      showToast(
        data.ok ? '✅ Zotero sync completed' : `❌ Sync failed: ${data.error}`,
        data.ok
      );
    } catch {
      // Handle network/API errors
      showToast('❌ Zotero sync error', false);
    } finally {
      setRunningZotero(false);
    }
  };

  /* ── AI ENRICHMENT HANDLER ──────────────────────────────────────────────
   * Triggers AI processing with user-configured options */
  const runAI = async () => {
    setShowAIModal(false);  // Close configuration modal
    setRunningAI(true);

    try {
      // Send enrichment request with all configuration options
      const { data } = await apiClient.post('/tools/ai-enrichment', {
        full_text: aiOpts.full_text,  // Processing mode selection
        force: aiOpts.force,      // Reprocess completed papers
        dry_run: aiOpts.dry_run,    // Preview mode flag
        key: aiOpts.key || null,      // Specific paper key
        provider: aiOpts.provider || null, // AI provider choice
      });

      // Provide user feedback on enrichment result
      showToast(
        data.ok ? '✅ AI enrichment completed' : `❌ Enrichment failed: ${data.error}`,
        data.ok
      );
    } catch {
      // Handle network/API errors
      showToast('❌ AI enrichment error', false);
    } finally {
      setRunningAI(false);
    }
  };

  /* ── FORM HELPER FUNCTION ───────────────────────────────────────────────
   * Creates checkbox props for controlled form inputs */
  const opt = (field) => ({
    checked: aiOpts[field],
    onChange: e => setAIOpts(p => ({ ...p, [field]: e.target.checked })),
  });

  return (
    /* ── MAIN LAYOUT CONTAINER ──────────────────────────────────────────────
     * Full-screen flex layout with sidebar + main content */
    <div className="flex h-screen bg-slate-50 overflow-hidden">

      {/* ── LEFT SIDEBAR PANEL ─────────────────────────────────────────────
       * Contains project filtering, navigation, and tool access */}
      <aside className="w-64 border-r border-slate-200 flex flex-col overflow-y-auto">

        {/* ── PROJECT TYPE TOGGLE ────────────────────────────────────────
         * Switch between research and collection project types */}
        <div style={{
          display: 'flex', gap: 6, padding: '10px 12px',
          borderBottom: '1px solid var(--border-color)'
        }}>
          {['research', 'collection'].map(type => (
            <button
              key={type}
              onClick={() => onToggle(type)}
              style={{
                flex: 1, padding: '5px 14px', fontSize: 12, fontWeight: 600,
                borderRadius: 999, border: '1px solid var(--border-color)',
                cursor: 'pointer',
                // Dynamic styling based on active project type
                background: projectType === type ? 'var(--accent-blue)' : 'var(--bg-white)',
                color: projectType === type ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.15s', textTransform: 'capitalize',
              }}
            >
              {type}
            </button>
          ))}
        </div>

        {/* ── PROJECT NAVIGATION SECTION ────────────────────────────────
         * Hierarchical project tree with filtering */}
        <div style={{
          padding: '12px 16px 4px', fontSize: 11, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.08em',
          color: 'var(--text-muted)'
        }}>
          Projects
        </div>
        <ProjectTreeNav projectType={projectType} />

        {/* ── TOOL EXECUTION PANEL ──────────────────────────────────────
         * Bottom-aligned tool buttons with execution status */}
        <div style={{
          marginTop: 'auto', padding: '12px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex', flexDirection: 'column', gap: 6
        }}>

          {/* Section header */}
          <div style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.08em', color: 'var(--text-muted)',
            marginBottom: 2
          }}>
            Tools
          </div>

          {/* ── ZOTERO SYNC BUTTON ─────────────────────────────────────
           * Triggers bibliography synchronization from Zotero */}
          <button
            disabled={runningZotero}
            onClick={runZotero}
            style={{
              padding: '7px 10px', fontSize: 12, fontWeight: 600,
              borderRadius: 8, cursor: 'pointer',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-white)', color: 'var(--text-main)',
              textAlign: 'left',
              opacity: runningZotero ? 0.6 : 1, // Visual feedback during execution
            }}
          >
            {runningZotero ? '⏳ Syncing Zotero…' : '🔄 Sync Zotero'}
          </button>

          {/* ── AI ENRICHMENT BUTTON ───────────────────────────────────
           * Opens configuration modal for AI processing */}
          <button
            disabled={runningAI}
            onClick={() => setShowAIModal(true)}
            style={{
              padding: '7px 10px', fontSize: 12, fontWeight: 600,
              borderRadius: 8, cursor: 'pointer',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-white)', color: 'var(--text-main)',
              textAlign: 'left',
              opacity: runningAI ? 0.6 : 1, // Visual feedback during execution
            }}
          >
            {runningAI ? '⏳ Enriching…' : '✨ AI Enrichment'}
          </button>

          {/* ── SUMMARY BUTTON ─────────────────────────────────────────────── */}
          <button
            onClick={() => navigate('/summary')}
            style={{
              padding: '7px 10px', fontSize: 12, fontWeight: 600,
              borderRadius: 8, cursor: 'pointer',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-white)', color: 'var(--text-main)',
              textAlign: 'left',
            }}
          >
            📊 Reading Summary
          </button>

          {/* ── TO DO RESEARCH BUTTON ─────────────────────────────────────────────── */}
          <button
            onClick={() => navigate('/tracker')}
            style={{
              padding: '7px 10px', fontSize: 12, fontWeight: 600,
              borderRadius: 8, cursor: 'pointer',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-white)', color: 'var(--text-main)',
              textAlign: 'left',
            }}
          >
            🗂 Project Tracker
          </button>
        </div>
      </aside>

      {/* ── AI ENRICHMENT CONFIGURATION MODAL ─────────────────────────────────
       * Overlay modal for configuring AI processing options */}
      {showAIModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.35)',  // Semi-transparent backdrop
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setShowAIModal(false)}>

          {/* Modal content container */}
          <div style={{
            background: 'var(--bg-white)', borderRadius: 14, padding: 24,
            width: 360, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            display: 'flex', flexDirection: 'column', gap: 14,
          }} onClick={e => e.stopPropagation()}>

            {/* ── MODAL HEADER ───────────────────────────────────────────
             * Title and description for AI enrichment options */}
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)' }}>
              AI Enrichment Options
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Just run for a default enrichment, all items with annotations
            </div>

            {/* ── PROCESSING MODE CHECKBOXES ────────────────────────────
             * Boolean configuration options for AI processing */}
            {[
              {
                field: 'full_text',
                label: 'Full-text mode',
                desc: 'Thorough but uses more tokens'
              },
              {
                field: 'force',
                label: 'Force reprocess',
                desc: 'Re-run already processed papers'
              }
            ].map(({ field, label, desc }) => (
              <label
                key={field}
                style={{
                  display: 'flex', alignItems: 'flex-start',
                  gap: 10, cursor: 'pointer'
                }}
              >
                <input
                  type="checkbox"
                  {...opt(field)}
                  style={{
                    marginTop: 2,
                    accentColor: 'var(--accent-blue)'
                  }}
                />
                <div>
                  <div style={{
                    fontSize: 13, fontWeight: 600,
                    color: 'var(--text-main)'
                  }}>
                    {label}
                  </div>
                  <div style={{
                    fontSize: 11,
                    color: 'var(--text-muted)'
                  }}>
                    {desc}
                  </div>
                </div>
              </label>
            ))}

            {/* ── SINGLE PAPER SELECTION ────────────────────────────────
             * Input for processing specific Zotero item by key */}
            <div>
              <label style={{
                fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.05em', color: 'var(--text-muted)',
                display: 'block', marginBottom: 4
              }}>
                Single paper key (optional) for enriching a specific zotero item
              </label>
              <input
                className="form-input"
                placeholder="e.g. ABCD1234"
                value={aiOpts.key}
                onChange={e => setAIOpts(p => ({ ...p, key: e.target.value }))}
              />
            </div>

            {/* ── AI PROVIDER SELECTION ──────────────────────────────────
             * Dropdown for choosing AI processing provider */}
            <div>
              <label style={{
                fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.05em', color: 'var(--text-muted)',
                display: 'block', marginBottom: 4
              }}>
                Provider (optional)
              </label>
              <select
                className="form-input"
                value={aiOpts.provider}
                onChange={e => setAIOpts(p => ({ ...p, provider: e.target.value }))}
              >
                {PROVIDERS.map(p => (
                  <option key={p} value={p}>
                    {p || 'Default'}
                  </option>
                ))}
              </select>
            </div>

            {/* ── MODAL ACTION BUTTONS ───────────────────────────────────
             * Cancel and execute buttons for modal */}
            <div style={{
              display: 'flex', gap: 8, justifyContent: 'flex-end',
              marginTop: 4
            }}>
              <button
                onClick={() => setShowAIModal(false)}
                style={{
                  padding: '7px 16px', fontSize: 13, borderRadius: 8,
                  border: '1px solid var(--border-color)', background: 'none',
                  cursor: 'pointer', color: 'var(--text-muted)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={runAI}
                style={{
                  padding: '7px 18px', fontSize: 13, fontWeight: 600,
                  borderRadius: 8, border: 'none',
                  background: 'var(--accent-blue)', color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Run
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOAST NOTIFICATION SYSTEM ─────────────────────────────────────────
       * Floating notification for user feedback on operations */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%',
          transform: 'translateX(-50%)',
          // Dynamic styling based on success/error state
          background: toast.ok ? '#22c55e' : '#ef4444',
          color: '#fff',
          padding: '10px 20px', borderRadius: 10,
          fontSize: 13, fontWeight: 600,
          zIndex: 9999, boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          maxWidth: '80vw', textAlign: 'center',
        }}>
          {toast.msg}
        </div>
      )}

      {/* ── MAIN CONTENT AREA ─────────────────────────────────────────────────
       * Router outlet for dynamic content rendering */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}