import React, { useState } from 'react';
import TaskForm from './TaskForm';
import TaskColumn from './TaskColumn';
import { COLUMNS, EMPTY_FORM } from './taskUtils';

const API = 'http://localhost:8000';

export default function TaskList({ tasks: initialTasks, projectId, projectContributors }) {
  const [tasks, setTasks]             = useState(initialTasks);
  const [showForm, setShowForm]       = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [submitting, setSubmitting]   = useState(false);
  const [draggingId, setDraggingId]   = useState(null);

  const contributors = (projectContributors ?? []).map(pc => pc.contributor);
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
      const url    = editingTask ? `${API}/api/tasks/${editingTask.task_id}` : `${API}/api/tasks/`;
      const method = editingTask ? 'PUT' : 'POST';
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error('Request failed');
      const saved = await res.json();
      setTasks(prev => editingTask ? prev.map(t => t.task_id === saved.task_id ? saved : t) : [...prev, saved]);
      closeForm();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (taskId) => {
    if (!window.confirm('Delete this task?')) return;
    await fetch(`${API}/api/tasks/${taskId}`, { method: 'DELETE' });
    setTasks(prev => prev.filter(t => t.task_id !== taskId));
  };

  const handleDrop = async (newStatus) => {
    if (!draggingId) return;
    const task = tasks.find(t => t.task_id === draggingId);
    if (!task || task.status === newStatus) { setDraggingId(null); return; }
    const res = await fetch(`${API}/api/tasks/${draggingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      const updated = await res.json();
      setTasks(prev => prev.map(t => t.task_id === draggingId ? updated : t));
    }
    setDraggingId(null);
  };

  return (
    <div className="section-panel" style={{ marginTop: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 15, color: 'var(--text-muted)' }}>Tasks</h3>
        <button className="add-btn" onClick={openCreate}>+ New Task</button>
      </div>

      {/* Modal */}
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

      {/* Kanban */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {COLUMNS.map(col => (
          <TaskColumn
            key={col.key}
            column={col}
            tasks={tasks.filter(t => t.status === col.key)}
            draggingId={draggingId}
            onDragStart={setDraggingId}
            onDragEnd={() => setDraggingId(null)}
            onDrop={handleDrop}
            onEdit={openEdit}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
}