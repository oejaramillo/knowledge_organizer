import React from 'react';
import { PRIORITY_STYLES, iconBtnStyle } from './taskUtils';

export default function TaskCard({ task, dragging, onDragStart, onDragEnd, onEdit, onDelete }) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(task.task_id)}
      onDragEnd={onDragEnd}
      style={{
        background: 'var(--bg-white)',
        border: '1px solid var(--border-color)',
        borderRadius: 8,
        padding: '10px 12px',
        cursor: 'grab',
        boxShadow: dragging ? '0 4px 16px rgba(0,0,0,0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
        opacity: dragging ? 0.5 : 1,
        transition: 'box-shadow 0.15s',
      }}
    >
      {/* Title */}
      <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, lineHeight: 1.4, color: 'var(--text-main)' }}>
        {task.title}
      </p>

      {/* Description */}
      {task.description && (
        <p style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
          {task.description}
        </p>
      )}

      {/* Meta row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
        <span style={{
          fontSize: 11, padding: '2px 7px', borderRadius: 999,
          fontWeight: 600, ...PRIORITY_STYLES[task.priority],
        }}>
          {task.priority}
        </span>

        {task.due_date && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            📅 {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}

        {task.assignee && (
          <span style={{
            fontSize: 11, color: 'var(--accent-blue)',
            background: 'var(--accent-bg)', padding: '2px 7px',
            borderRadius: 999, marginLeft: 'auto',
          }}>
            👤 {task.assignee.name.split(' ')[0]}
          </span>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
        <button onClick={() => onEdit(task)} style={iconBtnStyle} title="Edit">✏️</button>
        <button onClick={() => onDelete(task.task_id)} style={{ ...iconBtnStyle, color: '#ef4444' }} title="Delete">🗑</button>
      </div>
    </div>
  );
}