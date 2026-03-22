"""Tests for portfolio trade execution and value calculation."""

from __future__ import annotations

import pytest
import aiosqlite
from unittest.mock import MagicMock

from app.portfolio import execute_trade, calculate_portfolio_value


_CREATE_TABLES_SQL = """
CREATE TABLE IF NOT EXISTS users_profile (
    id TEXT PRIMARY KEY,
    cash_balance REAL NOT NULL DEFAULT 10000.0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS positions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    ticker TEXT NOT NULL,
    quantity REAL NOT NULL,
    avg_cost REAL NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (user_id, ticker)
);

CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    ticker TEXT NOT NULL,
    side TEXT NOT NULL,
    quantity REAL NOT NULL,
    price REAL NOT NULL,
    executed_at TEXT NOT NULL
);
"""


@pytest.fixture
async def db():
    """In-memory SQLite DB with schema and seeded default user."""
    async with aiosqlite.connect(":memory:") as conn:
        conn.row_factory = aiosqlite.Row
        await conn.executescript(_CREATE_TABLES_SQL)
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).isoformat()
        await conn.execute(
            "INSERT INTO users_profile (id, cash_balance, created_at) VALUES (?, ?, ?)",
            ("default", 10000.0, now),
        )
        await conn.commit()
        yield conn


@pytest.fixture
def mock_cache():
    """Mock PriceCache with preset prices for AAPL, GOOGL, TSLA."""
    cache = MagicMock()
    prices = {"AAPL": 190.0, "GOOGL": 175.0, "TSLA": 250.0}
    cache.get_price.side_effect = lambda ticker: prices.get(ticker)
    return cache


async def _get_cash(db: aiosqlite.Connection) -> float:
    cursor = await db.execute("SELECT cash_balance FROM users_profile WHERE id = 'default'")
    row = await cursor.fetchone()
    return row["cash_balance"]


async def _get_position(db: aiosqlite.Connection, ticker: str):
    cursor = await db.execute(
        "SELECT quantity, avg_cost FROM positions WHERE user_id = 'default' AND ticker = ?",
        (ticker,),
    )
    return await cursor.fetchone()


class TestExecuteTrade:
    async def test_buy_reduces_cash(self, db, mock_cache):
        """Buying 5 AAPL at 190 reduces cash by 950."""
        await execute_trade(db, mock_cache, "AAPL", "buy", 5)
        cash = await _get_cash(db)
        assert cash == pytest.approx(9050.0)

    async def test_buy_creates_position(self, db, mock_cache):
        """Buying AAPL creates a position with correct avg_cost."""
        await execute_trade(db, mock_cache, "AAPL", "buy", 5)
        pos = await _get_position(db, "AAPL")
        assert pos is not None
        assert pos["quantity"] == pytest.approx(5.0)
        assert pos["avg_cost"] == pytest.approx(190.0)

    async def test_sell_increases_cash(self, db, mock_cache):
        """Buying then selling AAPL increases cash back toward original."""
        await execute_trade(db, mock_cache, "AAPL", "buy", 5)
        await execute_trade(db, mock_cache, "AAPL", "sell", 5)
        cash = await _get_cash(db)
        assert cash == pytest.approx(10000.0)

    async def test_sell_closes_position(self, db, mock_cache):
        """Selling all shares removes the position row from DB."""
        await execute_trade(db, mock_cache, "AAPL", "buy", 5)
        await execute_trade(db, mock_cache, "AAPL", "sell", 5)
        pos = await _get_position(db, "AAPL")
        assert pos is None

    async def test_buy_insufficient_cash(self, db, mock_cache):
        """Buying more than cash allows raises ValueError."""
        with pytest.raises(ValueError, match="Insufficient cash"):
            await execute_trade(db, mock_cache, "AAPL", "buy", 1000)

    async def test_sell_insufficient_shares(self, db, mock_cache):
        """Selling without owning raises ValueError."""
        with pytest.raises(ValueError, match="Insufficient shares"):
            await execute_trade(db, mock_cache, "AAPL", "sell", 100)

    async def test_unknown_ticker(self, db, mock_cache):
        """Trading an unknown ticker (no cached price) raises ValueError."""
        with pytest.raises(ValueError, match="Unknown ticker"):
            await execute_trade(db, mock_cache, "UNKNOWN", "buy", 1)

    async def test_zero_quantity(self, db, mock_cache):
        """Zero quantity raises ValueError."""
        with pytest.raises(ValueError, match="Quantity must be positive"):
            await execute_trade(db, mock_cache, "AAPL", "buy", 0)

    async def test_negative_quantity(self, db, mock_cache):
        """Negative quantity raises ValueError."""
        with pytest.raises(ValueError, match="Quantity must be positive"):
            await execute_trade(db, mock_cache, "AAPL", "buy", -1)


class TestCalculatePortfolioValue:
    async def test_no_positions(self, db, mock_cache):
        """With no positions, total_value equals cash_balance."""
        result = await calculate_portfolio_value(db, mock_cache)
        assert result["total_value"] == pytest.approx(10000.0)
        assert result["cash_balance"] == pytest.approx(10000.0)
        assert result["positions"] == []

    async def test_with_position(self, db, mock_cache):
        """total_value = cash + (quantity * current_price)."""
        await execute_trade(db, mock_cache, "AAPL", "buy", 5)
        result = await calculate_portfolio_value(db, mock_cache)
        # cash = 9050, position value = 5 * 190 = 950, total = 10000
        assert result["total_value"] == pytest.approx(10000.0)
        assert result["cash_balance"] == pytest.approx(9050.0)
        assert len(result["positions"]) == 1
        assert result["positions"][0]["ticker"] == "AAPL"
        assert result["positions"][0]["quantity"] == pytest.approx(5.0)
