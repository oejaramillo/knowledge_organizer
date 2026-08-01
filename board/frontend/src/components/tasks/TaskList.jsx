import React, { useState } from 'react';
import apiClient from '../../api/client';
import TaskForm from './TaskForm';
import { COLUMNS, EMPTY_FORM, PRIORITY_STYLES } from './taskUtils';

const STATUS_ORDER = ['todo', 'in_progress', 'blocked', 'completed'];

const STATUS_META = {
  todo:        { label: 'To Do',       color: '#94a3b8' },
  in_progress: { label: 'In Progress', color: '#3b82f6' },
  blocked:     { label: 'Blocked',     color: '#ef4444' },
  completed:   { label: 'Completed',   color: '#22c55e' },
};

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function TaskList({ tasks: initialTasks = [], projectId, projectContributors = [], fetchProject }) {
  const [showForm, setShowForm]       = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [submitting, setSubmitting]   = useState(false);
  const [collapsed, setCollapsed]     = useState({ completed: true }); // completed collapsed by default

  const contributors = projectContributors.map(pc => pc.contributor);
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openCreate = () => { setEditingTask(null); setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit   = (task) => {
    setEditingTask(task);
    setForm({
      title:       task.title,
      description: task.description || '',
      priority:    task.priority,
      due_date:    task.due_date ? task.due_date.split('T')[0] : '',
      assigned_to: task.assignee?.contributor_id || '',
    });
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditingTask(null); setForm(EMPTY_FORM); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const body = {
        title:       form.title,
        description: form.description || null,
        priority:    form.priority,
        due_date:    form.due_date || null,
        assigned_to: form.assigned_to || null,
        ...(editingTask ? {} : { project_id: projectId, status: 'todo' }),
      };
      if (editingTask) {
        await apiClient.put(`/tasks/${editingTask.task_id}`, body);
      } else {
        await apiClient.post('/tasks/', body);
      }
      closeForm();
      fetchProject();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (taskId) => {
    if (!window.confirm('Delete this task?')) return;
    await apiClient.delete(`/tasks/${taskId}`);
    fetchProject();
  };

  const cycleStatus = async (task) => {
    const idx  = STATUS_ORDER.indexOf(task.status);
    const next = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
    try {
      await apiClient.put(`/tasks/${task.task_id}`, { status: next });
      fetchProject();
    } catch (err) {
      console.error('Status update failed:', err);
    }
  };

  const toggleCollapse = (status) =>
    setCollapsed(prev => ({ ...prev, [status]: !prev[status] }));

  const grouped = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = initialTasks.filter(t => t.status === s);
    return acc;
  }, {});

  const todoCount = initialTasks.filter(t => t.status !== 'completed').length;

  return (
    <div className="section-panel" style={{ marginTop: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 15, color: 'var(--text-muted)' }}>
          Tasks
          {todoCount > 0 && (
            <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 600, background: 'var(--accent-bg)', color: 'var(--accent-blue)', borderRadius: 999, padding: '1px 8px' }}>
              {todoCount} open
            </span>
          )}
        </h3>
        <button className="add-btn" onClick={openCreate}>+ New Task</button>
      </div>

      {/* Modal form */}
      {showForm && (
        <TaskForm
          form={form}
          setField={setField}
          editingTask={editingTask}
          contributors={contributors}
          submitting={submitting}
          onSubmit={handleSubmit}
          onClose={closeForm}
        />
      )}

      {/* Grouped list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {STATUS_ORDER.map(status => {
          const meta  = STATUS_META[status];
          const items = grouped[status];
          const isCollapsed = collapsed[status];

          return (
            <div key={status}>
              {/* Group header */}
              <div
                onClick={() => toggleCollapse(status)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', cursor: 'pointer', userSelect: 'none' }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                  {meta.label}
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, background: 'var(--border-color)', color: 'var(--text-muted)', borderRadius: 999, padding: '0px 7px' }}>
                  {items.length}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
                  {isCollapsed ? '▸' : '▾'}
                </span>
              </div>

              {/* Task rows */}
              {!isCollapsed && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 8 }}>
                  {items.length === 0 ? (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 16px', margin: 0 }}>No tasks here.</p>
                  ) : (
                    items.map(task => (
                      <div
                        key={task.task_id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 12px', borderRadius: 8,
                          background: 'var(--bg-white)',
                          border: '1px solid var(--border-color)',
                          transition: 'background 0.1s',
                        }}
                      >
                        {/* Status cycle button */}
                        <button
                          onClick={() => cycleStatus(task)}
                          title="Click to advance status"
                          style={{
                            width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                            border: `2px solid ${meta.color}`,
                            background: status === 'completed' ? meta.color : 'transparent',
                            cursor: 'pointer', padding: 0,
                          }}
                        />

                        {/* Title */}
                        <span style={{
                          flex: 1, fontSize: 13, fontWeight: 600,
                          color: status === 'completed' ? 'var(--text-muted)' : 'var(--text-main)',
                          textDecoration: status === 'completed' ? 'line-through' : 'none',
                        }}>
                          {task.title}
                        </span>

                        {/* Priority */}
                        <span style={{
                          fontSize: 11, padding: '2px 7px', borderRadius: 999,
                          fontWeight: 600, flexShrink: 0,
                          ...PRIORITY_STYLES[task.priority],
                        }}>
                          {task.priority}
                        </span>

                        {/* Due date */}
                        {task.due_date && (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            📅 {formatDate(task.due_date)}
                          </span>
                        )}

                        {/* Assignee */}
                        {task.assignee && (
                          <span style={{
                            fontSize: 11, color: 'var(--accent-blue)',
                            background: 'var(--accent-bg)', padding: '2px 7px',
                            borderRadius: 999, flexShrink: 0, whiteSpace: 'nowrap',
                          }}>
                            👤 {task.assignee.name.split(' ')[0]}
                          </span>
                        )}

                        {/* Status selector — place before Actions */}
                        <select
                          value={task.status}
                          onChange={async (e) => {
                            try {
                              await apiClient.put(`/tasks/${task.task_id}`, { status: e.target.value });
                              fetchProject();
                            } catch (err) { console.error(err); }
                          }}
                          style={{
                            fontSize: 11, borderRadius: 6, border: '1px solid var(--border-color)',
                            padding: '2px 6px', color: 'var(--text-muted)', background: 'var(--bg-white)',
                            cursor: 'pointer', flexShrink: 0,
                          }}
                          onClick={e => e.stopPropagation()}
                        >
                          {STATUS_ORDER.map(s => (
                            <option key={s} value={s}>{STATUS_META[s].label}</option>
                          ))}
                        </select>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <button
                            onClick={() => openEdit(task)}
                            style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: 6, padding: '2px 7px', fontSize: 12, cursor: 'pointer', color: 'var(--text-muted)' }}
                            title="Edit"
                          >✏️</button>
                          <button
                            onClick={() => handleDelete(task.task_id)}
                            style={{ background: 'none', border: '1px solid #fca5a5', borderRadius: 6, padding: '2px 7px', fontSize: 12, cursor: 'pointer', color: '#ef4444' }}
                            title="Delete"
                          >🗑</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}