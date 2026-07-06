import { Outlet } from 'react-router-dom'
import ProjectList from '../components/projects/ProjectList'

export default function MainLayout({ projectType, onToggle }) {
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">

      {/* Left pane */}
      <aside className="w-64 border-r border-slate-200 flex flex-col">
        {/* Toggle */}
        <div className="flex gap-2 p-3 border-b border-slate-200">
          {['research', 'collection'].map(type => (
            <button
              key={type}
              onClick={() => onToggle(type)}
              className={`flex-1 py-1 rounded text-sm capitalize font-medium transition-colors
                ${projectType === type
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-500 hover:bg-slate-100'}`}
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