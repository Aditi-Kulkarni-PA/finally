# Architecture

**Analysis Date:** 2026-03-22

## Pattern Overview

**Overall:** Layered async application with pluggable market data source and streaming real-time data to clients.

**Key Characteristics:**
- FastAPI web framework with async/await throughout
- Factory-based dependency injection (e.g., market data source selection)
- Thread-safe in-memory cache serving as the single source of truth for prices
- Abstract interface for swappable market data implementations
- Server-Sent Events (SSE) for one-way streaming to clients
- Built-in GBM (Geometric Brownian Motion) simulator for market data generation

## Layers

**Market Data Layer:**
- Purpose: Produce and maintain live price data from either simulation or real API
- Location: `backend/app/market/`
- Contains: `MarketDataSource` implementations (simulator, Massive API), `PriceCache`, data models
- Depends on: external Massive API (conditional), numpy for GBM math
- Used by: SSE streaming endpoint, portfolio valuation logic, trade execution logic

**Caching Layer:**
- Purpose: Provide thread-safe, high-performance access to latest prices
- Location: `backend/app/market/cache.py`
- Contains: `PriceCache` class with version-based change detection
- Depends on: nothing external
- Used by: all downstream consumers of prices (streaming, portfolio, trading)

**Streaming Layer:**
- Purpose: Deliver live price updates to connected browser clients
- Location: `backend/app/market/stream.py`
- Contains: FastAPI router factory, SSE generator, client connection management
- Depends on: `PriceCache`, FastAPI
- Used by: frontend via `GET /api/stream/prices` endpoint

**API Layer:**
- Purpose: Expose REST endpoints for portfolio, trades, watchlist, chat, health
- Location: `backend/app/routes/` (directory structure to be implemented)
- Contains: Route handlers, request/response models, validation
- Depends on: Database, `PriceCache`, LLM client
- Used by: Frontend application and E2E tests

**Database Layer:**
- Purpose: Persist user profiles, positions, trades, watchlist, chat history, portfolio snapshots
- Location: `backend/db/` (schema and seed logic)
- Contains: SQLite schema definitions, seed data, initialization logic
- Depends on: aiosqlite
- Used by: All routes that need state persistence

**LLM Integration Layer:**
- Purpose: Process user chat messages and generate structured trade/watchlist actions
- Location: `backend/app/llm/` (to be implemented)
- Contains: LLM client wrapper, structured output parsing, mock response handler
- Depends on: litellm, OpenRouter API (conditional)
- Used by: Chat endpoint for processing user messages

## Data Flow

**Price Update Flow (Simulator):**

1. `SimulatorDataSource` background task runs every 500ms
2. Calls `GBMSimulator.step()` to compute new prices using correlated random walks
3. Writes each price to `PriceCache.update(ticker, price)`
4. Cache bumps version counter for change detection
5. SSE generator polls cache every 500ms, detects version change
6. Sends full price snapshot as JSON to all connected clients via `EventSource`
7. Frontend receives snapshot, updates UI, accumulates sparkline data

**Trade Execution Flow:**

1. User submits trade via `POST /api/portfolio/trade`
2. Request validation: quantity > 0, side in ("buy"/"sell"), ticker has cached price
3. Business logic validation: sufficient cash (buy) or shares (sell)
4. If valid: execute trade, update `positions` table, update `users_profile.cash_balance`
5. Append to `trades` table (audit log)
6. Compute and insert `portfolio_snapshots` entry (for P&L chart)
7. Return trade details and updated portfolio state

**Chat Flow:**

1. User sends message via `POST /api/chat`
2. Backend loads portfolio context (cash, positions, prices, P&L)
3. Loads recent chat history from `chat_messages` table
4. Constructs prompt with system instructions, context, conversation history
5. Calls LLM via LiteLLM → OpenRouter with structured output request
6. Parses response JSON for message + trades + watchlist_changes
7. Auto-executes trades (same validation as manual trades) and watchlist operations
8. Stores conversation in `chat_messages` table with actions taken
9. Returns complete response to frontend

**Portfolio Valuation Flow:**

1. When queried via `GET /api/portfolio`:
   - Fetch all positions for user
   - For each position: price = `cache.get_price(ticker)` or fallback to `avg_cost`
   - Compute unrealized P&L = `quantity * (price - avg_cost)`
   - Sum all P&Ls + cash_balance = total portfolio value
2. Background task records snapshot every 30s and after each trade
3. Snapshots persist to `portfolio_snapshots` table for historical charting

**State Management:**

- **In-Memory (Volatile):** Price cache — fast reads, not persistent
- **Persistent (SQLite):** User profiles, positions, trades, watchlist, chat history, portfolio snapshots
- **Computed (On-Demand):** Portfolio value, P&L — calculated from positions + prices
- **Source of Truth:** Cache is authoritative for current prices; DB is authoritative for all other state

## Key Abstractions

**PriceUpdate:**
- Purpose: Immutable snapshot of a single ticker's price with computed metadata
- Examples: `backend/app/market/models.py`
- Pattern: Frozen dataclass with computed properties (`change`, `change_percent`, `direction`, `to_dict()`)
- Use: Pass between cache, streaming, and API layers; serialize to JSON for clients

**PriceCache:**
- Purpose: Thread-safe, high-performance price storage with change detection
- Examples: `backend/app/market/cache.py`
- Pattern: Lock-protected dictionary with monotonic version counter
- Use: Single point of access for all price reads; SSE uses version to detect changes

