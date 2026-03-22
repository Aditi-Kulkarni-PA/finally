# Market Data Interface Design

Unified Python API for retrieving stock prices in FinAlly. Two implementations — a GBM simulator (default) and the Massive REST client — sit behind one abstract interface. All downstream code (SSE streaming, trade execution, portfolio valuation) is agnostic to the data source.

---

## Architecture

```
                        ┌─────────────────┐
                        │  PriceCache     │  (shared in-memory store)
                        └────────┬────────┘
                                 │ writes               reads
               ┌─────────────────┤                        │
               │                 │             ┌──────────┴───────────┐
  ┌────────────▼────────┐  ┌─────▼──────────┐  │  SSE streaming       │
  │  SimulatorDataSource│  │MassiveDataSource│  │  Trade execution     │
  │  (GBM, 500ms ticks) │  │(REST, 15s poll) │  │  Portfolio valuation │
  └─────────────────────┘  └────────────────┘  └──────────────────────┘
```

The factory reads `MASSIVE_API_KEY` at startup and returns the appropriate implementation. Neither implementation is imported unless selected.

---

## Data Model

```python
# backend/app/market/models.py
from dataclasses import dataclass, field
import time

@dataclass(frozen=True, slots=True)
class PriceUpdate:
    """Immutable price snapshot for one ticker at one point in time."""
    ticker: str
    price: float
    previous_price: float
    timestamp: float = field(default_factory=time.time)  # Unix seconds

    @property
    def change(self) -> float:
        return round(self.price - self.previous_price, 4)

    @property
    def change_percent(self) -> float:
        if self.previous_price == 0:
            return 0.0
        return round((self.price - self.previous_price) / self.previous_price * 100, 4)

    @property
    def direction(self) -> str:
        if self.price > self.previous_price:
            return "up"
        elif self.price < self.previous_price:
            return "down"
        return "flat"

    def to_dict(self) -> dict:
        return {
            "ticker": self.ticker,
            "price": self.price,
            "previous_price": self.previous_price,
            "timestamp": self.timestamp,
            "change": self.change,
            "change_percent": self.change_percent,
            "direction": self.direction,
        }
```

`PriceUpdate` is the only type that leaves the market data layer. It is frozen and slots-allocated for performance, since it is created thousands of times per minute.

---

## Abstract Interface

```python
# backend/app/market/interface.py
from abc import ABC, abstractmethod

class MarketDataSource(ABC):
    """Contract for all market data providers.

    Implementations push price updates into a shared PriceCache on their own
    schedule. Downstream code never calls the source directly for prices.

    Lifecycle:
        source = create_market_data_source(cache)
        await source.start(["AAPL", "MSFT", ...])   # starts background task
        await source.add_ticker("TSLA")              # add at runtime
        await source.remove_ticker("MSFT")           # remove at runtime
        await source.stop()                          # on shutdown
    """

    @abstractmethod
    async def start(self, tickers: list[str]) -> None:
        """Begin producing price updates. Call exactly once."""

    @abstractmethod
    async def stop(self) -> None:
        """Stop background task. Safe to call multiple times."""

    @abstractmethod
    async def add_ticker(self, ticker: str) -> None:
        """Add a ticker to the active set. No-op if already present."""

    @abstractmethod
    async def remove_ticker(self, ticker: str) -> None:
        """Remove a ticker and evict it from the PriceCache."""

    @abstractmethod
    def get_tickers(self) -> list[str]:
        """Return currently tracked tickers."""
```

---

## Price Cache

