// src/utils/date.js
//
// Single source of truth for dates in the UI.
// Display format is always DD/MM/YYYY (day first), and values are parsed from
// their ISO prefix so a timezone conversion can never shift the day.

const ISO_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;

/** Parse any API date value into { day, month, year } numbers. */
export function parseDateParts(value) {
  if (!value) return null;

  const match = ISO_PREFIX.exec(String(value));
  if (match) {
    return { year: +match[1], month: +match[2], day: +match[3] };
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return {
    year: parsed.getUTCFullYear(),
    month: parsed.getUTCMonth() + 1,
    day: parsed.getUTCDate(),
  };
}

/** "14/09/2026" — empty string when there is no date. */
export function formatDate(value) {
  const parts = parseDateParts(value);
  if (!parts) return '';
  const dd = String(parts.day).padStart(2, '0');
  const mm = String(parts.month).padStart(2, '0');
  return `${dd}/${mm}/${parts.year}`;
}

/** Today as editable { day, month, year } strings. */
export function todayFields() {
  const now = new Date();
  return {
    day: String(now.getDate()),
    month: String(now.getMonth() + 1),
    year: String(now.getFullYear()),
  };
}

/** API date -> editable { day, month, year } strings. */
export function dateToFields(value) {
  const parts = parseDateParts(value);
  if (!parts) return { day: '', month: '', year: '' };
  return {
    day: String(parts.day),
    month: String(parts.month),
    year: String(parts.year),
  };
}

export function isCompleteDate({ day, month, year } = {}) {
  return Boolean(day && month && year);
}

/** { day, month, year } -> "YYYY-MM-DD" (calendar dates such as papers.date_read). */
export function fieldsToDateString(fields) {
  if (!isCompleteDate(fields)) return null;
  const mm = String(fields.month).padStart(2, '0');
  const dd = String(fields.day).padStart(2, '0');
  return `${fields.year}-${mm}-${dd}`;
}

/** { day, month, year } -> "YYYY-MM-DDT00:00:00Z" (timestamps such as meetings). */
export function fieldsToTimestamp(fields) {
  const date = fieldsToDateString(fields);
  return date ? `${date}T00:00:00Z` : null;
}

/** Whole days between an API date and today (negative = in the future). */
export function daysAgo(value) {
  const parts = parseDateParts(value);
  if (!parts) return null;

  const then = Date.UTC(parts.year, parts.month - 1, parts.day);
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((today - then) / 86400000);
}

/** "today" / "yesterday" / "12d ago" / "in 3d". */
export function formatRelativeDays(value) {
  const diff = daysAgo(value);
  if (diff === null) return '';
  if (diff === 0) return 'today';
  if (diff === 1) return 'yesterday';
  if (diff < 0) return `in ${-diff}d`;
  return `${diff}d ago`;
}

/** Percentage change between two periods; null when there is no baseline. */
export function percentChange(current, previous) {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}
