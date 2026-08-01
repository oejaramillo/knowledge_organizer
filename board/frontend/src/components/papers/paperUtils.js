// src/components/papers/paperUtils.js

export const STATUS_OPTIONS = [
  { value: 'unread',     label: 'Unread' },
  { value: 'reading',    label: 'Reading' },
  { value: 'read',       label: 'Read' },
  { value: 'processed',  label: 'Processed' },
  { value: 'archived',   label: 'Archived' },
];

export const DOCUMENT_TYPES = [
  'journal_article', 'book', 'book_chapter', 'working_paper',
  'dissertation', 'report', 'policy_document', 'historical_document', 'other',
];

export const CLAIM_TYPES = [
  { value: 'empirical',      label: 'Empirical',      color: '#3b82f6' },
  { value: 'theoretical',    label: 'Theoretical',    color: '#8b5cf6' },
  { value: 'conceptual',     label: 'Conceptual',     color: '#06b6d4' },
  { value: 'historical',     label: 'Historical',     color: '#f59e0b' },
  { value: 'normative',      label: 'Normative',      color: '#ef4444' },
  { value: 'methodological', label: 'Methodological', color: '#22c55e' },
];

export const DIRECTION_OPTIONS = ['positive', 'negative', 'null', 'mixed', 'unclear'];

export const ANNOTATION_COLORS = {
  yellow: { bg: '#fef9c3', text: '#854d0e', border: '#fde047' },
  red:    { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
  green:  { bg: '#dcfce7', text: '#166534', border: '#86efac' },
  blue:   { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
  purple: { bg: '#ede9fe', text: '#5b21b6', border: '#c4b5fd' },
};

export function statusBadgeStyle(status) {
  const map = {
    unread:    { background: '#f1f5f9', color: '#64748b' },
    reading:   { background: '#fef9c3', color: '#ca8a04' },
    read:      { background: '#dcfce7', color: '#16a34a' },
    processed: { background: '#dbeafe', color: '#2563eb' },
    archived:  { background: '#e2e8f0', color: '#475569' },
  };
  return map[status] || map.unread;
}

export function claimTypeStyle(claimType) {
  const found = CLAIM_TYPES.find(c => c.value === claimType);
  return found ? { background: found.color + '20', color: found.color } : {};
}

export function formatAuthors(authors = []) {
  if (!authors.length) return 'Unknown';
  // authors are flat AuthorResponse objects — no nested .author
  if (authors.length === 1) return authors[0].full_name ?? 'Unknown';
  if (authors.length === 2)
    return authors.map(a => a.last_name ?? a.full_name).join(' & ');
  return (authors[0].last_name ?? authors[0].full_name) + ' et al.';
}

export function formatDocType(type) {
  const map = {
    journal_article:    'Article',
    book:               'Book',
    book_chapter:       'Chapter',
    working_paper:      'Working Paper',
    dissertation:       'Dissertation',
    report:             'Report',
    policy_document:    'Policy Doc',
    historical_document:'Historical',
    other:              'Other',
  };
  return map[type] || type;
}