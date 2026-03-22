'use client';

import type { ConnectionStatus, Portfolio } from '@/types';

interface HeaderProps {
  portfolio: Portfolio;
  status: ConnectionStatus;
}

const STATUS_COLORS: Record<ConnectionStatus, string> = {
  connected: '#3fb950',
  reconnecting: '#ecad0a',
  disconnected: '#f85149',
};

const STATUS_LABELS: Record<ConnectionStatus, string> = {
  connected: 'LIVE',
  reconnecting: 'RECONNECTING',
  disconnected: 'DISCONNECTED',
};

function formatCurrency(value: number) {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

export default function Header({ portfolio, status }: HeaderProps) {
  const pnl = portfolio.total_value - 10000;
  const pnlColor = pnl >= 0 ? '#3fb950' : '#f85149';
  const pnlSign = pnl >= 0 ? '+' : '';

  return (
    <header
      style={{
        background: '#161b22',
        borderBottom: '1px solid #30363d',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        height: '48px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <span style={{ color: '#ecad0a', fontWeight: 700, fontSize: '16px', letterSpacing: '2px' }}>
          FINALLY
        </span>
        <span style={{ color: '#8b949e', fontSize: '11px' }}>AI TRADING WORKSTATION</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <span style={{ color: '#8b949e', fontSize: '10px', textTransform: 'uppercase' }}>Portfolio Value</span>
          <span style={{ color: '#e6edf3', fontSize: '15px', fontWeight: 700 }}>
            {formatCurrency(portfolio.total_value)}
          </span>
        </div>

        <div style={{ width: '1px', height: '32px', background: '#30363d' }} />

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <span style={{ color: '#8b949e', fontSize: '10px', textTransform: 'uppercase' }}>Total P&amp;L</span>
          <span style={{ color: pnlColor, fontSize: '13px', fontWeight: 600 }}>
            {pnlSign}{formatCurrency(pnl)}
          </span>
        </div>

        <div style={{ width: '1px', height: '32px', background: '#30363d' }} />

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <span style={{ color: '#8b949e', fontSize: '10px', textTransform: 'uppercase' }}>Cash</span>
          <span style={{ color: '#e6edf3', fontSize: '13px' }}>
            {formatCurrency(portfolio.cash_balance)}
          </span>
        </div>

        <div style={{ width: '1px', height: '32px', background: '#30363d' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: STATUS_COLORS[status],
              boxShadow: `0 0 4px ${STATUS_COLORS[status]}`,
            }}
          />
          <span style={{ color: STATUS_COLORS[status], fontSize: '10px', fontWeight: 600 }}>
            {STATUS_LABELS[status]}
          </span>
        </div>
      </div>
    </header>
  );
}
