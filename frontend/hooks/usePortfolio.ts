'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Portfolio, PortfolioSnapshot } from '@/types';

const DEFAULT_PORTFOLIO: Portfolio = {
  cash_balance: 0,
  positions: [],
  total_value: 0,
};

export function usePortfolio() {
  const [portfolio, setPortfolio] = useState<Portfolio>(DEFAULT_PORTFOLIO);
  const [history, setHistory] = useState<PortfolioSnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPortfolio = useCallback(async () => {
    try {
      const res = await fetch('/api/portfolio');
      if (res.ok) {
        const data = await res.json();
        setPortfolio(data);
      }
    } catch {
      // network error — keep previous state
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/portfolio/history');
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch {
      // network error — keep previous state
    }
  }, []);

  useEffect(() => {
    fetchPortfolio();
    fetchHistory();

    const interval = setInterval(() => {
      fetchPortfolio();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchPortfolio, fetchHistory]);

  const executeTrade = useCallback(
    async (ticker: string, quantity: number, side: 'buy' | 'sell'): Promise<string | null> => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/portfolio/trade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker, quantity, side }),
        });
        if (res.ok) {
          await fetchPortfolio();
          await fetchHistory();
          return null;
        } else {
          const data = await res.json();
          const msg = data.detail ?? 'Trade failed';
          setError(msg);
          return msg;
        }
      } catch {
        const msg = 'Network error';
        setError(msg);
        return msg;
      } finally {
        setLoading(false);
      }
    },
    [fetchPortfolio, fetchHistory]
  );

  return { portfolio, history, loading, error, fetchPortfolio, fetchHistory, executeTrade };
}
