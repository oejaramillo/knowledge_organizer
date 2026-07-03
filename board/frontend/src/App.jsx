import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ProjectList from './components/projects/ProjectList';
import ProjectDetail from './components/projects/ProjectDetail';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/projects" element={<ProjectList />} />
                <Route path="/projects/:project_id" element={<ProjectDetail />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App