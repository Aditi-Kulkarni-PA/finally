"""Async SQLite database module using aiosqlite with plain SQL."""

from __future__ import annotations

import logging
import os
import uuid
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import aiosqlite

logger = logging.getLogger(__name__)

# Docker path is /app/db/finally.db; local dev falls back to db/finally.db
DB_PATH = os.environ.get("DB_PATH", "db/finally.db")

DEFAULT_TICKERS = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "NVDA", "META", "JPM", "V", "NFLX"]

_CREATE_TABLES_SQL = """
CREATE TABLE IF NOT EXISTS users_profile (
    id TEXT PRIMARY KEY,
    cash_balance REAL NOT NULL DEFAULT 10000.0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS watchlist (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    ticker TEXT NOT NULL,
    added_at TEXT NOT NULL,
    UNIQUE (user_id, ticker)
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

CREATE TABLE IF NOT EXISTS portfolio_snapshots (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    total_value REAL NOT NULL,
    recorded_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    actions TEXT,
    created_at TEXT NOT NULL
);
"""


async def init_db() -> None:
    """Create tables and seed default data if the database is empty."""
    # Ensure the directory exists
    db_dir = os.path.dirname(DB_PATH)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)

    async with aiosqlite.connect(DB_PATH) as db:
        await db.executescript(_CREATE_TABLES_SQL)
        await _seed_if_empty(db)
        await db.commit()

    logger.info("Database initialized: %s", DB_PATH)


async def _seed_if_empty(db: aiosqlite.Connection) -> None:
    """Insert default user profile and watchlist if tables are empty."""
    cursor = await db.execute("SELECT COUNT(*) FROM users_profile")
    (count,) = await cursor.fetchone()

    if count == 0:
        now = datetime.now(timezone.utc).isoformat()
        await db.execute(
            "INSERT INTO users_profile (id, cash_balance, created_at) VALUES (?, ?, ?)",
            ("default", 10000.0, now),
        )
        logger.info("Seeded default user profile")

    cursor = await db.execute("SELECT COUNT(*) FROM watchlist WHERE user_id = 'default'")
    (count,) = await cursor.fetchone()

    if count == 0:
        now = datetime.now(timezone.utc).isoformat()
        for ticker in DEFAULT_TICKERS:
            await db.execute(
                "INSERT INTO watchlist (id, user_id, ticker, added_at) VALUES (?, ?, ?, ?)",
                (str(uuid.uuid4()), "default", ticker, now),
            )
        logger.info("Seeded %d default watchlist tickers", len(DEFAULT_TICKERS))


@asynccontextmanager
async def get_db() -> AsyncGenerator[aiosqlite.Connection, None]:
    """Async context manager providing an aiosqlite connection."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        yield db
