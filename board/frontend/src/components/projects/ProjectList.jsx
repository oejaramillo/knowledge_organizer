import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import apiClient from '../../api/client'

export default function ProjectList({ projectType }) {
  const [projects, setProjects] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    apiClient.get('/projects/')
      .then(r => {
        const filtered = r.data.filter(p => p.project_type === projectType)
        setProjects(filtered)
      })
      .finally(() => setLoading(false))
  }, [projectType])  // re-fetch/filter when type changes

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