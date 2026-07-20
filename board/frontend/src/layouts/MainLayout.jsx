import { Outlet } from 'react-router-dom'
import ProjectList from '../components/projects/ProjectList'

export default function MainLayout({ projectType, onToggle }) {
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">

      {/* Left pane */}
      <aside className="w-64 border-r border-slate-200 flex flex-col">
        {/* Toggle */}
        <div style={{ display: 'flex', gap: 6, padding: '10px 12px', borderBottom: '1px solid var(--border-color)' }}>
          {['research', 'collection'].map(type => (
            <button
              key={type}
              onClick={() => onToggle(type)}
              style={{
                flex: 1,
                padding: '5px 14px',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 999,
                border: '1px solid var(--border-color)',
                cursor: 'pointer',
                background: projectType === type ? 'var(--accent-blue)' : 'var(--bg-white)',
                color:      projectType === type ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.15s',
                textTransform: 'capitalize',
              }}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Project list filtered by type */}
        <ProjectList projectType={projectType} />
      </aside>

      {/* RIGHT PANE — changes based on route */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

    </div>
  )
}