'use client';

import type { Position, PriceUpdate } from '@/types';

interface PositionsTableProps {
  positions: Position[];
  prices: Record<string, PriceUpdate>;
}

function fmt(n: number, decimals = 2) {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export default function PositionsTable({ positions, prices }: PositionsTableProps) {
  const th: React.CSSProperties = {
    padding: '5px 8px',
    color: '#8b949e',
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase',
    textAlign: 'right',
    borderBottom: '1px solid #30363d',
    whiteSpace: 'nowrap',
  };

  const td: React.CSSProperties = {
    padding: '4px 8px',
    fontSize: '12px',
    textAlign: 'right',
    borderBottom: '1px solid #21262d',
    whiteSpace: 'nowrap',
  };

  return (
    <div
      style={{
        background: '#161b22',
        border: '1px solid #30363d',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
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
          flexShrink: 0,
        }}
      >
        Positions {positions.length > 0 && `(${positions.length})`}
      </div>

      {positions.length === 0 ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#8b949e',
            fontSize: '12px',
            padding: '16px',
          }}
        >
          No open positions
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: 'left' }}>Ticker</th>
                <th style={th}>Qty</th>
                <th style={th}>Avg Cost</th>
                <th style={th}>Current</th>
                <th style={th}>Unr. P&amp;L</th>
                <th style={th}>P&amp;L %</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((pos) => {
                const livePrice = prices[pos.ticker]?.price ?? pos.current_price;
                const liveDirection = prices[pos.ticker]?.direction;
                const livePnl = (livePrice - pos.avg_cost) * pos.quantity;
                const livePnlPct = pos.avg_cost > 0
                  ? ((livePrice - pos.avg_cost) / pos.avg_cost) * 100
                  : 0;
                const pnlColor = livePnl >= 0 ? '#3fb950' : '#f85149';
                const priceColor =
                  liveDirection === 'up' ? '#3fb950'
                  : liveDirection === 'down' ? '#f85149'
                  : '#e6edf3';

                return (
                  <tr key={pos.ticker}>
                    <td style={{ ...td, textAlign: 'left', color: '#ecad0a', fontWeight: 700 }}>
                      {pos.ticker}
                    </td>
                    <td style={{ ...td, color: '#e6edf3' }}>{fmt(pos.quantity, 4)}</td>
                    <td style={{ ...td, color: '#8b949e' }}>${fmt(pos.avg_cost)}</td>
                    <td style={{ ...td, color: priceColor }}>${fmt(livePrice)}</td>
                    <td style={{ ...td, color: pnlColor }}>
                      {livePnl >= 0 ? '+' : ''}${fmt(livePnl)}
                    </td>
                    <td style={{ ...td, color: pnlColor }}>
                      {livePnlPct >= 0 ? '+' : ''}{fmt(livePnlPct)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
