"""Tests for watchlist API routes."""

from __future__ import annotations

import os
import pytest
import aiosqlite
from unittest.mock import AsyncMock, MagicMock
from httpx import ASGITransport, AsyncClient
from fastapi import FastAPI

# Point DB_PATH to a temp in-memory path before importing app modules
os.environ["DB_PATH"] = ":memory:"

from app.routes.watchlist import router
from app.database import _CREATE_TABLES_SQL, DEFAULT_TICKERS


def _make_app(db_path: str) -> FastAPI:
    """Create a minimal FastAPI app with watchlist router and mocked state."""
    test_app = FastAPI()

    price_cache = MagicMock()
    price_cache.get.return_value = None  # No live prices in unit tests

    market_source = MagicMock()
    market_source.add_ticker = AsyncMock()
    market_source.remove_ticker = AsyncMock()

    test_app.state.price_cache = price_cache
    test_app.state.market_source = market_source

    test_app.include_router(router)
    return test_app


@pytest.fixture
async def db_path(tmp_path):
    """Create a temporary SQLite DB with schema and seed data."""
    path = str(tmp_path / "test.db")
    async with aiosqlite.connect(path) as conn:
        conn.row_factory = aiosqlite.Row
        await conn.executescript(_CREATE_TABLES_SQL)
        from datetime import datetime, timezone
        import uuid
        now = datetime.now(timezone.utc).isoformat()
        await conn.execute(
            "INSERT INTO users_profile (id, cash_balance, created_at) VALUES (?, ?, ?)",
            ("default", 10000.0, now),
        )
        for ticker in DEFAULT_TICKERS:
            await conn.execute(
                "INSERT INTO watchlist (id, user_id, ticker, added_at) VALUES (?, ?, ?, ?)",
                (str(uuid.uuid4()), "default", ticker, now),
            )
        await conn.execute(
            "INSERT INTO positions (id, user_id, ticker, quantity, avg_cost, updated_at) VALUES (?, 'default', 'AAPL', 5.0, 190.0, ?)",
            (str(uuid.uuid4()), now),
        )
        await conn.commit()
    return path


@pytest.fixture
async def client(db_path, monkeypatch):
    """Async test client with patched DB_PATH."""
    monkeypatch.setenv("DB_PATH", db_path)
    import app.database as db_module
    monkeypatch.setattr(db_module, "DB_PATH", db_path)

    test_app = _make_app(db_path)
    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


class TestWatchlist:
    async def test_get_watchlist(self, client):
        """GET /api/watchlist returns the 10 default tickers."""
        resp = await client.get("/api/watchlist")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 10
        tickers = [item["ticker"] for item in data]
        assert "AAPL" in tickers
        assert "GOOGL" in tickers

    async def test_add_ticker(self, client):
        """POST /api/watchlist adds a new ticker and returns 201."""
        resp = await client.post("/api/watchlist", json={"ticker": "PYPL"})
        assert resp.status_code == 201
        body = resp.json()
        assert body["ticker"] == "PYPL"

        # Verify it appears in the list
        resp2 = await client.get("/api/watchlist")
        tickers = [item["ticker"] for item in resp2.json()]
        assert "PYPL" in tickers

    async def test_add_ticker_normalizes_case(self, client):
        """POST with lowercase ticker stores it uppercased."""
        resp = await client.post("/api/watchlist", json={"ticker": "pypl"})
        assert resp.status_code == 201
        body = resp.json()
        assert body["ticker"] == "PYPL"

    async def test_add_duplicate_ticker(self, client):
        """Adding the same ticker twice does not create a duplicate."""
        await client.post("/api/watchlist", json={"ticker": "PYPL"})
        resp = await client.post("/api/watchlist", json={"ticker": "PYPL"})
        assert resp.status_code == 201  # no error

        resp2 = await client.get("/api/watchlist")
        tickers = [item["ticker"] for item in resp2.json()]
        assert tickers.count("PYPL") == 1

    async def test_remove_ticker(self, client):
        """DELETE /api/watchlist/{ticker} removes it and returns 204."""
        resp = await client.delete("/api/watchlist/GOOGL")
        assert resp.status_code == 204

        resp2 = await client.get("/api/watchlist")
        tickers = [item["ticker"] for item in resp2.json()]
        assert "GOOGL" not in tickers

    async def test_watchlist_returns_price_fields(self, client):
        """Each watchlist item includes ticker and price fields."""
        resp = await client.get("/api/watchlist")
        assert resp.status_code == 200
        for item in resp.json():
            assert "ticker" in item
            assert "price" in item
