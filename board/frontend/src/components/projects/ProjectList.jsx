// frontend/src/components/projects/ProjectList.jsx

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../api/client';

export default function ProjectList() {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        apiClient.get('/projects/')
            .then((res) => setProjects(res.data))
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <p>Loading projects...</p>;
    if (error) return <p>Error: {error}</p>;

    return (
        <div className="project-list">
            <h2>Research Projects</h2>
            <div className="project-grid">
                {projects.map((project) => (
                    <ProjectCard key={project.project_id} project={project} />
                ))}
            </div>
        </div>
    );
}

// Link wraps the card here — clicking navigates to the detail page
function ProjectCard({ project }) {
    return (
        <Link to={`/projects/${project.project_id}`} style={{ textDecoration: 'none' }}>
            <div className="project-card">
                <div className="project-card__header">
                    <h3>{project.name}</h3>
                    <span className={`status-badge status-badge--${project.status}`}>
                        {project.status}
                    </span>
                </div>
                {project.description && (
                    <p className="project-card__description">{project.description}</p>
                )}
                {project.keywords?.length > 0 && (
                    <div className="project-card__keywords">
                        {project.keywords.map((kw) => (
                            <span key={kw} className="keyword-tag">{kw}</span>
                        ))}
                    </div>
                )}
                <p className="project-card__date">
                    Created: {new Date(project.created_at).toLocaleDateString()}
                </p>
            </div>
        </Link>
    );
}