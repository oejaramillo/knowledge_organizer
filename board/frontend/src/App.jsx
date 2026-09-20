import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import MainLayout from './layouts/MainLayout'
import ProjectDetail from './components/projects/ProjectDetail'
import SummaryPage from './pages/SummaryPage'
import TrackerPage from './pages/TrackerPage';
import './index.css'

function App() {
  const [projectType, setProjectType] = useState('research')

  return (
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
        <Route index element={<EmptyState />} />
        <Route path="projects/:project_id" element={<ProjectDetail />} />
        <Route path="summary" element={<SummaryPage />} />
        <Route path="tracker" element={<TrackerPage />} />
      </Route>
    </Routes>
  )
}

function EmptyState() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      padding: 40,
      color: 'var(--text-muted)',
      fontSize: 14,
      textAlign: 'center',
    }}>
      Select a project to get started
    </div>
  )
}

export default App