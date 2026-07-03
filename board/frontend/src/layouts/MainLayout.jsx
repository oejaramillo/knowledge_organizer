import { Outlet } from 'react-router-dom'
import ProjectList from '../components/projects/ProjectList'

export default function MainLayout() {
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">

      {/* LEFT PANE — always visible */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col overflow-hidden shrink-0">
        <div className="p-4 border-b border-slate-100">
          <h1 className="text-lg font-bold text-slate-800">Research Studio</h1>
        </div>
        <div className="flex-1 overflow-y-auto">
          <ProjectList />
        </div>
      </aside>

      {/* RIGHT PANE — changes based on route */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

    </div>
  )
}