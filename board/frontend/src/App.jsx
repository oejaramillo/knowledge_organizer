import { useEffect, useState } from 'react'
import apiClient from './api/client'
import { FolderGit2 } from 'lucide-react'

function App() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch the projects when the app loads
    apiClient.get('/projects/')
      .then((response) => {
        setProjects(response.data);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching projects:", error);
        setLoading(false);
      });
  }, []);

  return (
    <div className="p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Research Studio</h1>
        <p className="text-slate-500">Your connected workspace</p>
      </header>

      <main>
        <h2 className="text-xl font-semibold mb-4 text-slate-700">All Projects</h2>
        
        {loading ? (
          <p>Loading projects...</p>
        ) : projects.length === 0 ? (
          <p className="text-slate-500 italic">No projects found. Use your database or Zotero sync to add some!</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <div 
                key={project.project_id} 
                className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-center gap-3 mb-2">
                  <FolderGit2 className="text-blue-500" size={24} />
                  <h3 className="font-semibold text-lg text-slate-800">{project.name}</h3>
                </div>
                <div className="flex justify-between items-center mt-4 text-sm text-slate-500">
                  <span className="capitalize px-2 py-1 bg-slate-100 rounded-md">
                    {project.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default App