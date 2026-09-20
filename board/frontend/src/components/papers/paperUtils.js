// src/components/papers/paperUtils.js
//
// NOTE: papers have no reading "status" — reading progress is `is_read` /
// `date_read` (see PaperRow) and `papers.status` belongs to the AI enrichment
// pipeline, so it is not surfaced in the UI.

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

// `document_type` stores Zotero's own item type (camelCase), so the labels are
// Zotero's vocabulary rather than a normalised one.
const DOCUMENT_TYPE_LABELS = {
  artwork:             'Artwork',
  audioRecording:      'Audio Recording',
  bill:                'Bill',
  blogPost:            'Blog Post',
  book:                'Book',
  bookSection:         'Book Section',
  case:                'Case',
  conferencePaper:     'Conference Paper',
  dataset:             'Dataset',
  dictionaryEntry:     'Dictionary Entry',
  document:            'Document',
  email:               'E-mail',
  encyclopediaArticle: 'Encyclopedia Article',
  film:                'Film',
  forumPost:           'Forum Post',
  hearing:             'Hearing',
  instantMessage:      'Instant Message',
  interview:           'Interview',
  journalArticle:      'Journal Article',
  letter:              'Letter',
  magazineArticle:     'Magazine Article',
  manuscript:          'Manuscript',
  map:                 'Map',
  newspaperArticle:    'Newspaper Article',
  patent:              'Patent',
  podcast:             'Podcast',
  preprint:            'Preprint',
  presentation:        'Presentation',
  radioBroadcast:      'Radio Broadcast',
  report:              'Report',
  software:            'Software',
  standard:            'Standard',
  statute:             'Statute',
  thesis:              'Thesis',
  tvBroadcast:         'TV Broadcast',
  videoRecording:      'Video Recording',
  webpage:             'Web Page',
  other:               'Other',
};

export function formatDocType(type) {
  if (!type) return '—';
  if (DOCUMENT_TYPE_LABELS[type]) return DOCUMENT_TYPE_LABELS[type];
  // Unknown/new Zotero type: "audioRecording" -> "Audio Recording"
  return type
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, c => c.toUpperCase());
}