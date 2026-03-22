'use client';

import type { Position } from '@/types';

interface PortfolioHeatmapProps {
  positions: Position[];
  totalValue: number;
}

function getPnLColor(pnlPct: number): string {
  if (pnlPct > 5) return '#2ea043';
  if (pnlPct > 2) return '#3fb950';
  if (pnlPct > 0) return '#56d364';
  if (pnlPct === 0) return '#30363d';
  if (pnlPct > -2) return '#da3633';
  if (pnlPct > -5) return '#f85149';
  return '#ff7b72';
}

/** Simple squarified-like treemap via flex wrapping, sized by weight. */
export default function PortfolioHeatmap({ positions, totalValue }: PortfolioHeatmapProps) {
  if (positions.length === 0) {
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
            padding: '8px 12px',
            borderBottom: '1px solid #30363d',
            color: '#8b949e',
            fontSize: '10px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}
        >
          Portfolio Heatmap
        </div>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#8b949e',
            fontSize: '12px',
          }}
        >
          No positions — buy some stocks to see your heatmap
        </div>
      </div>
    );
  }

  const positionValue = positions.reduce(
    (sum, p) => sum + p.quantity * p.current_price,
    0
  );

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
          padding: '8px 12px',
          borderBottom: '1px solid #30363d',
          color: '#8b949e',
          fontSize: '10px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}
      >
        Portfolio Heatmap
      </div>
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexWrap: 'wrap',
          gap: '2px',
          padding: '4px',
          alignContent: 'flex-start',
          overflow: 'hidden',
        }}
      >
        {positions.map((pos) => {
          const weight = positionValue > 0
            ? (pos.quantity * pos.current_price) / positionValue
            : 1 / positions.length;
          const pct = Math.max(weight * 100, 5); // min 5% wide so tiny positions are visible
          const color = getPnLColor(pos.pnl_pct);
          const textColor = Math.abs(pos.pnl_pct) > 1 ? '#ffffff' : '#e6edf3';

          return (
            <div
              key={pos.ticker}
              style={{
                width: `calc(${pct}% - 2px)`,
                minWidth: '60px',
                flexGrow: weight > 0.15 ? 1 : 0,
                background: color,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px 4px',
                overflow: 'hidden',
                cursor: 'default',
                minHeight: '50px',
              }}
              title={`${pos.ticker}: $${(pos.quantity * pos.current_price).toFixed(0)} (${pos.pnl_pct >= 0 ? '+' : ''}${pos.pnl_pct.toFixed(2)}%)`}
            >
              <span style={{ color: textColor, fontWeight: 700, fontSize: '12px' }}>
                {pos.ticker}
              </span>
              <span style={{ color: textColor, fontSize: '10px' }}>
                {pos.pnl_pct >= 0 ? '+' : ''}{pos.pnl_pct.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
      <div
        style={{
          padding: '4px 12px',
          borderTop: '1px solid #30363d',
          color: '#8b949e',
          fontSize: '10px',
        }}
      >
        Total invested: ${positionValue.toFixed(2)} &nbsp;|&nbsp; {positions.length} positions
      </div>
    </div>
  );
}
