// frontend/src/components/projects/ProjectDetail.jsx

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import apiClient from '../../api/client';

export default function ProjectDetail() {
    const { project_id } = useParams();
    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        apiClient.get(`/projects/${project_id}`)
            .then((res) => setProject(res.data))
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, [project_id]);

    if (loading) return <p>Loading project...</p>;
    if (error) return <p>Error: {error}</p>;
    if (!project) return <p>Project not found.</p>;

    return (
        <div className="project-detail">

            {/* ── HEADER ── */}
            <div className="project-detail__header">
                <div>
                    <h2>{project.name}</h2>
                    {project.description && (
                        <p className="project-detail__description">{project.description}</p>
                    )}
                </div>
                <span className={`status-badge status-badge--${project.status}`}>
                    {project.status}
                </span>
            </div>

            {project.keywords?.length > 0 && (
                <div className="project-detail__keywords">
                    {project.keywords.map((kw) => (
                        <span key={kw} className="keyword-tag">{kw}</span>
                    ))}
                </div>
            )}

            {/* ── SECTIONS GRID ── */}
            <div className="project-detail__grid">

                {/* TASKS */}
                <section className="detail-section">
                    <h3>Tasks ({project.tasks.length})</h3>
                    {project.tasks.length === 0 ? (
                        <p className="empty-state">No tasks yet.</p>
                    ) : (
                        <ul className="task-list">
                            {project.tasks.map((task) => (
                                <TaskItem key={task.task_id} task={task} />
                            ))}
                        </ul>
                    )}
                </section>

                {/* MEETINGS */}
                <section className="detail-section">
                    <h3>Meetings ({project.meetings.length})</h3>
                    {project.meetings.length === 0 ? (
                        <p className="empty-state">No meetings recorded.</p>
                    ) : (
                        <ul className="meeting-list">
                            {project.meetings.map((meeting) => (
                                <MeetingItem key={meeting.meeting_id} meeting={meeting} />
                            ))}
                        </ul>
                    )}
                </section>

                {/* BINNACLE */}
                <section className="detail-section detail-section--full">
                    <h3>Binnacle ({project.binnacle_entries.length})</h3>
                    {project.binnacle_entries.length === 0 ? (
                        <p className="empty-state">No journal entries yet.</p>
                    ) : (
                        <ul className="binnacle-list">
                            {project.binnacle_entries.map((entry) => (
                                <BinnacleItem key={entry.binnacle_id} entry={entry} />
                            ))}
                        </ul>
                    )}
                </section>

            </div>
        </div>
    );
}

// ── SUB-COMPONENTS ──

function TaskItem({ task }) {
    return (
        <li className="task-item">
            <div className="task-item__header">
                <span className={`priority-dot priority-dot--${task.priority}`} />
                <strong>{task.title}</strong>
                <span className={`status-badge status-badge--${task.status}`}>
                    {task.status}
                </span>
            </div>
            {task.description && (
                <p className="task-item__description">{task.description}</p>
            )}
            {task.due_date && (
                <p className="task-item__due">
                    Due: {new Date(task.due_date).toLocaleDateString()}
                </p>
            )}
        </li>
    );
}

function MeetingItem({ meeting }) {
    return (
        <li className="meeting-item">
            <div className="meeting-item__header">
                <strong>{meeting.title}</strong>
                <span className="meeting-item__date">
                    {new Date(meeting.meeting_date).toLocaleDateString()}
                </span>
            </div>
            {meeting.summary && (
                <p className="meeting-item__summary">{meeting.summary}</p>
            )}
        </li>
    );
}

function BinnacleItem({ entry }) {
    return (
        <li className="binnacle-item">
            <div className="binnacle-item__header">
                <span className="binnacle-item__date">
                    {new Date(entry.entry_date).toLocaleDateString()}
                </span>
                {entry.title && <strong>{entry.title}</strong>}
            </div>
            <p className="binnacle-item__content">{entry.content}</p>

            {/* Show linked task or meeting if present */}
            <div className="binnacle-item__links">
                {entry.task_id && (
                    <span className="link-badge link-badge--task">📌 Linked to Task</span>
                )}
                {entry.meeting_id && (
                    <span className="link-badge link-badge--meeting">📅 Linked to Meeting</span>
                )}
            </div>
        </li>
    );
}