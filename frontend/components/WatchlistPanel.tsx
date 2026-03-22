'use client';

import { useState, useEffect, useRef } from 'react';
import type { WatchlistEntry, PriceUpdate } from '@/types';
import Sparkline from './Sparkline';

interface WatchlistPanelProps {
  watchlist: WatchlistEntry[];
  prices: Record<string, PriceUpdate>;
  sparklines: Record<string, number[]>;
  selectedTicker: string | null;
  onSelectTicker: (ticker: string) => void;
  onAddTicker: (ticker: string) => Promise<string | null>;
  onRemoveTicker: (ticker: string) => void;
}

function formatPrice(price: number | null) {
  if (price == null) return '—';
  return price.toFixed(2);
}

function formatChange(pct: number | null) {
  if (pct == null) return '—';
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

function WatchlistRow({
  entry,
  livePrice,
  sparklineData,
  selected,
  onSelect,
  onRemove,
}: {
  entry: WatchlistEntry;
  livePrice: PriceUpdate | undefined;
  sparklineData: number[];
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const price = livePrice?.price ?? entry.price;
  const changePct = livePrice?.change_percent ?? entry.change_percent;
  const direction = livePrice?.direction ?? entry.direction;

  const prevPriceRef = useRef<number | null>(null);
  const [flashClass, setFlashClass] = useState('');

  useEffect(() => {
    if (price == null) return;
    if (prevPriceRef.current !== null && prevPriceRef.current !== price) {
      const cls = direction === 'up' ? 'flash-up' : direction === 'down' ? 'flash-down' : '';
      if (cls) {
        setFlashClass(cls);
        const timer = setTimeout(() => setFlashClass(''), 550);
        return () => clearTimeout(timer);
      }
    }
    prevPriceRef.current = price;
  }, [price, direction]);

  const changeColor = direction === 'up' ? '#3fb950' : direction === 'down' ? '#f85149' : '#8b949e';
  const sparkColor = direction === 'up' ? '#3fb950' : direction === 'down' ? '#f85149' : '#209dd7';

  return (
    <div
      className={flashClass}
      onClick={onSelect}
      style={{
        display: 'grid',
        gridTemplateColumns: '70px 70px 60px 85px 20px',
        alignItems: 'center',
        gap: '4px',
        padding: '5px 8px',
        cursor: 'pointer',
        borderBottom: '1px solid #21262d',
        background: selected ? 'rgba(32, 157, 215, 0.12)' : 'transparent',
        borderLeft: selected ? '2px solid #209dd7' : '2px solid transparent',
        transition: 'background 0.15s',
      }}
    >
      <span style={{ color: '#ecad0a', fontWeight: 700, fontSize: '12px' }}>{entry.ticker}</span>
      <span style={{ color: '#e6edf3', fontSize: '12px', textAlign: 'right' }}>
        {formatPrice(price)}
      </span>
      <span style={{ color: changeColor, fontSize: '11px', textAlign: 'right' }}>
        {formatChange(changePct)}
      </span>
      <Sparkline data={sparklineData} width={80} height={22} color={sparkColor} />
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        style={{
          background: 'none',
          border: 'none',
          color: '#8b949e',
          cursor: 'pointer',
          fontSize: '14px',
          padding: '0',
          lineHeight: 1,
        }}
        title="Remove ticker"
      >
        x
      </button>
    </div>
  );
}

export default function WatchlistPanel({
  watchlist,
  prices,
  sparklines,
  selectedTicker,
  onSelectTicker,
  onAddTicker,
  onRemoveTicker,
}: WatchlistPanelProps) {
  const [addInput, setAddInput] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  async function handleAdd() {
    const ticker = addInput.trim().toUpperCase();
    if (!ticker) return;
    setAdding(true);
    setAddError(null);
    const err = await onAddTicker(ticker);
    if (err) {
      setAddError(err);
    } else {
      setAddInput('');
    }
    setAdding(false);
  }

  return (
    <div
      style={{
        background: '#161b22',
        border: '1px solid #30363d',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minHeight: 0,
      }}
    >
      <div
        style={{
          padding: '8px 10px',
          borderBottom: '1px solid #30363d',
          color: '#8b949e',
          fontSize: '10px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '1px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>Watchlist</span>
        <span style={{ color: '#30363d' }}>{watchlist.length} tickers</span>
      </div>

      {/* Column headers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '70px 70px 60px 85px 20px',
          gap: '4px',
          padding: '3px 8px',
          borderBottom: '1px solid #30363d',
          color: '#8b949e',
          fontSize: '9px',
          textTransform: 'uppercase',
        }}
      >
        <span>Symbol</span>
        <span style={{ textAlign: 'right' }}>Price</span>
        <span style={{ textAlign: 'right' }}>Chg%</span>
        <span style={{ textAlign: 'right' }}>Trend</span>
        <span />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {watchlist.map((entry) => (
          <WatchlistRow
            key={entry.ticker}
            entry={entry}
            livePrice={prices[entry.ticker]}
            sparklineData={sparklines[entry.ticker] ?? []}
            selected={selectedTicker === entry.ticker}
            onSelect={() => onSelectTicker(entry.ticker)}
            onRemove={() => onRemoveTicker(entry.ticker)}
          />
        ))}
      </div>

      {/* Add ticker */}
      <div style={{ padding: '8px', borderTop: '1px solid #30363d' }}>
        {addError && (
          <div style={{ color: '#f85149', fontSize: '10px', marginBottom: '4px' }}>{addError}</div>
        )}
        <div style={{ display: 'flex', gap: '4px' }}>
          <input
            type="text"
            value={addInput}
            onChange={(e) => setAddInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Add ticker..."
            style={{
              flex: 1,
              background: '#0d1117',
              border: '1px solid #30363d',
              color: '#e6edf3',
              padding: '5px 8px',
              fontSize: '11px',
              outline: 'none',
            }}
          />
          <button
            onClick={handleAdd}
            disabled={adding}
            style={{
              background: '#209dd7',
              border: 'none',
              color: '#0d1117',
              padding: '5px 10px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: adding ? 'wait' : 'pointer',
            }}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
