// src/utils/syncSummary.js
//
// Turns the summary line emitted by zotero_sync/sync.py into the one-line
// message shown after a sync. Reporting only "completed" hid a silent no-op
// sync (the Zotero local API ignored the `since` cursor), so the counts matter.

const SYNC_LABELS = {
  projects:    'collections',
  papers:      'papers',
  authors:     'author lists',
  attachments: 'attachments',
  annotations: 'annotations',
};

/** Human-readable one-liner for a sync result. */
export function describeSync(summary) {
  if (!summary) return '✅ Zotero sync completed';

  const parts = Object.entries(summary.counts || {})
    .filter(([, count]) => count > 0)
    .map(([step, count]) => {
      const label = SYNC_LABELS[step] || step;
      const noun = count === 1 && label.endsWith('s') ? label.slice(0, -1) : label;
      return `${count} ${noun}`;
    });

  if (parts.length === 0) {
    return summary.mode === 'up-to-date'
      ? '✅ Zotero sync — already up to date'
      : '✅ Zotero sync completed — nothing new';
  }

  return `✅ Synced ${parts.join(' · ')}`;
}