**MarketDataSource (Interface):**
- Purpose: Pluggable abstraction for different market data providers
- Examples: `backend/app/market/interface.py`, `backend/app/market/simulator.py`, `backend/app/market/massive_client.py`
- Pattern: Abstract base class with lifecycle methods (start/stop, add_ticker/remove_ticker, get_tickers)
- Use: Factory selects implementation at startup; downstream code never knows if prices are real or simulated

**GBMSimulator:**
- Purpose: Generate realistic correlated stock price movements using Geometric Brownian Motion
- Examples: `backend/app/market/simulator.py`
- Pattern: Maintains per-ticker state (current price, GBM parameters) and correlation matrix (Cholesky decomposition)
- Use: Called in tight loop by simulator background task; produces dict of prices per step

**SimulatorDataSource:**
- Purpose: Wrap GBMSimulator in MarketDataSource interface, manage background task lifecycle
- Examples: `backend/app/market/simulator.py` (class `SimulatorDataSource`)
- Pattern: Owns the simulator instance and async background task; runs `step()` every 500ms, writes to cache
- Use: Selected when `MASSIVE_API_KEY` not set

**MassiveDataSource:**
- Purpose: Wrap Massive (Polygon.io) REST API in MarketDataSource interface, manage polling lifecycle
- Examples: `backend/app/market/massive_client.py`
- Pattern: Owns the REST client and async polling task; calls API every 15s (free tier), writes to cache
- Use: Selected when `MASSIVE_API_KEY` is set

## Entry Points

**FastAPI Application:**
- Location: `backend/app/main.py` (to be implemented, currently does not exist)
- Triggers: `uvicorn backend.app.main:app` command; Docker container startup
- Responsibilities:
  - Initialize FastAPI app
  - Set up lifespan context manager (startup/shutdown hooks)
  - Create PriceCache
  - Create and start market data source during startup
  - Attach SSE router and API routers
  - Serve static frontend files
  - Graceful shutdown: stop market data source, close DB connections

**Background Task: Market Data Source**
- Triggers: Runs during FastAPI lifespan startup
- Responsibilities: Poll or simulate prices, write to cache every 500ms (simulator) or 15s (Massive)
- Lifecycle: Started by `source.start(tickers)` on app startup; stopped by `source.stop()` on shutdown

**Background Task: Portfolio Snapshots**
- Triggers: Runs every 30s during app lifespan; also triggered immediately after each trade
- Responsibilities: Compute total portfolio value (positions + cash), insert into `portfolio_snapshots` table
- Lifecycle: Similar to market data source; started/stopped via lifespan context manager

**SSE Endpoint:**
- Location: `backend/app/market/stream.py` (router registered in main.py)
- Path: `GET /api/stream/prices`
- Triggers: Browser opens EventSource connection
- Responsibilities: Poll cache every 500ms, detect version change, send full price snapshot as JSON

**REST API Endpoints:**
- Location: `backend/app/routes/` (to be implemented)
- Examples:
  - `POST /api/portfolio/trade` — Execute buy/sell order
  - `GET /api/portfolio` — Get positions, cash, P&L
  - `GET /api/watchlist` — Get watched tickers with current prices
  - `POST /api/chat` — Send message, get LLM response with auto-executed actions
  - `GET /api/health` — Health check for deployment
- Triggers: Client HTTP requests
- Responsibilities: Validate input, fetch data from cache/DB, execute business logic, return JSON

## Error Handling

**Strategy:** Fail-safe approach with reasonable defaults

**Patterns:**

- **Price Not Available:** When a ticker is in positions but has no cache entry (race condition, ticker removed from watchlist), fall back to `avg_cost` for portfolio valuation. This makes unrealized P&L zero for that position temporarily, a safe conservative assumption.

- **Trade Validation Failures:** Return HTTP 400 with `{"detail": "<reason string>"}` for any validation failure (insufficient cash, insufficient shares, unknown ticker, invalid quantity). No silent failures.

- **LLM Response Parsing Failures:** If structured output is malformed or missing required fields, the endpoint returns HTTP 200 with empty trade/watchlist arrays and a fallback message. Never propagate LLM errors to frontend; graceful degradation.

- **Watchlist Operations:** If LLM requests adding a ticker already in the watchlist or removing one not in it, silently ignore (idempotent behavior). Downstream code handles these no-ops.

- **SSE Client Disconnect:** Detected via `await request.is_disconnected()`, generator cleanly breaks out of loop, connection closes. Client's EventSource automatically retries per `retry:` directive.

- **Database Errors:** Async database operations wrap in try-except; return HTTP 500 with `{"detail": "database error"}` if unexpected. Standard 500 error handling strategy.

## Cross-Cutting Concerns

**Logging:**
- Use Python's `logging` module; loggers named per module (`logger = logging.getLogger(__name__)`)
- Market data source logs startup/shutdown and ticker add/remove operations
- SSE logs client connections and disconnections
- Routes log request/response summary for debugging

**Validation:**
- Ticker normalization: `ticker.upper().strip()` at API boundary (watchlist and trade endpoints) before DB/cache writes
- Trade validation owned by a shared function, reused by manual trade endpoint and LLM chat flow
- Structured output validation via Pydantic models for LLM responses

**Authentication:**
- Single-user hardcoded (user_id = "default") throughout the stack
- All DB queries default to `user_id="default"` in WHERE clauses
- No auth middleware needed; app is unsecured by design (simulated environment)

**Concurrency:**
- Background tasks run in separate asyncio tasks started via `asyncio.create_task()`
- Price cache uses threading.Lock() for thread-safe access (writers may be in separate threads/tasks)
- Database access is async-only via aiosqlite to avoid blocking event loop
- FastAPI handles request concurrency via async route handlers

---

*Architecture analysis: 2026-03-22*
