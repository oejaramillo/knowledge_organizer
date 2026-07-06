import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import MainLayout from './layouts/MainLayout'
import ProjectDetail from './components/projects/ProjectDetail'
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
      </Route>
    </Routes>
  )
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center h-full text-slate-400 text-sm">
      Select a project to get started
    </div>
  )
}

export default App