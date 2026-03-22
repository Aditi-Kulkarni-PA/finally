export interface PriceUpdate {
  ticker: string;
  price: number;
  previous_price: number;
  timestamp: number;
  change: number;
  change_percent: number;
  direction: "up" | "down" | "flat";
}

export interface Position {
  ticker: string;
  quantity: number;
  avg_cost: number;
  current_price: number;
  unrealized_pnl: number;
  pnl_pct: number;
}

export interface Portfolio {
  cash_balance: number;
  positions: Position[];
  total_value: number;
}

export interface PortfolioSnapshot {
  total_value: number;
  recorded_at: string;
}

export interface WatchlistEntry {
  ticker: string;
  price: number | null;
  previous_price: number | null;
  change: number | null;
  change_percent: number | null;
  direction: "up" | "down" | "flat" | null;
}

export interface TradeResult {
  ticker: string;
  side: "buy" | "sell";
  quantity: number;
  price?: number;
  status?: string;
  reason?: string;
}

export interface WatchlistChange {
  ticker: string;
  action: "add" | "remove";
  status?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: {
    trades_executed?: TradeResult[];
    trades_failed?: TradeResult[];
    watchlist_changes?: WatchlistChange[];
  } | null;
  created_at: string;
}

export interface ChatResponse {
  message: string;
  trades_executed: TradeResult[];
  trades_failed: TradeResult[];
  watchlist_changes: WatchlistChange[];
}

export type ConnectionStatus = "connected" | "reconnecting" | "disconnected";
