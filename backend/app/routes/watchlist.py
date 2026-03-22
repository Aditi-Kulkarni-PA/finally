"""Watchlist REST endpoints: list, add, remove tickers."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.database import get_db

router = APIRouter(prefix="/api/watchlist")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class AddTickerRequest(BaseModel):
    ticker: str


@router.get("")
async def get_watchlist(request: Request) -> list:
    """Return watchlist tickers with current price data from cache."""
    price_cache = request.app.state.price_cache
    async with get_db() as db:
        cursor = await db.execute(
            "SELECT ticker FROM watchlist WHERE user_id = 'default' ORDER BY added_at ASC"
        )
        rows = await cursor.fetchall()

    result = []
    for r in rows:
        ticker = r["ticker"]
        update = price_cache.get(ticker)
        if update:
            result.append(
                {
                    "ticker": ticker,
                    "price": update.price,
                    "previous_price": update.previous_price,
                    "change": update.change,
                    "change_percent": update.change_percent,
                    "direction": update.direction,
                }
            )
        else:
            result.append(
                {
                    "ticker": ticker,
                    "price": None,
                    "previous_price": None,
                    "change": None,
                    "change_percent": None,
                    "direction": None,
                }
            )
    return result


@router.post("", status_code=201)
async def add_ticker(request: Request, body: AddTickerRequest) -> dict:
    """Add a ticker to the watchlist. No-op if already present."""
    ticker = body.ticker.upper().strip()
    market_source = request.app.state.market_source
    async with get_db() as db:
        # Check for duplicate
        cursor = await db.execute(
            "SELECT id FROM watchlist WHERE user_id = 'default' AND ticker = ?", (ticker,)
        )
        existing = await cursor.fetchone()
        if existing:
            return {"ticker": ticker, "status": "already_exists"}

        await db.execute(
            "INSERT INTO watchlist (id, user_id, ticker, added_at) VALUES (?, 'default', ?, ?)",
            (str(uuid.uuid4()), ticker, _now()),
        )
        await db.commit()

    await market_source.add_ticker(ticker)
    return {"ticker": ticker, "status": "added"}


@router.delete("/{ticker}", status_code=204)
async def remove_ticker(request: Request, ticker: str) -> JSONResponse:
    """Remove a ticker from the watchlist. Evicts from cache if no open position."""
    ticker = ticker.upper().strip()
    market_source = request.app.state.market_source
    async with get_db() as db:
        await db.execute(
            "DELETE FROM watchlist WHERE user_id = 'default' AND ticker = ?", (ticker,)
        )
        await db.commit()

        # Only evict from cache if user holds no position in this ticker
        cursor = await db.execute(
            "SELECT quantity FROM positions WHERE user_id = 'default' AND ticker = ?", (ticker,)
        )
        position = await cursor.fetchone()

    if not position or position["quantity"] == 0:
        await market_source.remove_ticker(ticker)

    return JSONResponse(content=None, status_code=204)
