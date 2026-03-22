# Coding Conventions

**Analysis Date:** 2025-03-22

## Naming Patterns

**Files:**
- Lowercase with underscores: `market_data_demo.py`, `seed_prices.py`, `test_cache.py`
- Module grouping: related functionality organized in subdirectories (e.g., `app/market/`)
- Test files follow pattern: `test_*.py` for unit tests in `tests/` directory structure

**Functions:**
- Lowercase with underscores: `create_stream_router()`, `_generate_events()`, `_poll_once()`
- Prefix underscore for internal/private: `_rebuild_cholesky()`, `_fetch_snapshots()`, `_add_ticker_internal()`
- Public factory functions: `create_market_data_source()`, `create_stream_router()`
- Async functions: no special prefix, use `async def` with clear names like `start()`, `stop()`, `add_ticker()`

**Variables:**
- Lowercase with underscores for locals and instance attributes: `ticker`, `price_cache`, `update_interval`
- Private instance attributes prefixed with underscore: `self._prices`, `self._cache`, `self._task`
- Constants in UPPERCASE: `SEED_PRICES`, `DEFAULT_PARAMS`, `TRADING_SECONDS_PER_YEAR`, `DEFAULT_DT`
- Dictionary keys: lowercase and snake_case: `"sigma"`, `"mu"`, `"last_trade"`

**Types:**
- Use Python 3.12+ union syntax: `float | None`, `dict[str, PriceUpdate]`, `list[str]`
- Immutable dataclasses with `@dataclass(frozen=True, slots=True)` for data models
- Type hints on function signatures and return types (not optional-looking code): all functions have return type hints
- Import `from __future__ import annotations` at top of all modules for forward references

## Code Style

**Formatting:**
- Line length: 100 characters (configured in `pyproject.toml` under `[tool.ruff]`)
- 4-space indentation (Python standard)
- Two blank lines between top-level functions/classes
- One blank line between methods within a class
- Trailing commas in multi-line collections

**Linting:**
- Tool: `ruff` with configuration in `pyproject.toml`
- Rules enabled: E (errors), F (pyflakes), I (isort imports), N (naming), W (warnings)
- Ignore: E501 (line too long — handled by formatter)
- Line length enforced at 100 characters via `line-length = 100`

**Example from `app/market/cache.py`:**
```python
def update(self, ticker: str, price: float, timestamp: float | None = None) -> PriceUpdate:
    """Record a new price for a ticker. Returns the created PriceUpdate.

    Automatically computes direction and change from the previous price.
    If this is the first update for the ticker, previous_price == price (direction='flat').
    """
    with self._lock:
        ts = timestamp if timestamp is not None else time.time()
        prev = self._prices.get(ticker)
        previous_price = prev.price if prev else price
        # ... implementation
```

## Import Organization

**Order:**
1. Future imports: `from __future__ import annotations`
2. Standard library: `import asyncio`, `import logging`, `import os`
3. Third-party: `import numpy as np`, `from fastapi import APIRouter`, `from massive import RESTClient`
4. Local/relative imports: `from .cache import PriceCache`, `from .seed_prices import SEED_PRICES`

**Path Aliases:**
- No path aliases used in current codebase
- All imports are absolute from `app/` package root or relative with dot notation

**Example from `app/market/simulator.py`:**
```python
from __future__ import annotations

import asyncio
import logging
import math
import random

import numpy as np

from .cache import PriceCache
from .interface import MarketDataSource
from .seed_prices import (
    CORRELATION_GROUPS,
    CROSS_GROUP_CORR,
    # ... more imports
)
```

## Error Handling

**Patterns:**
- Explicit exception handling for expected conditions: `try/except asyncio.CancelledError`
- Graceful degradation: catch errors and log, don't crash the loop
- Validation in factory functions: `os.environ.get("MASSIVE_API_KEY", "").strip()` to handle empty/missing keys
- Optional error returns: functions return `None` for missing data rather than raising (e.g., `cache.get_price(ticker) -> float | None`)

**Example from `app/market/massive_client.py`:**
```python
try:
    price = snap.last_trade.price
    # ... process price
except asyncio.CancelledError:
    logger.info("SSE stream cancelled for: %s", client_ip)
except Exception as e:
    logger.error("Unexpected error in poll: %s", e)
```

**Example from `app/market/factory.py`:**
```python
api_key = os.environ.get("MASSIVE_API_KEY", "").strip()
if api_key:
    return MassiveDataSource(api_key=api_key, price_cache=price_cache)
else:
    return SimulatorDataSource(price_cache=price_cache)
```

## Logging

**Framework:** `logging` module (standard library)

