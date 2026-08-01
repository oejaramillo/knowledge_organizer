// src/components/projects/ProjectTreeNav.jsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../../api/client'

/** Build a nested tree from a flat array */
function buildTree(projects) {
  const map = {};
  projects.forEach(p => { map[p.project_id] = { ...p, children: [] }; });
  const roots = [];
  projects.forEach(p => {
    if (p.parent_project && map[p.parent_project]) {
      map[p.parent_project].children.push(map[p.project_id]);
    } else {
      roots.push(map[p.project_id]);
    }
  });
  return roots;
}

function TreeNode({ node, depth = 0 }) {
  const { project_id } = useParams();
  const navigate = useNavigate();
  const isLeaf = node.children.length === 0;
  const isActive = project_id === String(node.project_id);
  const [open, setOpen] = useState(true);

  const indent = depth * 12;

  return (
    <div>
      <div
        onClick={() => {
          if (isLeaf) navigate(`/projects/${node.project_id}`);
          else setOpen(o => !o);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          paddingLeft: 8 + indent,
          paddingRight: 8,
          paddingTop: 5,
          paddingBottom: 5,
          cursor: 'pointer',
          borderRadius: 6,
          fontSize: 13,
          fontWeight: isLeaf ? 400 : 600,
          color: isActive
            ? 'var(--accent-blue)'
            : isLeaf
            ? 'var(--text-main)'
            : 'var(--text-muted)',
          background: isActive ? 'var(--accent-bg)' : 'transparent',
          userSelect: 'none',
          transition: 'background 0.1s',
        }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover, #f1f5f9)'; }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
      >
        {/* Expand/collapse icon for parent nodes */}
        {!isLeaf && (
          <span style={{ fontSize: 10, width: 12, display: 'inline-block', color: 'var(--text-muted)' }}>
            {open ? '▾' : '▸'}
          </span>
        )}
        {isLeaf && <span style={{ width: 12, display: 'inline-block' }} />}

        {/* Folder / file icon */}
        <span style={{ fontSize: 13 }}>{isLeaf ? '📄' : '📁'}</span>

        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.name}
        </span>
      </div>

      {/* Children */}
      {!isLeaf && open && (
        <div>
          {node.children.map(child => (
            <TreeNode key={child.project_id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProjectTreeNav( { projectType }) {
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setTree([]);
    apiClient.get('/projects/', { params: { project_type: projectType } })  // ← send filter
      .then(response => setTree(buildTree(response.data)))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [projectType]);  // ← re-fetch when type changes

  useEffect(() => {
    apiClient.get('/projects/')
      .then(response => setTree(buildTree(response.data)))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-muted)' }}>Loading…</div>;
  if (error)   return <div style={{ padding: '12px 16px', fontSize: 13, color: '#ef4444' }}>Error: {error}</div>;
  if (!tree.length) return <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-muted)' }}>No projects yet</div>;

  return (
    <div style={{ padding: '8px 4px' }}>
      {tree.map(node => (
        <TreeNode key={node.project_id} node={node} depth={0} />
      ))}
    </div>
  );
}