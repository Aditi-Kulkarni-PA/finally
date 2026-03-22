'use client';

import { useState } from 'react';

interface TradeBarProps {
  selectedTicker: string | null;
  onTrade: (ticker: string, quantity: number, side: 'buy' | 'sell') => Promise<string | null>;
}

export default function TradeBar({ selectedTicker, onTrade }: TradeBarProps) {
  const [ticker, setTicker] = useState('');
  const [quantity, setQuantity] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Sync ticker input with selected ticker from watchlist
  const effectiveTicker = ticker || selectedTicker || '';

  async function handleTrade(side: 'buy' | 'sell') {
    const t = effectiveTicker.trim().toUpperCase();
    const qty = parseFloat(quantity);

    if (!t) { setError('Enter a ticker'); return; }
    if (!qty || qty <= 0) { setError('Enter a positive quantity'); return; }

    setLoading(true);
    setError(null);
    setSuccess(null);

    const err = await onTrade(t, qty, side);
    if (err) {
      setError(err);
    } else {
      setSuccess(`${side.toUpperCase()} ${qty} ${t} executed`);
      setQuantity('');
      setTimeout(() => setSuccess(null), 3000);
    }
    setLoading(false);
  }

  const inputStyle: React.CSSProperties = {
    background: '#0d1117',
    border: '1px solid #30363d',
    color: '#e6edf3',
    padding: '6px 10px',
    fontSize: '12px',
    outline: 'none',
    height: '32px',
  };

  return (
    <div
      style={{
        background: '#161b22',
        border: '1px solid #30363d',
        padding: '8px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        flexShrink: 0,
      }}
    >
      <div style={{ color: '#8b949e', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
        Trade — Market Order
      </div>

      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder={selectedTicker ?? 'Ticker'}
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          style={{ ...inputStyle, width: '80px' }}
        />
        <input
          type="number"
          placeholder="Qty"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleTrade('buy')}
          min="0"
          step="any"
          style={{ ...inputStyle, width: '80px' }}
        />
        <button
          onClick={() => handleTrade('buy')}
          disabled={loading}
          style={{
            background: '#753991',
            border: 'none',
            color: '#ffffff',
            padding: '0 16px',
            height: '32px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: loading ? 'wait' : 'pointer',
            letterSpacing: '1px',
          }}
        >
          BUY
        </button>
        <button
          onClick={() => handleTrade('sell')}
          disabled={loading}
          style={{
            background: '#f85149',
            border: 'none',
            color: '#ffffff',
            padding: '0 16px',
            height: '32px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: loading ? 'wait' : 'pointer',
            letterSpacing: '1px',
          }}
        >
          SELL
        </button>

        {error && (
          <span style={{ color: '#f85149', fontSize: '11px' }}>{error}</span>
        )}
        {success && (
          <span style={{ color: '#3fb950', fontSize: '11px' }}>{success}</span>
        )}
      </div>
    </div>
  );
}