```python
# backend/app/market/cache.py
import time
from threading import Lock
from .models import PriceUpdate

class PriceCache:
    """Thread-safe in-memory store of latest price per ticker.

    Writer: one background task (simulator or Massive poller).
    Readers: SSE generator, trade validation, portfolio valuation.
    """

    def __init__(self) -> None:
        self._prices: dict[str, PriceUpdate] = {}
        self._lock = Lock()
        self._version: int = 0   # bumped on every write; SSE uses this for change detection

    def update(self, ticker: str, price: float, timestamp: float | None = None) -> PriceUpdate:
        """Record a new price. Computes direction from previous price."""
        with self._lock:
            prev = self._prices.get(ticker)
            update = PriceUpdate(
                ticker=ticker,
                price=round(price, 2),
                previous_price=round(prev.price if prev else price, 2),
                timestamp=timestamp or time.time(),
            )
            self._prices[ticker] = update
            self._version += 1
            return update

    def get(self, ticker: str) -> PriceUpdate | None:
        with self._lock:
            return self._prices.get(ticker)

    def get_all(self) -> dict[str, PriceUpdate]:
        """Snapshot copy of all current prices."""
        with self._lock:
            return dict(self._prices)

    def get_price(self, ticker: str) -> float | None:
        update = self.get(ticker)
        return update.price if update else None

    def remove(self, ticker: str) -> None:
        with self._lock:
            self._prices.pop(ticker, None)

    @property
    def version(self) -> int:
        return self._version
```

### Cache Scope

The cache always holds prices for the union of:
- All tickers in the watchlist
- All tickers with open positions (so P&L remains accurate even after watchlist removal)

A ticker is evicted only when it is both removed from the watchlist **and** the user holds no position in it. The eviction call (`source.remove_ticker`) is the responsibility of the watchlist API route, which must check positions first.

---

## Factory

```python
# backend/app/market/factory.py
import logging
import os
from .cache import PriceCache
from .interface import MarketDataSource

logger = logging.getLogger(__name__)

def create_market_data_source(price_cache: PriceCache) -> MarketDataSource:
    """Return the appropriate data source based on environment variables.

    - MASSIVE_API_KEY set and non-empty → MassiveDataSource (real data)
    - Otherwise → SimulatorDataSource (GBM simulation, default)
    """
    api_key = os.environ.get("MASSIVE_API_KEY", "").strip()
    if api_key:
        from .massive_client import MassiveDataSource
        logger.info("Market data: Massive API")
        return MassiveDataSource(api_key=api_key, price_cache=price_cache)
    else:
        from .simulator import SimulatorDataSource
        logger.info("Market data: GBM Simulator")
        return SimulatorDataSource(price_cache=price_cache)
```

---

## Massive Implementation

```python
# backend/app/market/massive_client.py
import asyncio
import logging
from massive import RESTClient
from massive.rest.models import SnapshotMarketType
from .cache import PriceCache
from .interface import MarketDataSource

logger = logging.getLogger(__name__)

class MassiveDataSource(MarketDataSource):
    """Polls GET /v2/snapshot/locale/us/markets/stocks/tickers every interval seconds."""

    def __init__(self, api_key: str, price_cache: PriceCache, poll_interval: float = 15.0):
        self._client = RESTClient(api_key=api_key)
        self._cache = price_cache
        self._interval = poll_interval
        self._tickers: list[str] = []
        self._task: asyncio.Task | None = None

    async def start(self, tickers: list[str]) -> None:
        self._tickers = list(tickers)
        await self._poll_once()                              # immediate first fill
        self._task = asyncio.create_task(self._poll_loop(), name="massive-poller")

    async def stop(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def add_ticker(self, ticker: str) -> None:
        if ticker not in self._tickers:
            self._tickers.append(ticker)

    async def remove_ticker(self, ticker: str) -> None:
        self._tickers = [t for t in self._tickers if t != ticker]
        self._cache.remove(ticker)

    def get_tickers(self) -> list[str]:
        return list(self._tickers)

    async def _poll_loop(self) -> None:
        while True:
            await asyncio.sleep(self._interval)
            await self._poll_once()

    async def _poll_once(self) -> None:
        if not self._tickers:
            return
        try:
            # RESTClient is synchronous — run in a thread pool to avoid blocking
            snapshots = await asyncio.to_thread(
                self._client.get_snapshot_all,
                market_type=SnapshotMarketType.STOCKS,
                tickers=self._tickers,
            )
            for snap in snapshots:
                self._cache.update(
                    ticker=snap.ticker,
                    price=snap.last_trade.price,
                    timestamp=snap.last_trade.timestamp / 1000,  # ms → seconds
                )
        except Exception:
            logger.exception("Massive poll failed — retrying on next interval")
```

