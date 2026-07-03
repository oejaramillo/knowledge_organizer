import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import apiClient from '../../api/client'

const STATUS_DOT = {
  active:    'bg-emerald-400',
  paused:    'bg-amber-400',
  completed: 'bg-blue-400',
  archived:  'bg-slate-300',
}

export default function ProjectList() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    apiClient.get('/projects/')
      .then(r => setProjects(r.data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="p-4 text-sm text-slate-400">Loading...</p>

  return (
    <nav className="project-sidebar-nav">
      {projects.map(p => (
        <NavLink
          to={`/projects/${p.project_id}`} 
          className="nav-item"
          key={p.project_id}
        >
          <span className={`status-dot dot-${p.status}`} />
          {p.name}
        </NavLink>
      ))}
    </nav>
  )
}