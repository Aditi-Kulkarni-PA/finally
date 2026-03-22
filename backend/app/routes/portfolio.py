"""Portfolio REST endpoints: positions, trades, history."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.database import get_db
from app.portfolio import calculate_portfolio_value, execute_trade, record_portfolio_snapshot

router = APIRouter(prefix="/api/portfolio")


class TradeRequest(BaseModel):
    ticker: str
    quantity: float
    side: str


@router.get("")
async def get_portfolio(request: Request) -> dict:
    """Return current positions, cash balance, and total portfolio value."""
    price_cache = request.app.state.price_cache
    async with get_db() as db:
        return await calculate_portfolio_value(db, price_cache)


@router.post("/trade")
async def trade(request: Request, body: TradeRequest) -> dict:
    """Execute a market order. Returns the filled trade on success."""
    ticker = body.ticker.upper().strip()
    price_cache = request.app.state.price_cache
    async with get_db() as db:
        try:
            result = await execute_trade(db, price_cache, ticker, body.side, body.quantity)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        # Record a portfolio snapshot immediately after the trade
        await record_portfolio_snapshot(db, price_cache)
    return result


@router.get("/history")
async def portfolio_history(request: Request) -> list:
    """Return portfolio value snapshots ordered by time ascending."""
    async with get_db() as db:
        cursor = await db.execute(
            "SELECT total_value, recorded_at FROM portfolio_snapshots "
            "WHERE user_id = 'default' ORDER BY recorded_at ASC"
        )
        rows = await cursor.fetchall()
    return [{"total_value": r["total_value"], "recorded_at": r["recorded_at"]} for r in rows]
