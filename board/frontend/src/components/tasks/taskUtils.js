export const COLUMNS = [
  { key: 'todo',        label: 'To Do',      color: '#94a3b8' },
  { key: 'in_progress', label: 'In Progress', color: '#3b82f6' },
  { key: 'blocked',     label: 'Blocked',     color: '#ef4444' },
  { key: 'completed',   label: 'Completed',   color: '#22c55e' },
];

export const PRIORITY_STYLES = {
  low:    { background: '#f1f5f9', color: '#64748b' },
  medium: { background: '#fef9c3', color: '#ca8a04' },
  high:   { background: '#fee2e2', color: '#dc2626' },
  urgent: { background: '#fce7f3', color: '#be185d' },
};

export const EMPTY_FORM = {
  title: '', description: '', priority: 'medium',
  due_date: '', assigned_to: '',
};

export const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: 'var(--text-muted)', marginBottom: 4,
  textTransform: 'uppercase', letterSpacing: '0.05em',
};

export const iconBtnStyle = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 13, padding: '2px 4px', borderRadius: 4,
  color: 'var(--text-muted)',
};