**Patterns:**
- Module-level logger: `logger = logging.getLogger(__name__)`
- Levels: `logger.info()` for startup/lifecycle events, `logger.error()` for error conditions, `logger.debug()` for detailed tracing
- Structured logging: pass values as separate arguments: `logger.info("SSE client connected: %s", client_ip)`
- No print statements in libraries; use logger instead

**Example from `app/market/simulator.py`:**
```python
logger = logging.getLogger(__name__)

logger.debug(
    "Random event on %s: %.1f%% %s",
    ticker,
    shock_magnitude * 100,
    "up" if shock_sign > 0 else "down",
)
```

**Example from `app/market/factory.py`:**
```python
logger = logging.getLogger(__name__)

if api_key:
    logger.info("Market data source: Massive API (real data)")
    return MassiveDataSource(api_key=api_key, price_cache=price_cache)
else:
    logger.info("Market data source: GBM Simulator")
    return SimulatorDataSource(price_cache=price_cache)
```

## Comments

**When to Comment:**
- Docstrings on all public classes, functions, and methods (module-level docstring + function docstring mandatory)
- Inline comments for non-obvious algorithmic logic (e.g., GBM math, correlation matrix rebuilding)
- No comments for obvious code: `self._tickers.append(ticker)` needs no comment

**JSDoc/TSDoc:**
- Use standard Python docstrings (triple-quoted strings immediately after `def`/`class`)
- Include description of arguments, return value, and any exceptions
- Use imperative mood: "Record a new price" not "Records a new price"

**Example from `app/market/cache.py`:**
```python
def update(self, ticker: str, price: float, timestamp: float | None = None) -> PriceUpdate:
    """Record a new price for a ticker. Returns the created PriceUpdate.

    Automatically computes direction and change from the previous price.
    If this is the first update for the ticker, previous_price == price (direction='flat').
    """
```

**Example from `app/market/simulator.py`:**
```python
class GBMSimulator:
    """Geometric Brownian Motion simulator for correlated stock prices.

    Math:
        S(t+dt) = S(t) * exp((mu - sigma^2/2) * dt + sigma * sqrt(dt) * Z)

    Where:
        S(t)   = current price
        mu     = annualized drift (expected return)
        sigma  = annualized volatility
        dt     = time step as fraction of a trading year
        Z      = correlated standard normal random variable

    The tiny dt (~8.5e-8 for 500ms ticks over 252 trading days * 6.5h/day)
    produces sub-cent moves per tick that accumulate naturally over time.
    """
```

## Function Design

**Size:** Functions are short and focused. Examples:
- `cache.get_price(ticker)` (3 lines): simple convenience wrapper
- `cache.update(ticker, price)` (13 lines): single responsibility
- `_rebuild_cholesky()` (20 lines): self-contained matrix rebuild
- `SimulatorDataSource.start()` (15 lines): initialization logic only

**Parameters:**
- Positional arguments for required parameters
- Type hints on all arguments
- Default values for optional parameters with sensible defaults
- Example: `def __init__(self, price_cache: PriceCache, update_interval: float = 0.5) -> None:`

**Return Values:**
- All functions declare return types
- Use `None` for side-effect-only functions
- Use `| None` for optional returns: `get_price(ticker) -> float | None`
- Dataclasses return themselves for method chaining: `cache.update(...) -> PriceUpdate`

**Example from `app/market/cache.py`:**
```python
def get_price(self, ticker: str) -> float | None:
    """Convenience: get just the price float, or None."""
    update = self.get(ticker)
    return update.price if update else None
```

## Module Design

**Exports:**
- Explicit `__all__` list in package `__init__.py` files: `app/market/__init__.py` lists public exports
- Private modules prefixed with underscore or marked with leading underscore on internal functions
- Public API clearly separated from implementation details

**Example from `app/market/__init__.py`:**
```python
"""Market data subsystem for FinAlly.

Public API:
    PriceUpdate         - Immutable price snapshot dataclass
    PriceCache          - Thread-safe in-memory price store
    MarketDataSource    - Abstract interface for data providers
    create_market_data_source - Factory that selects simulator or Massive
    create_stream_router - FastAPI router factory for SSE endpoint
"""

from .cache import PriceCache
from .factory import create_market_data_source
from .interface import MarketDataSource
from .models import PriceUpdate
from .stream import create_stream_router

__all__ = [
    "PriceUpdate",
    "PriceCache",
    "MarketDataSource",
    "create_market_data_source",
    "create_stream_router",
]
```

**Barrel Files:**
- Used for public API aggregation: `app/market/__init__.py` exports key types and factories
- Keep barrel files focused on public contracts, not implementation details
- No circular imports: careful ordering of imports in `__init__.py`

---

*Convention analysis: 2025-03-22*
