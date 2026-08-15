{/* ============================================================================
 * PROJECT CARD COMPONENT
 * ============================================================================
 * A reusable card component for displaying project information in lists and
 * grids. Provides navigation to detailed project views and shows essential
 * information.
 *
 * KEY FEATURES:
 * 1. Clickable navigation to project detail page
 * 2. Project type classification display
 * 3. Creation date formatting for temporal context
 * 4. Hover effects and visual feedback
 * 5. Responsive design with consistent styling
 *
 * USAGE:
 * - Project sidebar lists
 * - Dashboard project grids
 * - Search result displays
 * - Project browsing interfaces
 * ============================================================================ */}

import { Link } from 'react-router-dom';

export default function ProjectCard({ project }) {
    /**
     * ProjectCard component for displaying project summary information.
     * 
     * This component renders project data in a card layout with navigation
     * capabilities. It's designed to be reusable across different contexts
     * where project listings are needed.
     * 
     * @param {Object} project - Project data object containing:
     *   @param {string} project.project_id - Unique project identifier
     *   @param {string} project.name - Display name of the project
     *   @param {string} project.project_type - Project classification
     *   @param {string} project.created_at - ISO timestamp of creation
     * 
     * @returns {JSX.Element} Clickable project card with metadata
     */
    
    return (
        /* ── NAVIGATION WRAPPER ─────────────────────────────────────────────
         * Link component provides SPA navigation to project detail page
         * textDecoration: 'none' removes default link underlines */
        <Link to={`/projects/${project.project_id}`} style={{ textDecoration: 'none' }}>
            
            {/* ── CARD CONTAINER ─────────────────────────────────────────────
             * Main card styling and layout container
             * CSS class 'project-card' provides hover effects and spacing */}
            <div className="project-card">
                
                {/* ── CARD HEADER SECTION ───────────────────────────────────
                 * Contains primary project information */}
                <div className="project-card__header">
                    {/* Project name as main heading */}
                    <h3>{project.name}</h3>
                    
                    {/* Project type classification label */}
                    <p className="project-type">
                        Type: {project.project_type}
                    </p>
                </div> 
                
                {/* ── METADATA SECTION ──────────────────────────────────────
                 * Secondary information with formatted creation date */}
                <p className="project-card__date">
                    Created: {new Date(project.created_at).toLocaleDateString()}
                </p>
            </div>
        </Link>
    );
}