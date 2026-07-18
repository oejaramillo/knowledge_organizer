import React from 'react';
import TaskCard from './TaskCard';

export default function TaskColumn({ column, tasks, draggingId, onDragStart, onDragEnd, onDrop, onEdit, onDelete }) {
  return (
    <div
      onDragOver={e => e.preventDefault()}
      onDrop={() => onDrop(column.key)}
      style={{
        background: 'var(--bg-main)',
        borderRadius: 10,
        padding: 10,
        minHeight: 120,
        border: draggingId ? '2px dashed var(--border-color)' : '2px solid transparent',
        transition: 'border 0.15s',
      }}
    >
      {/* Column header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: column.color, flexShrink: 0 }} />
        <span style={{
          fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          {column.label}
        </span>
        <span style={{
          marginLeft: 'auto', fontSize: 11, fontWeight: 600,
          background: 'var(--border-color)', color: 'var(--text-muted)',
          borderRadius: 999, padding: '1px 7px',
        }}>
          {tasks.length}
        </span>
      </div>

      {/* Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tasks.map(task => (
          <TaskCard
            key={task.task_id}
            task={task}
            dragging={draggingId === task.task_id}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
        {tasks.length === 0 && (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0', margin: 0 }}>
            Drop here
          </p>
        )}
      </div>
    </div>
  );
}