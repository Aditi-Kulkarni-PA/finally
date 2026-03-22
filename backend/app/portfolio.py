"""Shared portfolio utilities: value calculation and trade execution."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

import aiosqlite

from app.market.cache import PriceCache


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def calculate_portfolio_value(db: aiosqlite.Connection, price_cache: PriceCache) -> dict:
    """Return total_value, positions list with P&L, and cash_balance.

    Falls back to avg_cost when a position ticker has no cached price.
    """
    cursor = await db.execute(
        "SELECT cash_balance FROM users_profile WHERE id = 'default'"
    )
    row = await cursor.fetchone()
    cash_balance: float = row["cash_balance"] if row else 0.0

    cursor = await db.execute(
        "SELECT ticker, quantity, avg_cost FROM positions WHERE user_id = 'default'"
    )
    rows = await cursor.fetchall()

    positions = []
    position_value = 0.0

    for r in rows:
        ticker = r["ticker"]
        quantity = r["quantity"]
        avg_cost = r["avg_cost"]
        current_price = price_cache.get_price(ticker) or avg_cost
        unrealized_pnl = (current_price - avg_cost) * quantity
        pnl_pct = (current_price - avg_cost) / avg_cost * 100 if avg_cost else 0.0
        position_value += quantity * current_price
        positions.append(
            {
                "ticker": ticker,
                "quantity": quantity,
                "avg_cost": avg_cost,
                "current_price": current_price,
                "unrealized_pnl": unrealized_pnl,
                "pnl_pct": pnl_pct,
            }
        )

    total_value = cash_balance + position_value
    return {"cash_balance": cash_balance, "positions": positions, "total_value": total_value}


async def execute_trade(
    db: aiosqlite.Connection, price_cache: PriceCache, ticker: str, side: str, quantity: float
) -> dict:
    """Execute a market order. Raises ValueError with reason on validation failure."""
    if quantity <= 0:
        raise ValueError("Quantity must be positive")
    if side not in ("buy", "sell"):
        raise ValueError("Side must be 'buy' or 'sell'")

    price = price_cache.get_price(ticker)
    if price is None:
        raise ValueError("Unknown ticker or price not available")

    cursor = await db.execute(
        "SELECT cash_balance FROM users_profile WHERE id = 'default'"
    )
    row = await cursor.fetchone()
    cash_balance: float = row["cash_balance"]

    if side == "buy":
        cost = quantity * price
        if cash_balance < cost:
            raise ValueError("Insufficient cash")
        new_cash = cash_balance - cost

        # Upsert position using weighted average cost for buys
        cursor = await db.execute(
            "SELECT quantity, avg_cost FROM positions WHERE user_id = 'default' AND ticker = ?",
            (ticker,),
        )
        existing = await cursor.fetchone()
        if existing:
            old_qty = existing["quantity"]
            old_avg = existing["avg_cost"]
            new_qty = old_qty + quantity
            new_avg = (old_qty * old_avg + quantity * price) / new_qty
            await db.execute(
                "UPDATE positions SET quantity = ?, avg_cost = ?, updated_at = ? "
                "WHERE user_id = 'default' AND ticker = ?",
                (new_qty, new_avg, _now(), ticker),
            )
        else:
            await db.execute(
                "INSERT INTO positions (id, user_id, ticker, quantity, avg_cost, updated_at) "
                "VALUES (?, 'default', ?, ?, ?, ?)",
                (str(uuid.uuid4()), ticker, quantity, price, _now()),
            )

        await db.execute(
            "UPDATE users_profile SET cash_balance = ? WHERE id = 'default'",
            (new_cash,),
        )

    else:  # sell
        cursor = await db.execute(
            "SELECT quantity FROM positions WHERE user_id = 'default' AND ticker = ?",
            (ticker,),
        )
        existing = await cursor.fetchone()
        held = existing["quantity"] if existing else 0.0
        if held < quantity:
            raise ValueError("Insufficient shares")

        proceeds = quantity * price
        new_cash = cash_balance + proceeds
        remaining = held - quantity

        if remaining == 0:
            await db.execute(
                "DELETE FROM positions WHERE user_id = 'default' AND ticker = ?",
                (ticker,),
            )
        else:
            await db.execute(
                "UPDATE positions SET quantity = ?, updated_at = ? "
                "WHERE user_id = 'default' AND ticker = ?",
                (remaining, _now(), ticker),
            )

        await db.execute(
            "UPDATE users_profile SET cash_balance = ? WHERE id = 'default'",
            (new_cash,),
        )

    await db.execute(
        "INSERT INTO trades (id, user_id, ticker, side, quantity, price, executed_at) "
        "VALUES (?, 'default', ?, ?, ?, ?, ?)",
        (str(uuid.uuid4()), ticker, side, quantity, price, _now()),
    )
    await db.commit()

    return {"ticker": ticker, "side": side, "quantity": quantity, "price": price}


async def record_portfolio_snapshot(db: aiosqlite.Connection, price_cache: PriceCache) -> None:
    """Insert a portfolio_snapshots row with the current total value."""
    result = await calculate_portfolio_value(db, price_cache)
    await db.execute(
        "INSERT INTO portfolio_snapshots (id, user_id, total_value, recorded_at) "
        "VALUES (?, 'default', ?, ?)",
        (str(uuid.uuid4()), result["total_value"], _now()),
    )
    await db.commit()
