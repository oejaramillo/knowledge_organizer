{/* ============================================================================
 * RESEARCH DASHBOARD - MAIN APPLICATION COMPONENT
 * ============================================================================
 * This is the root component of the Research Knowledge Management System's
 * React frontend. It provides the main application structure, routing,
 * and state management for the dashboard interface.
 *
 * KEY FEATURES:
 * 1. React Router integration for single-page application navigation
 * 2. Project type filtering and switching functionality
 * 3. Main layout wrapper providing consistent UI structure
 * 4. Route-based component rendering for different views
 * 5. Empty state handling for initial user experience
 *
 * ROUTING STRUCTURE:
 * - "/" - Main dashboard with project list and empty state
 * - "/projects/:project_id" - Detailed project view with full information
 *
 * STATE MANAGEMENT:
 * - projectType: Controls filtering between research/other project types
 * - Passed down through layout for consistent filtering across components
 * ============================================================================ */}

import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import MainLayout from './layouts/MainLayout'
import ProjectDetail from './components/projects/ProjectDetail'
import './index.css'

function App() {
  // ── APPLICATION STATE ───────────────────────────────────────────────────
  // Project type filter state - controls which projects are displayed
  // 'research' - Academic research projects (default)
  // 'other' - Non-research organizational projects
  const [projectType, setProjectType] = useState('research')

  return (
    /* ── ROUTING CONFIGURATION ─────────────────────────────────────────────
     * React Router provides single-page application navigation
     * All routes are wrapped in MainLayout for consistent UI structure */
    <Routes>
      <Route
        path="/"
        element={
          <MainLayout
            projectType={projectType}
            onToggle={setProjectType}
          />
        }
      >
        {/* ── INDEX ROUTE: DASHBOARD HOME ───────────────────────────────────
         * Default route shows empty state when no project is selected
         * The MainLayout handles project list display in the sidebar */}
        <Route index element={<EmptyState />} />
        
        {/* ── PROJECT DETAIL ROUTE ──────────────────────────────────────────
         * Dynamic route for individual project views
         * project_id parameter passed to ProjectDetail component
         * Displays comprehensive project information, tasks, meetings, etc. */}
        <Route path="projects/:project_id" element={<ProjectDetail />} />
      </Route>
    </Routes>
  )
}

function EmptyState() {
  /**
   * Empty state component shown when no project is selected.
   * 
   * Provides visual feedback and guidance to users on the main dashboard.
   * Appears in the main content area while project list remains visible
   * in the sidebar for easy navigation.
   * 
   * @returns {JSX.Element} Centered empty state message
   */
  return (
    <div className="flex items-center justify-center h-full text-slate-400 text-sm">
      Select a project to get started
    </div>
  )
}

export default App