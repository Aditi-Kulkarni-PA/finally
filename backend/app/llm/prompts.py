"""System prompt and portfolio context builder for the LLM."""

from __future__ import annotations

SYSTEM_PROMPT = """You are FinAlly, an AI trading assistant for a simulated portfolio.

You analyze portfolio composition, risk concentration, and P&L. You suggest and execute trades when asked. You manage the watchlist proactively.

Always respond with valid JSON matching this schema:
{
  "message": "Your conversational response",
  "trades": [{"ticker": "AAPL", "side": "buy", "quantity": 10}],
  "watchlist_changes": [{"ticker": "PYPL", "action": "add"}]
}

Rules:
- message is required, trades and watchlist_changes default to []
- Be concise and data-driven
- Only execute trades when user explicitly asks or agrees
- Quantities must be positive numbers
"""


def build_portfolio_context(portfolio: dict, watchlist: list) -> str:
    """Format portfolio data as a readable context string for the LLM."""
    cash = portfolio.get("cash_balance", 0.0)
    total = portfolio.get("total_value", 0.0)
    positions = portfolio.get("positions", [])

    lines = [
        f"Cash balance: ${cash:,.2f}",
        f"Total portfolio value: ${total:,.2f}",
    ]

    if positions:
        lines.append("\nOpen positions:")
        for p in positions:
            pnl_sign = "+" if p["unrealized_pnl"] >= 0 else ""
            lines.append(
                f"  {p['ticker']}: {p['quantity']} shares @ avg ${p['avg_cost']:.2f}, "
                f"current ${p['current_price']:.2f}, "
                f"P&L {pnl_sign}{p['unrealized_pnl']:.2f} ({pnl_sign}{p['pnl_pct']:.2f}%)"
            )
    else:
        lines.append("\nNo open positions.")

    if watchlist:
        tickers = [w["ticker"] for w in watchlist]
        lines.append(f"\nWatchlist: {', '.join(tickers)}")

    return "\n".join(lines)
