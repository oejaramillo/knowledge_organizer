// src/hooks/useReadingStats.js
//
// Keeps the reading summary live:
//   * loads once on mount;
//   * polls on an interval **while the tab is visible** (a background tab costs
//     nothing — important with a serverless Postgres that bills compute time);
//   * refreshes immediately when the tab becomes visible or the window is focused.
//
// The previous snapshot stays on screen while a refresh is in flight, so the
// page never flickers or collapses to a spinner.

import { useCallback, useEffect, useRef, useState } from 'react';
import apiClient from '../api/client';

export const AUTO_REFRESH_MS = 30_000;

export default function useReadingStats() {
  const [stats, setStats]           = useState(null);
  const [error, setError]           = useState(null);
  const [loading, setLoading]       = useState(true);   // first load only
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt]   = useState(null);
  const [isVisible, setIsVisible]   = useState(
    () => typeof document === 'undefined' || document.visibilityState !== 'hidden'
  );
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return;      // never stack requests
    inFlight.current = true;
    setRefreshing(true);

    try {
      const { data } = await apiClient.get('/stats/');
      setStats(data);
      setUpdatedAt(new Date());
      setError(null);
    } catch (err) {
      // Keep the last good snapshot on screen; just report the failure.
      setError(
        err.response?.data?.detail ||
        err.message ||
        'Could not load reading stats'
      );
    } finally {
      inFlight.current = false;
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  // Track tab visibility
  useEffect(() => {
    const onVisibility = () => setIsVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Poll only while visible; catch up as soon as we are visible again
  useEffect(() => {
    if (!isVisible) return undefined;

    load();
    const intervalId = setInterval(load, AUTO_REFRESH_MS);
    return () => clearInterval(intervalId);
  }, [isVisible, load]);

  // Coming back to the window also refreshes
  useEffect(() => {
    const onFocus = () => { if (isVisible) load(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [isVisible, load]);

  return { stats, error, loading, refreshing, updatedAt, refresh: load };
}