---

## Simulator Implementation (summary)

```python
# backend/app/market/simulator.py
import asyncio
from .cache import PriceCache
from .interface import MarketDataSource

class SimulatorDataSource(MarketDataSource):
    """Wraps GBMSimulator in an async loop, writing to PriceCache every 500ms."""

    def __init__(self, price_cache: PriceCache, update_interval: float = 0.5):
        self._cache = price_cache
        self._interval = update_interval
        self._sim: GBMSimulator | None = None
        self._task: asyncio.Task | None = None

    async def start(self, tickers: list[str]) -> None:
        self._sim = GBMSimulator(tickers=tickers)
        # Seed cache immediately so SSE has data before the first loop tick
        for ticker in tickers:
            price = self._sim.get_price(ticker)
            if price is not None:
                self._cache.update(ticker=ticker, price=price)
        self._task = asyncio.create_task(self._run_loop(), name="simulator-loop")

    async def stop(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def add_ticker(self, ticker: str) -> None:
        if self._sim:
            self._sim.add_ticker(ticker)
            price = self._sim.get_price(ticker)
            if price is not None:
                self._cache.update(ticker=ticker, price=price)

    async def remove_ticker(self, ticker: str) -> None:
        if self._sim:
            self._sim.remove_ticker(ticker)
        self._cache.remove(ticker)

    def get_tickers(self) -> list[str]:
        return self._sim.get_tickers() if self._sim else []

    async def _run_loop(self) -> None:
        while True:
            prices = self._sim.step()
            for ticker, price in prices.items():
                self._cache.update(ticker=ticker, price=price)
            await asyncio.sleep(self._interval)
```

See `MARKET_SIMULATOR.md` for the `GBMSimulator` internals.

---

## SSE Integration

The SSE endpoint is source-agnostic — it reads from the cache:

```python
# backend/app/market/stream.py
async def _generate_events(price_cache: PriceCache, request: Request, interval: float = 0.5):
    yield "retry: 1000\n\n"
    last_version = -1
    while True:
        if await request.is_disconnected():
            break
        if price_cache.version != last_version:
            last_version = price_cache.version
            prices = price_cache.get_all()
            if prices:
                data = {t: u.to_dict() for t, u in prices.items()}
                yield f"data: {json.dumps(data)}\n\n"
        await asyncio.sleep(interval)
```

Each SSE event is a **full snapshot** of all cached tickers — not individual per-ticker deltas.

---

## File Layout

```
backend/app/market/
├── __init__.py          # Public re-exports
├── models.py            # PriceUpdate dataclass
├── cache.py             # PriceCache
├── interface.py         # MarketDataSource ABC
├── factory.py           # create_market_data_source()
├── massive_client.py    # MassiveDataSource
├── simulator.py         # SimulatorDataSource + GBMSimulator
├── seed_prices.py       # SEED_PRICES, TICKER_PARAMS constants
└── stream.py            # SSE router factory
```

---

## FastAPI Lifecycle Integration

```python
# backend/app/main.py (lifespan context)
from contextlib import asynccontextmanager
from fastapi import FastAPI
from .market import PriceCache, create_market_data_source, create_stream_router

price_cache = PriceCache()
market_source = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global market_source
    # 1. Init DB (creates schema + seeds data if needed)
    await init_db()
    # 2. Load initial watchlist from DB
    tickers = await get_watchlist_tickers()
    # 3. Start market data source
    market_source = create_market_data_source(price_cache)
    await market_source.start(tickers)
    yield
    # Shutdown
    await market_source.stop()

app = FastAPI(lifespan=lifespan)
app.include_router(create_stream_router(price_cache))
```

Background tasks start **after** `init_db()` completes, so the watchlist seed data is always available on first startup.
