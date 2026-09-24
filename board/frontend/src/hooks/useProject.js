// src/hooks/useProject.js
//
// Loads a project and keeps the UI consistent while you switch between them.
//
// Two problems this solves:
//
// 1. **Stale responses.** Switching A → B fired two requests; if A's response
//    landed last it overwrote B's data, so the page showed the wrong project
//    until a manual refresh. Every request carries a sequence number and only
//    the newest one is allowed to update state.
// 2. **Repeated latency.** Each project costs several queries against a remote
//    database. Projects you already opened are cached for the session, so going
//    back renders instantly and revalidates in the background.

import { useCallback, useEffect, useRef, useState } from 'react';
import apiClient from '../api/client';

// project_id -> payload, for this browser session only.
const cache = new Map();

/** Drop a cached project (after a mutation, or when it was deleted). */
export function invalidateProject(projectId) {
  cache.delete(projectId);
}

export function clearProjectCache() {
  cache.clear();
}

/** State for a given project, read from the cache when it is there. */
function snapshotFor(projectId) {
  const hit = cache.get(projectId) ?? null;
  return { projectId, project: hit, loading: !hit, error: null };
}

export default function useProject(projectId) {
  // The cache is read synchronously so the very first render after switching
  // already shows the right project. Resetting this in an effect would paint
  // one frame with the *previous* project's data still in state.
  const [state, setState] = useState(() => snapshotFor(projectId));
  const requestSeq = useRef(0);

  if (state.projectId !== projectId) {
    setState(snapshotFor(projectId));   // render-phase reset (no stale frame)
  }

  const load = useCallback(async ({ quiet = false } = {}) => {
    const seq = ++requestSeq.current;
    if (!quiet) {
      setState(s => (s.projectId === projectId ? { ...s, loading: true } : s));
    }

    try {
      const { data } = await apiClient.get(`/projects/${projectId}`);
      if (seq !== requestSeq.current) return;   // a newer request won
      cache.set(projectId, data);
      setState(s => (s.projectId === projectId
        ? { projectId, project: data, loading: false, error: null }
        : s));
    } catch (err) {
      if (seq !== requestSeq.current) return;
      const message = err.response?.data?.detail || err.message || 'Could not load this project';
      setState(s => (s.projectId === projectId
        ? { ...s, loading: false, error: message }
        : s));
    }
  }, [projectId]);

  // Every project selection revalidates, cached or not.
  useEffect(() => {
    load({ quiet: Boolean(cache.get(projectId)) });
  }, [projectId, load]);

  // Refresh after a mutation (always quiet: the current view stays on screen)
  const reload = useCallback(() => load({ quiet: true }), [load]);

  return {
    project: state.project,
    loading: state.loading,
    error: state.error,
    reload,
  };
}
