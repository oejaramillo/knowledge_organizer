// frontend/src/components/projects/ProjectCard.jsx

import { Link } from 'react-router-dom';

export default function ProjectCard({ project }) {
    return (
        <Link to={`/projects/${project.project_id}`} style={{ textDecoration: 'none' }}>
            <div className="project-card">
                <div className="project-card__header">
                    <h3>{project.name}</h3>
                    <p className="project-type">
                        Type: {project.project_type}
                    </p>
                </div> 
                <p className="project-card__date">
                    Created: {new Date(project.created_at).toLocaleDateString()}
                </p>
            </div>
        </Link>
    );
}