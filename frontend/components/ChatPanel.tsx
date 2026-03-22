'use client';

import { useState, useRef, useEffect } from 'react';
import type { ChatMessage, TradeResult, WatchlistChange } from '@/types';

interface ChatPanelProps {
  messages: ChatMessage[];
  loading: boolean;
  onSend: (message: string) => void;
  collapsed: boolean;
  onToggle: () => void;
}

function TradeAction({ trade, failed }: { trade: TradeResult; failed?: boolean }) {
  const color = failed ? '#f85149' : trade.side === 'buy' ? '#3fb950' : '#ecad0a';
  return (
    <div
      style={{
        background: '#0d1117',
        border: `1px solid ${color}`,
        borderRadius: '2px',
        padding: '4px 8px',
        fontSize: '10px',
        color: '#e6edf3',
        display: 'flex',
        justifyContent: 'space-between',
        gap: '8px',
      }}
    >
      <span style={{ color, fontWeight: 700 }}>
        {failed ? 'FAILED' : trade.side?.toUpperCase()}
      </span>
      <span>
        {trade.quantity} {trade.ticker}
        {trade.price ? ` @ $${trade.price.toFixed(2)}` : ''}
      </span>
      {failed && trade.reason && (
        <span style={{ color: '#8b949e' }}>{trade.reason}</span>
      )}
    </div>
  );
}

function WatchlistAction({ change }: { change: WatchlistChange }) {
  const color = change.action === 'add' ? '#209dd7' : '#8b949e';
  return (
    <div
      style={{
        background: '#0d1117',
        border: `1px solid ${color}`,
        borderRadius: '2px',
        padding: '4px 8px',
        fontSize: '10px',
        color: '#e6edf3',
        display: 'flex',
        gap: '8px',
      }}
    >
      <span style={{ color, fontWeight: 700 }}>
        {change.action === 'add' ? '+WATCH' : '-WATCH'}
      </span>
      <span>{change.ticker}</span>
    </div>
  );
}

function LoadingDots() {
  return (
    <div style={{ display: 'flex', gap: '4px', padding: '8px' }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: '#8b949e',
            animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        gap: '4px',
        padding: '4px 8px',
      }}
    >
      <div
        style={{
          background: isUser ? '#1a3a4a' : '#1c2128',
          border: `1px solid ${isUser ? '#209dd7' : '#30363d'}`,
          padding: '8px 10px',
          maxWidth: '85%',
          fontSize: '12px',
          color: '#e6edf3',
          lineHeight: '1.5',
          wordBreak: 'break-word',
        }}
      >
        {!isUser && (
          <div style={{ color: '#ecad0a', fontSize: '9px', fontWeight: 700, marginBottom: '4px' }}>
            FINALLY
          </div>
        )}
        <div>{msg.content}</div>
      </div>

      {/* Trade and watchlist actions */}
      {msg.actions && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '85%' }}>
          {msg.actions.trades_executed?.map((t, i) => (
            <TradeAction key={i} trade={t} />
          ))}
          {msg.actions.trades_failed?.map((t, i) => (
            <TradeAction key={i} trade={t} failed />
          ))}
          {msg.actions.watchlist_changes?.map((c, i) => (
            <WatchlistAction key={i} change={c} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ChatPanel({ messages, loading, onSend, collapsed, onToggle }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    onSend(text);
  }

  return (
    <div
      style={{
        background: '#161b22',
        border: '1px solid #30363d',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        width: collapsed ? '40px' : '320px',
        minWidth: collapsed ? '40px' : '320px',
        transition: 'width 0.2s, min-width 0.2s',
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '8px 10px',
          borderBottom: '1px solid #30363d',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          cursor: 'pointer',
        }}
        onClick={onToggle}
      >
        {!collapsed && (
          <span style={{ color: '#8b949e', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
            AI Assistant
          </span>
        )}
        <button
          style={{
            background: 'none',
            border: 'none',
            color: '#8b949e',
            cursor: 'pointer',
            fontSize: '14px',
            padding: '0',
            marginLeft: collapsed ? 'auto' : '0',
            marginRight: collapsed ? 'auto' : '0',
            width: '20px',
          }}
          title={collapsed ? 'Expand chat' : 'Collapse chat'}
        >
          {collapsed ? '»' : '«'}
        </button>
      </div>

      {!collapsed && (
        <>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {messages.length === 0 && (
              <div
                style={{
                  padding: '16px',
                  color: '#8b949e',
                  fontSize: '11px',
                  textAlign: 'center',
                  lineHeight: '1.6',
                }}
              >
                Ask me about your portfolio, market trends, or say &quot;buy 10 AAPL&quot;.
              </div>
            )}
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
            {loading && (
              <div style={{ padding: '0 8px' }}>
                <LoadingDots />
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div
            style={{
              padding: '8px',
              borderTop: '1px solid #30363d',
              display: 'flex',
              gap: '6px',
              flexShrink: 0,
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask FinAlly..."
              disabled={loading}
              style={{
                flex: 1,
                background: '#0d1117',
                border: '1px solid #30363d',
                color: '#e6edf3',
                padding: '6px 8px',
                fontSize: '12px',
                outline: 'none',
              }}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              style={{
                background: '#753991',
                border: 'none',
                color: '#ffffff',
                padding: '0 12px',
                height: '32px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: loading ? 'wait' : 'pointer',
                opacity: (!input.trim() || loading) ? 0.5 : 1,
              }}
            >
              Send
            </button>
          </div>
        </>
      )}
    </div>
  );
}
