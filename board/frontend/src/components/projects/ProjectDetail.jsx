import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

export default function ProjectDetail() {
  const { project_id } = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`http://localhost:8000/api/projects/${project_id}`)
      .then((res) => res.json())
      .then((data) => {
        setProject(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [project_id]);

  if (loading) return <p className="empty-state" style={{ padding: "40px" }}>Loading...</p>;
  if (!project) return <p className="empty-state" style={{ padding: "40px" }}>Project not found.</p>;

  const contributors = project.project_contributors ?? [];

  return (
    <div className="project-detail">
      {/* Header */}
      <div className="project-detail__header">
        <h2>{project.name}</h2>
        <span className={`status-badge status-badge--${project.status}`}>
          {project.status}
        </span>
      </div>

      {/* Keywords */}
      {project.keywords?.length > 0 && (
        <div className="project-detail__keywords">
          {project.keywords.map((kw) => (
            <span key={kw} className="keyword-tag">{kw}</span>
          ))}
        </div>
      )}

      {/* Contributors section */}
      <div className="detail-section detail-section--full" style={{ marginTop: "24px" }}>
        <h3>Contributors</h3>

        {contributors.length === 0 ? (
          <p className="empty-state">No contributors yet.</p>
        ) : (
          <ul className="task-list">
            {contributors.map((pc) => {
              const c = pc.contributor;
              return (
                <li key={c.contributor_id} className="task-item">
                  <div className="task-item__header">
                    {/* Name — hyperlink if site exists */}
                    {c.site ? (
                      <a
                        href={c.site}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontWeight: 600, color: "var(--accent-blue)", textDecoration: "none" }}
                      >
                        {c.name}
                      </a>
                    ) : (
                      <span style={{ fontWeight: 600 }}>{c.name}</span>
                    )}

                    {/* Role badge */}
                    {pc.project_role && (
                      <span className="keyword-tag">{pc.project_role}</span>
                    )}

                    {/* Email inline */}
                    {c.email && (
                      <a
                        href={`mailto:${c.email}`}
                        style={{ fontSize: "13px", color: "var(--text-muted)", textDecoration: "none", marginLeft: "auto" }}
                      >
                        ✉ {c.email}
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}