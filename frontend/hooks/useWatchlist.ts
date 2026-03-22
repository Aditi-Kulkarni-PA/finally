'use client';

import { useState, useEffect, useCallback } from 'react';
import type { WatchlistEntry } from '@/types';

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);

  const fetchWatchlist = useCallback(async () => {
    try {
      const res = await fetch('/api/watchlist');
      if (res.ok) {
        const data = await res.json();
        setWatchlist(data);
      }
    } catch {
      // network error — keep previous state
    }
  }, []);

  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  const addTicker = useCallback(
    async (ticker: string): Promise<string | null> => {
      try {
        const res = await fetch('/api/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker }),
        });
        if (res.ok) {
          await fetchWatchlist();
          return null;
        } else {
          const data = await res.json();
          return data.detail ?? 'Failed to add ticker';
        }
      } catch {
        return 'Network error';
      }
    },
    [fetchWatchlist]
  );

  const removeTicker = useCallback(
    async (ticker: string): Promise<void> => {
      try {
        await fetch(`/api/watchlist/${ticker}`, { method: 'DELETE' });
        await fetchWatchlist();
      } catch {
        // network error
      }
    },
    [fetchWatchlist]
  );

  return { watchlist, fetchWatchlist, addTicker, removeTicker };
}
