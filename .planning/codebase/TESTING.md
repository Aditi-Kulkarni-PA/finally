# Testing Patterns

**Analysis Date:** 2025-03-22

## Test Framework

**Runner:**
- `pytest` 8.3.0+ (configured in `pyproject.toml`)
- Config file: `pyproject.toml` under `[tool.pytest.ini_options]`

**Key Configuration:**
```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = ["test_*.py"]
python_classes = ["Test*"]
python_functions = ["test_*"]
asyncio_mode = "auto"
asyncio_default_fixture_loop_scope = "function"
```

**Assertion Library:**
- Built-in `assert` statements (pytest's assertion rewriting)
- Standard equality: `assert result == expected`
- Raises: `pytest.raises(ExceptionType)` for exception testing

**Run Commands:**
```bash
uv run --extra dev pytest -v              # Run all tests, verbose output
uv run --extra dev pytest --cov=app       # Run with coverage report
uv run --extra dev pytest tests/market/   # Run specific test module
uv run --extra dev pytest -k test_name    # Run tests matching pattern
uv run --extra dev ruff check app/ tests/ # Lint check
```

## Test File Organization

**Location:**
- Test files in `backend/tests/` directory structure
- Mirrors source structure: `app/market/` → `tests/market/`
- Separate test modules per source module: `app/market/cache.py` → `tests/market/test_cache.py`

**Naming:**
- Test files: `test_*.py`
- Test classes: `Test*` (e.g., `TestPriceCache`, `TestGBMSimulator`, `TestFactory`)
- Test methods: `test_*` (e.g., `test_update_and_get`, `test_prices_are_positive`)

**Structure:**
```
backend/
├── app/
│   └── market/
│       ├── cache.py
│       ├── simulator.py
│       └── ...
└── tests/
    ├── conftest.py          # Shared fixtures
    ├── __init__.py
    └── market/
        ├── __init__.py
        ├── test_cache.py    # Tests for cache.py
        ├── test_simulator.py # Tests for simulator.py
        └── ...
```

## Test Structure

**Suite Organization:**
```python
class TestPriceCache:
    """Unit tests for the PriceCache."""

    def test_update_and_get(self):
        """Test updating and getting a price."""
        cache = PriceCache()
        update = cache.update("AAPL", 190.50)
        assert update.ticker == "AAPL"
        assert update.price == 190.50
        assert cache.get("AAPL") == update
```

**Patterns:**
- Class-based organization: one test class per source class/component
- One assertion focus per test method: test one behavior per method
- Descriptive docstrings: explain what is being tested
- Arrange-Act-Assert (AAA) pattern (implicit in method structure):
  1. Arrange: create objects (`cache = PriceCache()`)
  2. Act: call the method (`update = cache.update(...)`)
  3. Assert: verify results (`assert update.ticker == "AAPL"`)

**Example from `tests/market/test_cache.py`:**
```python
def test_direction_up(self):
    """Test price update with upward direction."""
    # Arrange
    cache = PriceCache()
    cache.update("AAPL", 190.00)

    # Act
    update = cache.update("AAPL", 191.00)

    # Assert
    assert update.direction == "up"
    assert update.change == 1.00
```

**Async Test Pattern from `tests/market/test_simulator_source.py`:**
```python
@pytest.mark.asyncio
class TestSimulatorDataSource:
    """Integration tests for the SimulatorDataSource."""

    async def test_start_populates_cache(self):
        """Test that start() immediately populates the cache."""
        cache = PriceCache()
        source = SimulatorDataSource(price_cache=cache, update_interval=0.1)
        await source.start(["AAPL", "GOOGL"])

        # Cache should have seed prices immediately
        assert cache.get("AAPL") is not None
        assert cache.get("GOOGL") is not None

        await source.stop()
```

## Mocking

**Framework:** `unittest.mock` (standard library)
- `MagicMock`: general-purpose mock object
- `patch`: replace objects in specific scopes
- `patch.dict`: temporarily modify dictionaries (e.g., environment variables)
- `patch.object`: patch specific methods or attributes

**Patterns:**

**Mock API Response (from `tests/market/test_massive.py`):**
```python
def _make_snapshot(ticker: str, price: float, timestamp_ms: int) -> MagicMock:
    """Create a mock Massive snapshot object."""
    snap = MagicMock()
    snap.ticker = ticker
    snap.last_trade = MagicMock()
    snap.last_trade.price = price
    snap.last_trade.timestamp = timestamp_ms
    return snap

async def test_poll_updates_cache(self):
    """Test that polling updates the cache."""
    cache = PriceCache()
    source = MassiveDataSource(api_key="test-key", price_cache=cache, poll_interval=60.0)
    source._tickers = ["AAPL", "GOOGL"]
    source._client = MagicMock()  # Satisfy guard

    mock_snapshots = [
        _make_snapshot("AAPL", 190.50, 1707580800000),
        _make_snapshot("GOOGL", 175.25, 1707580800000),
    ]

    with patch.object(source, "_fetch_snapshots", return_value=mock_snapshots):
        await source._poll_once()

    assert cache.get_price("AAPL") == 190.50
```

**Mock Environment Variables (from `tests/market/test_factory.py`):**
```python
def test_creates_simulator_when_no_api_key(self):
    """Test that simulator is created when MASSIVE_API_KEY is not set."""
    cache = PriceCache()

    with patch.dict(os.environ, {}, clear=True):
        source = create_market_data_source(cache)

    assert isinstance(source, SimulatorDataSource)

def test_creates_massive_when_api_key_set(self):
    """Test that Massive client is created when MASSIVE_API_KEY is set."""
    cache = PriceCache()

    with patch.dict(os.environ, {"MASSIVE_API_KEY": "test-key"}, clear=True):
        source = create_market_data_source(cache)

    assert isinstance(source, MassiveDataSource)
```

**What to Mock:**
- External API clients: `MassiveDataSource._client` (REST API)
- Environment-dependent code: use `patch.dict(os.environ, ...)`
- Return values of internal methods being tested indirectly
- Third-party library calls if the library is not installed or call is expensive

**What NOT to Mock:**
- The class under test itself
- Core data structures (PriceCache, PriceUpdate) used by the unit
- Simple getter/setter methods
- Standard library functions unless specifically testing error paths
- Dataclass constructors — test with real instances

## Fixtures and Factories

**Test Data:**
No shared fixtures currently used. Tests create fresh instances directly:

```python
def test_update_and_get(self):
    """Test updating and getting a price."""
    cache = PriceCache()  # Fresh instance per test
    update = cache.update("AAPL", 190.50)
    assert update.price == 190.50
```

**Helper Functions:**
Mock snapshot factory in `tests/market/test_massive.py`:
```python
def _make_snapshot(ticker: str, price: float, timestamp_ms: int) -> MagicMock:
    """Create a mock Massive snapshot object."""
    snap = MagicMock()
    snap.ticker = ticker
    snap.last_trade = MagicMock()
    snap.last_trade.price = price
    snap.last_trade.timestamp = timestamp_ms
    return snap
```

**conftest.py:**
Located at `backend/tests/conftest.py`. Currently minimal:
```python
"""Pytest configuration and fixtures."""

import pytest

@pytest.fixture
def event_loop_policy():
    """Use the default event loop policy for all async tests."""
    import asyncio
    return asyncio.DefaultEventLoopPolicy()
```

This file configures async test mode. Extend it here to add shared fixtures for multiple tests.

## Coverage

**Requirements:** Not enforced by default, but configured in `pyproject.toml`:
```toml
[tool.coverage.run]
source = ["app"]
omit = ["tests/*"]

[tool.coverage.report]
exclude_lines = [
    "pragma: no cover",
    "def __repr__",
    "raise AssertionError",
    "raise NotImplementedError",
    "if __name__ == .__main__.:",
    "if TYPE_CHECKING:",
]
```

**View Coverage:**
```bash
uv run --extra dev pytest --cov=app --cov-report=html
# Generates htmlcov/index.html
```

**Current Coverage Focus:**
- Market data module: comprehensive (cache, simulator, factory, models)
- SSE streaming: basic structure tested (mocked in integration tests)
- API routes: tested via E2E tests in `test/` directory (not pytest)

## Test Types

**Unit Tests:**
- Scope: Single function or method in isolation
- Dependencies: Mocked or minimal (use real simple objects like PriceCache)
- Location: `tests/market/test_*.py`
- Examples:
  - `TestPriceCache.test_update_and_get`: test `cache.update()` directly
  - `TestGBMSimulator.test_prices_are_positive`: verify GBM math produces positive prices
  - `TestFactory.test_creates_simulator_when_no_api_key`: test factory selection logic

**Integration Tests:**
- Scope: Multiple components working together, but not the full system
- Dependencies: Real instances of related classes
- Location: `tests/market/test_simulator_source.py`, `tests/market/test_massive.py`
- Examples:
  - `TestSimulatorDataSource.test_start_populates_cache`: test that `SimulatorDataSource.start()` actually updates the cache
  - `TestSimulatorDataSource.test_prices_update_over_time`: test the full update loop over time
  - `TestMassiveDataSource.test_poll_updates_cache`: test that polling fetches and caches prices

**E2E Tests:**
- Framework: Playwright (JavaScript, in `test/` directory)
- Run via: `docker-compose.test.yml`
- Scope: Full application from browser perspective
- Not in pytest (separate test infrastructure)

## Common Patterns

**Async Testing:**
```python
@pytest.mark.asyncio
async def test_start_populates_cache(self):
    """Test that start() immediately populates the cache."""
    cache = PriceCache()
    source = SimulatorDataSource(price_cache=cache, update_interval=0.1)
    await source.start(["AAPL", "GOOGL"])

    assert cache.get("AAPL") is not None
    assert cache.get("GOOGL") is not None

    await source.stop()
```

Key points:
- Use `@pytest.mark.asyncio` on the class or method
- All setup/act/assert awaits are explicit
- Always clean up with `await source.stop()` (teardown)
- Configured with `asyncio_mode = "auto"` in `pyproject.toml`

**Error Testing:**
```python
def test_immutability(self):
    """Test that PriceUpdate is immutable."""
    update = PriceUpdate(ticker="AAPL", price=190.50, previous_price=190.00, timestamp=1234567890.0)

    with pytest.raises(AttributeError):
        update.price = 200.00  # Should raise error
```

**Edge Cases:**
```python
def test_remove_nonexistent_is_noop(self):
    """Test that removing a non-existent ticker is a no-op."""
    sim = GBMSimulator(tickers=["AAPL"])
    sim.remove_ticker("NOPE")  # Should not raise

def test_change_percent_zero_previous(self):
    """Test percentage change with zero previous price."""
    update = PriceUpdate(ticker="AAPL", price=100.00, previous_price=0.00, timestamp=1234567890.0)
    assert update.change_percent == 0.0
```

**Timing Tests:**
```python
async def test_prices_update_over_time(self):
    """Test that prices are updated periodically."""
    cache = PriceCache()
    source = SimulatorDataSource(price_cache=cache, update_interval=0.05)
    await source.start(["AAPL"])

    initial_version = cache.version
    await asyncio.sleep(0.3)  # Several update cycles

    # Version should have incremented (prices updated)
    assert cache.version > initial_version

    await source.stop()
```

---

*Testing analysis: 2025-03-22*
