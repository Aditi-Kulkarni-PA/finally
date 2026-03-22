'use client';

import { useState, useEffect, useRef } from 'react';
import type { PriceUpdate, ConnectionStatus } from '@/types';

const MAX_SPARKLINE_POINTS = 60;

export function usePriceStream() {
  const [prices, setPrices] = useState<Record<string, PriceUpdate>>({});
  const [sparklines, setSparklines] = useState<Record<string, number[]>>({});
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    function connect() {
      const es = new EventSource('/api/stream/prices');
      esRef.current = es;

      es.onopen = () => setStatus('connected');

      es.onmessage = (event) => {
        try {
          const snapshot: Record<string, PriceUpdate> = JSON.parse(event.data);
          setPrices(snapshot);
          setSparklines((prev) => {
            const next = { ...prev };
            for (const ticker of Object.keys(snapshot)) {
              const prevPoints = next[ticker] ?? [];
              const updated = [...prevPoints, snapshot[ticker].price];
              next[ticker] = updated.slice(-MAX_SPARKLINE_POINTS);
            }
            return next;
          });
        } catch {
          // ignore malformed events
        }
      };

      es.onerror = () => {
        setStatus('reconnecting');
        // EventSource auto-retries; we just reflect the state
      };
    }

    connect();

    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, []);

  return { prices, sparklines, status };
}
