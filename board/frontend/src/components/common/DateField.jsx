// src/components/common/DateField.jsx
//
// DD/MM/YYYY date input built from three numeric fields. The native
// <input type="date"> renders in the browser locale (MM/DD/YYYY in en-US), so
// the app uses this component everywhere a date is entered.

import React from 'react';
import { isCompleteDate } from '../../utils/date';

const inputStyle = {
  fontSize: 12,
  padding: '4px 6px',
  borderRadius: 6,
  border: '1px solid var(--border-color)',
  background: 'var(--bg-white)',
  color: 'var(--text-main)',
  textAlign: 'center',
};

export default function DateField({
  value = { day: '', month: '', year: '' },
  onChange,
  disabled = false,
  hint,
  autoFocus = false,
}) {
  const set = (field) => (e) => onChange({ ...value, [field]: e.target.value });

  const onKeyDown = (e) => {
    if (e.key === 'Enter') e.preventDefault();
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <input
        type="number" inputMode="numeric" placeholder="DD" min="1" max="31"
        aria-label="Day"
        value={value.day} onChange={set('day')} onKeyDown={onKeyDown}
        disabled={disabled} autoFocus={autoFocus}
        style={{ ...inputStyle, width: 54 }}
      />
      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>/</span>
      <input
        type="number" inputMode="numeric" placeholder="MM" min="1" max="12"
        aria-label="Month"
        value={value.month} onChange={set('month')} onKeyDown={onKeyDown}
        disabled={disabled}
        style={{ ...inputStyle, width: 54 }}
      />
      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>/</span>
      <input
        type="number" inputMode="numeric" placeholder="YYYY" min="1900" max="2100"
        aria-label="Year"
        value={value.year} onChange={set('year')} onKeyDown={onKeyDown}
        disabled={disabled}
        style={{ ...inputStyle, width: 70 }}
      />
      {hint && (
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{hint}</span>
      )}
      {!hint && !isCompleteDate(value) && (
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>DD/MM/YYYY</span>
      )}
    </div>
  );
}
