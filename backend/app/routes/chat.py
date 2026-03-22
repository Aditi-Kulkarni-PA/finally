"""Chat REST endpoints: send message and fetch conversation history."""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.database import get_db
from app.llm.client import call_llm
from app.llm.prompts import SYSTEM_PROMPT, build_portfolio_context
from app.portfolio import calculate_portfolio_value, execute_trade

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class ChatRequest(BaseModel):
    message: str


@router.post("")
async def send_message(request: Request, body: ChatRequest) -> dict:
    """Receive user message, call LLM, auto-execute any trades/watchlist changes."""
    price_cache = request.app.state.price_cache
    market_source = request.app.state.market_source

    async with get_db() as db:
        # 1. Load portfolio context
        portfolio = await calculate_portfolio_value(db, price_cache)

        # 2. Load watchlist
        cursor = await db.execute(
            "SELECT ticker FROM watchlist WHERE user_id = 'default' ORDER BY added_at ASC"
        )
        watchlist_rows = await cursor.fetchall()
        watchlist = [{"ticker": r["ticker"]} for r in watchlist_rows]

        # 3. Load last 20 chat messages
        cursor = await db.execute(
            "SELECT role, content FROM chat_messages "
            "WHERE user_id = 'default' ORDER BY created_at ASC LIMIT 20"
        )
        history_rows = await cursor.fetchall()
        history = [{"role": r["role"], "content": r["content"]} for r in history_rows]

        # 4. Build messages list for LLM
        context = build_portfolio_context(portfolio, watchlist)
        system_content = f"{SYSTEM_PROMPT}\n\nCurrent portfolio context:\n{context}"
        messages = [{"role": "system", "content": system_content}]
        messages.extend(history)
        messages.append({"role": "user", "content": body.message})

        # 5. Store user message
        await db.execute(
            "INSERT INTO chat_messages (id, user_id, role, content, actions, created_at) "
            "VALUES (?, 'default', 'user', ?, NULL, ?)",
            (str(uuid.uuid4()), body.message, _now()),
        )
        await db.commit()

        # 6. Call LLM
        llm_response = await call_llm(messages)

        # 7. Auto-execute trades
        trades_executed = []
        trades_failed = []
        for trade in llm_response.trades:
            ticker = trade.get("ticker", "").upper().strip()
            side = trade.get("side", "")
            quantity = trade.get("quantity", 0)
            try:
                result = await execute_trade(db, price_cache, ticker, side, float(quantity))
                trades_executed.append(
                    {
                        "ticker": result["ticker"],
                        "side": result["side"],
                        "quantity": result["quantity"],
                        "price": result["price"],
                        "status": "ok",
                    }
                )
            except ValueError as exc:
                trades_failed.append(
                    {"ticker": ticker, "side": side, "quantity": quantity, "reason": str(exc)}
                )

        # 8. Auto-execute watchlist changes
        watchlist_changes_out = []
        watchlist_tickers = {w["ticker"] for w in watchlist}

        for change in llm_response.watchlist_changes:
            ticker = change.get("ticker", "").upper().strip()
            action = change.get("action", "")

            if action == "add":
                if ticker in watchlist_tickers:
                    # Already in watchlist, silently ignore
                    continue
                await db.execute(
                    "INSERT INTO watchlist (id, user_id, ticker, added_at) VALUES (?, 'default', ?, ?)",
                    (str(uuid.uuid4()), ticker, _now()),
                )
                await db.commit()
                await market_source.add_ticker(ticker)
                watchlist_tickers.add(ticker)
                watchlist_changes_out.append({"ticker": ticker, "action": "add", "status": "ok"})

            elif action == "remove":
                if ticker not in watchlist_tickers:
                    # Not in watchlist, silently ignore
                    continue
                await db.execute(
                    "DELETE FROM watchlist WHERE user_id = 'default' AND ticker = ?", (ticker,)
                )
                await db.commit()
                # Only evict from cache if no open position
                pos_cursor = await db.execute(
                    "SELECT quantity FROM positions WHERE user_id = 'default' AND ticker = ?",
                    (ticker,),
                )
                position = await pos_cursor.fetchone()
                if not position or position["quantity"] == 0:
                    await market_source.remove_ticker(ticker)
                watchlist_tickers.discard(ticker)
                watchlist_changes_out.append({"ticker": ticker, "action": "remove", "status": "ok"})

        # 9. Store assistant message with actions
        actions_json = json.dumps(
            {
                "trades_executed": trades_executed,
                "trades_failed": trades_failed,
                "watchlist_changes": watchlist_changes_out,
            }
        )
        await db.execute(
            "INSERT INTO chat_messages (id, user_id, role, content, actions, created_at) "
            "VALUES (?, 'default', 'assistant', ?, ?, ?)",
            (str(uuid.uuid4()), llm_response.message, actions_json, _now()),
        )
        await db.commit()

    return {
        "message": llm_response.message,
        "trades_executed": trades_executed,
        "trades_failed": trades_failed,
        "watchlist_changes": watchlist_changes_out,
    }


@router.get("/history")
async def get_chat_history() -> list:
    """Return full conversation history ordered by creation time ascending."""
    async with get_db() as db:
        cursor = await db.execute(
            "SELECT id, role, content, actions, created_at FROM chat_messages "
            "WHERE user_id = 'default' ORDER BY created_at ASC"
        )
        rows = await cursor.fetchall()
    return [
        {
            "id": r["id"],
            "role": r["role"],
            "content": r["content"],
            "actions": json.loads(r["actions"]) if r["actions"] else None,
            "created_at": r["created_at"],
        }
        for r in rows
    ]
