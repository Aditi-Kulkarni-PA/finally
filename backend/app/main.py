"""FastAPI application entry point for FinAlly."""

from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from app.database import get_db, init_db
from app.market import PriceCache, create_market_data_source
from app.market.stream import _generate_events
from app.portfolio import record_portfolio_snapshot
from app.routes.health import router as health_router
from app.routes.portfolio import router as portfolio_router
from app.routes.watchlist import router as watchlist_router

logger = logging.getLogger(__name__)

STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "static")


async def _portfolio_snapshot_task(app: FastAPI) -> None:
    """Record portfolio value snapshot every 30 seconds."""
    while True:
        await asyncio.sleep(30)
        try:
            async with get_db() as db:
                await record_portfolio_snapshot(db, app.state.price_cache)
            logger.debug("Portfolio snapshot recorded")
        except Exception:
            logger.exception("Portfolio snapshot task error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle manager."""
    # 1. Initialize database (creates tables, seeds defaults if empty)
    await init_db()

    # 2. Create price cache and market data source
    price_cache = PriceCache()
    market_source = create_market_data_source(price_cache)

    # 3. Load watchlist tickers from DB
    async with get_db() as db:
        cursor = await db.execute("SELECT ticker FROM watchlist WHERE user_id = 'default'")
        rows = await cursor.fetchall()
        tickers = [row["ticker"] for row in rows]

    # 4. Start market data source
    await market_source.start(tickers)
    logger.info("Market data started with tickers: %s", tickers)

    # 5. Store on app.state for route access
    app.state.price_cache = price_cache
    app.state.market_source = market_source

    # 6. Start portfolio snapshot background task
    snapshot_task = asyncio.create_task(_portfolio_snapshot_task(app))

    yield

    # Shutdown
    snapshot_task.cancel()
    try:
        await snapshot_task
    except asyncio.CancelledError:
        pass

    await market_source.stop()
    logger.info("Market data source stopped")


app = FastAPI(title="FinAlly API", lifespan=lifespan)

app.include_router(health_router, prefix="/api")
app.include_router(portfolio_router)
app.include_router(watchlist_router)


@app.get("/api/stream/prices")
async def stream_prices(request: Request) -> StreamingResponse:
    """SSE endpoint: streams full price snapshot every ~500ms from the live cache."""
    return StreamingResponse(
        _generate_events(request.app.state.price_cache, request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# Static file serving for the Next.js export (available after Docker build)
if os.path.isdir(STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=STATIC_DIR), name="static")

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str) -> FileResponse:
        """Serve index.html for any non-API route (client-side SPA routing)."""
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))
