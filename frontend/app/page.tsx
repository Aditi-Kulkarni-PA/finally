'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import WatchlistPanel from '@/components/WatchlistPanel';
import MainChart from '@/components/MainChart';
import PortfolioHeatmap from '@/components/PortfolioHeatmap';
import PnLChart from '@/components/PnLChart';
import PositionsTable from '@/components/PositionsTable';
import TradeBar from '@/components/TradeBar';
import ChatPanel from '@/components/ChatPanel';
import { usePriceStream } from '@/hooks/usePriceStream';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useWatchlist } from '@/hooks/useWatchlist';
import { useChat } from '@/hooks/useChat';

export default function Home() {
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [chatCollapsed, setChatCollapsed] = useState(false);

  const { prices, sparklines, status } = usePriceStream();
  const { portfolio, history, executeTrade, fetchPortfolio } = usePortfolio();
  const { watchlist, addTicker, removeTicker, fetchWatchlist } = useWatchlist();
  const { messages, loading: chatLoading, sendMessage } = useChat(fetchPortfolio);

  async function handleRemoveTicker(ticker: string) {
    await removeTicker(ticker);
    if (selectedTicker === ticker) setSelectedTicker(null);
  }

  async function handleAddTicker(ticker: string) {
    const err = await addTicker(ticker);
    return err;
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        background: '#0d1117',
      }}
    >
      <Header portfolio={portfolio} status={status} />

      {/* Main layout: watchlist | center | chat */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
          gap: '2px',
          padding: '2px',
          minHeight: 0,
        }}
      >
        {/* Left: Watchlist */}
        <div
          style={{
            width: '305px',
            minWidth: '305px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <WatchlistPanel
            watchlist={watchlist}
            prices={prices}
            sparklines={sparklines}
            selectedTicker={selectedTicker}
            onSelectTicker={setSelectedTicker}
            onAddTicker={handleAddTicker}
            onRemoveTicker={handleRemoveTicker}
          />
        </div>

        {/* Center: Chart + Portfolio */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            overflow: 'hidden',
            minWidth: 0,
          }}
        >
          {/* Top: Main Chart */}
          <div style={{ flex: '1 1 40%', minHeight: 0 }}>
            <MainChart
              ticker={selectedTicker}
              prices={prices}
              sparklines={sparklines}
            />
          </div>

          {/* Middle: Heatmap + PnL Chart side by side */}
          <div
            style={{
              display: 'flex',
              gap: '2px',
              flex: '1 1 28%',
              minHeight: 0,
            }}
          >
            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
              <PortfolioHeatmap
                positions={portfolio.positions}
                totalValue={portfolio.total_value}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
              <PnLChart history={history} />
            </div>
          </div>

          {/* Bottom: Positions + Trade bar */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              flex: '0 0 auto',
            }}
          >
            <div style={{ maxHeight: '160px', overflow: 'hidden' }}>
              <PositionsTable positions={portfolio.positions} prices={prices} />
            </div>
            <TradeBar
              selectedTicker={selectedTicker}
              onTrade={async (ticker, qty, side) => {
                const err = await executeTrade(ticker, qty, side);
                if (!err) await fetchWatchlist();
                return err;
              }}
            />
          </div>
        </div>

        {/* Right: Chat Panel */}
        <ChatPanel
          messages={messages}
          loading={chatLoading}
          onSend={sendMessage}
          collapsed={chatCollapsed}
          onToggle={() => setChatCollapsed((c) => !c)}
        />
      </div>
    </div>
  );
}
