"""Tests for LLM client mock mode and chat API endpoint."""

from __future__ import annotations

import os
import uuid
import pytest
import aiosqlite
from unittest.mock import AsyncMock, MagicMock
from httpx import ASGITransport, AsyncClient
from fastapi import FastAPI

from app.llm.client import MOCK_LLM_RESPONSE


def _make_chat_app(db_path: str) -> FastAPI:
    """Minimal FastAPI app with chat router and mocked dependencies."""
    from app.routes.chat import router as chat_router

    test_app = FastAPI()

    price_cache = MagicMock()
    price_cache.get_price.return_value = 190.0
    price_cache.get.return_value = None

    market_source = MagicMock()
    market_source.add_ticker = AsyncMock()
    market_source.remove_ticker = AsyncMock()

    test_app.state.price_cache = price_cache
    test_app.state.market_source = market_source

    test_app.include_router(chat_router)
    return test_app


@pytest.fixture
async def db_path(tmp_path):
    """Temporary SQLite DB with full schema and seed data."""
    from app.database import _CREATE_TABLES_SQL, DEFAULT_TICKERS
    from datetime import datetime, timezone

    path = str(tmp_path / "chat_test.db")
    async with aiosqlite.connect(path) as conn:
        conn.row_factory = aiosqlite.Row
        await conn.executescript(_CREATE_TABLES_SQL)
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
        await conn.commit()
    return path


@pytest.fixture
async def chat_client(db_path, monkeypatch):
    """Async test client with LLM_MOCK=true and patched DB_PATH."""
    monkeypatch.setenv("LLM_MOCK", "true")
    monkeypatch.setenv("DB_PATH", db_path)
    import app.database as db_module
    monkeypatch.setattr(db_module, "DB_PATH", db_path)

    test_app = _make_chat_app(db_path)
    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


class TestLLMClientMock:
    async def test_mock_mode_returns_canonical_response(self, monkeypatch):
        """call_llm with LLM_MOCK=true returns response matching MOCK_LLM_RESPONSE."""
        monkeypatch.setenv("LLM_MOCK", "true")
        from app.llm.client import call_llm
        result = await call_llm([])
        assert result.message == MOCK_LLM_RESPONSE["message"]

    async def test_mock_response_has_required_fields(self, monkeypatch):
        """Mock response contains message (str), trades (list), watchlist_changes (list)."""
        monkeypatch.setenv("LLM_MOCK", "true")
        from app.llm.client import call_llm
        result = await call_llm([])
        assert isinstance(result.message, str)
        assert isinstance(result.trades, list)
        assert isinstance(result.watchlist_changes, list)


class TestChatEndpoint:
    async def test_chat_endpoint_mock_mode(self, chat_client):
        """POST /api/chat returns 200 with message matching MOCK_LLM_RESPONSE."""
        resp = await chat_client.post("/api/chat", json={"message": "hello"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["message"] == MOCK_LLM_RESPONSE["message"]
        assert "trades_executed" in data
        assert "trades_failed" in data
        assert "watchlist_changes" in data

    async def test_chat_history(self, chat_client):
        """After sending a message, GET /api/chat/history returns non-empty list."""
        await chat_client.post("/api/chat", json={"message": "hello"})
        resp = await chat_client.get("/api/chat/history")
        assert resp.status_code == 200
        history = resp.json()
        assert len(history) >= 2  # at least user message + assistant response
        roles = [item["role"] for item in history]
        assert "user" in roles
        assert "assistant" in roles
