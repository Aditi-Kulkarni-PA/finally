# FinAlly — AI Trading Workstation

## Project Specification

## 1. Vision

FinAlly (Finance Ally) is a visually stunning AI-powered trading workstation that streams live market data, lets users trade a simulated portfolio, and integrates an LLM chat assistant that can analyze positions and execute trades on the user's behalf. It looks and feels like a modern Bloomberg terminal with an AI copilot.

This is the capstone project for an agentic AI coding course. It is built entirely by Coding Agents demonstrating how orchestrated AI agents can produce a production-quality full-stack application. Agents interact through files in `planning/`.

## 2. User Experience

### First Launch

The user runs a single Docker command (or a provided start script). A browser opens to `http://localhost:8000`. No login, no signup. They immediately see:

- A watchlist of 10 default tickers with live-updating prices in a grid
- $10,000 in virtual cash
- A dark, data-rich trading terminal aesthetic
- An AI chat panel ready to assist

### What the User Can Do

- **Watch prices stream** — prices flash green (uptick) or red (downtick) with subtle CSS animations that fade
- **View sparkline mini-charts** — price action beside each ticker in the watchlist, accumulated on the frontend from the SSE stream since page load (sparklines fill in progressively)
- **Click a ticker** to see a larger detailed chart in the main chart area
- **Buy and sell shares** — market orders only, instant fill at current price, no fees, no confirmation dialog
- **Monitor their portfolio** — a heatmap (treemap) showing positions sized by weight and colored by P&L, plus a P&L chart tracking total portfolio value over time
- **View a positions table** — ticker, quantity, average cost, current price, unrealized P&L, % change
- **Chat with the AI assistant** — ask about their portfolio, get analysis, and have the AI execute trades and manage the watchlist through natural language
- **Manage the watchlist** — add/remove tickers manually or via the AI chat
- **Trade bar UX**: The trade bar clears the quantity field after submission

### Visual Design

- **Dark theme**: backgrounds around `#0d1117` or `#1a1a2e`, muted gray borders, no pure black
- **Price flash animations**: brief green/red background highlight on price change, fading over ~500ms via CSS transitions
- **Connection status indicator**: a small colored dot (green = connected, yellow = reconnecting, red = disconnected) visible in the header
- **Professional, data-dense layout**: inspired by Bloomberg/trading terminals — every pixel earns its place
- **Responsive but desktop-first**: optimized for wide screens, functional on tablet


### Color Scheme
- Accent Yellow: `#ecad0a`
- Blue Primary: `#209dd7`
- Purple Secondary: `#753991` (submit buttons)

## 3. Architecture Overview

### Single Container, Single Port

```
┌─────────────────────────────────────────────────┐
│  Docker Container (port 8000)                   │
│                                                 │
│  FastAPI (Python/uv)                            │
│  ├── /api/*          REST endpoints             │
│  ├── /api/stream/*   SSE streaming              │
│  └── /*              Static file serving         │
│                      (Next.js export)            │
│                                                 │
│  SQLite database (volume-mounted)               │
│  Background task: market data polling/sim        │
└─────────────────────────────────────────────────┘
```

- **Frontend**: Next.js with TypeScript, built as a static export (`output: 'export'`), served by FastAPI as static files. The app is a single-route SPA — only `/` is the entry point. FastAPI must serve `index.html` for any request that does not match `/api/*` or a known static asset, so that browser refreshes and direct URL access always work.
- **Backend**: FastAPI (Python), managed as a `uv` project
- **Database**: SQLite, single file at `db/finally.db`, volume-mounted for persistence
- **Real-time data**: Server-Sent Events (SSE) — simpler than WebSockets, one-way server→client push, works everywhere
- **AI integration**: LiteLLM → OpenRouter (Cerebras for fast inference), with structured outputs for trade execution
- **Market data**: Environment-variable driven — simulator by default, real data via Massive API if key provided
- **Portfolio snapshots time recoding background task** will run alongside the market data source task under FastAPI's `lifespan` context manager.

### Why These Choices

| Decision | Rationale |
|---|---|
| SSE over WebSockets | One-way push is all we need; simpler, no bidirectional complexity, universal browser support |
| Static Next.js export | Single origin, no CORS issues, one port, one container, simple deployment |
| SQLite over Postgres | No auth = no multi-user = no need for a database server; self-contained, zero config |
| Single Docker container | Students run one command; no docker-compose for production, no service orchestration |
| uv for Python | Fast, modern Python project management; reproducible lockfile; what students should learn |
| Market orders only | Eliminates order book, limit order logic, partial fills — dramatically simpler portfolio math |

---

## 4. Directory Structure

```
finally/
├── frontend/                 # Next.js TypeScript project (static export)
├── backend/                  # FastAPI uv project (Python)
│   └── db/                   # Schema definitions, seed data, migration logic
├── planning/                 # Project-wide documentation for agents
│   ├── PLAN.md               # This document
│   └── ...                   # Additional agent reference docs
├── scripts/
│   ├── start_mac.sh          # Launch Docker container (macOS/Linux)
│   ├── stop_mac.sh           # Stop Docker container (macOS/Linux)
│   ├── start_windows.ps1     # Launch Docker container (Windows PowerShell)
│   └── stop_windows.ps1      # Stop Docker container (Windows PowerShell)
├── test/                     # Playwright E2E tests
│   └── docker-compose.test.yml  # Spins up app + Playwright containers for E2E runs
├── db/                       # Volume mount target (SQLite file lives here at runtime)
│   └── .gitkeep              # Directory exists in repo; finally.db is gitignored
├── Dockerfile                # Multi-stage build (Node → Python)
├── docker-compose.yml        # Optional convenience wrapper
├── .env                      # Environment variables (gitignored, .env.example committed)
└── .gitignore
```

### Key Boundaries

- **`frontend/`** is a self-contained Next.js project. It knows nothing about Python. It talks to the backend via `/api/*` endpoints and `/api/stream/*` SSE endpoints. Internal structure is up to the Frontend Engineer agent.
- **`backend/`** is a self-contained uv project with its own `pyproject.toml`. It owns all server logic including database initialization, schema, seed data, API routes, SSE streaming, market data, and LLM integration. The FastAPI application entry point is **`backend/app/main.py`**. Internal structure is up to the Backend/Market Data agents.
- **`backend/db/`** contains schema SQL definitions and seed logic. The backend initializes the database during FastAPI lifespan startup — creating tables and seeding default data if the SQLite file doesn't exist or is empty.
- **`db/`** at the top level is the runtime volume mount point. The SQLite file (`db/finally.db`) is created here by the backend and persists across container restarts via Docker volume.
- **`planning/`** contains project-wide documentation, including this plan. All agents reference files here as the shared contract.
- **`test/`** contains Playwright E2E tests and supporting infrastructure (e.g., `docker-compose.test.yml`). Unit tests live within `frontend/` and `backend/` respectively, following each framework's conventions.
- **`scripts/`** contains start/stop scripts that wrap Docker commands.

---

## 5. Environment Variables

```bash
# Required when LLM_MOCK=false: OpenRouter API key for LLM chat functionality
OPENROUTER_API_KEY=your-openrouter-api-key-here

# Optional: Massive API key for real market data
# If not set, the built-in market simulator is used (recommended for most users)
MASSIVE_API_KEY=

# Optional: Set to "true" for deterministic mock LLM responses (testing/dev without API key)
LLM_MOCK=false
```

### Behavior

- If `MASSIVE_API_KEY` is set and non-empty → backend uses Massive REST API for market data
- If `MASSIVE_API_KEY` is absent or empty → backend uses the built-in market simulator
- If `LLM_MOCK=true` → backend returns deterministic mock LLM responses; `OPENROUTER_API_KEY` is not required
- If `LLM_MOCK=false` (default) → `OPENROUTER_API_KEY` must be set
- The backend reads `.env` from the project root (read via docker `--env-file`)

---

## 6. Market Data

### Two Implementations, One Interface

Both the simulator and the Massive client implement the same abstract interface. The backend selects which to use based on the environment variable. All downstream code (SSE streaming, price cache, frontend) is agnostic to the source.

### Simulator (Default)

- Generates prices using geometric Brownian motion (GBM) with configurable drift and volatility per ticker
- Updates at ~500ms intervals
- Correlated moves across tickers (e.g., tech stocks move together)
- Occasional random "events" — sudden 2-5% moves on a ticker for drama
- Starts from realistic seed prices (e.g., AAPL ~$190, GOOGL ~$175, etc.)
- Runs as an in-process background task — no external dependencies

### Massive API (Optional)

- REST API polling (not WebSocket) — simpler, works on all tiers
- Polls for the union of all watched tickers on a configurable interval
- Free tier (5 calls/min): poll every 15 seconds
- Paid tiers: poll every 2-15 seconds depending on tier
- Parses REST response into the same format as the simulator

### Shared Price Cache

- A single background task (simulator or Massive poller) writes to an in-memory price cache
- The cache holds the latest price, previous price, and timestamp per ticker
- **Cache scope = union of watchlist tickers and open position tickers.** Adding a ticker to the watchlist starts tracking it. Removing a ticker from the watchlist evicts it from the cache only if the user holds no open position in that ticker — if a position exists, the ticker stays priced so P&L remains accurate. When a position is fully sold, the ticker is evicted from the cache unless it is still on the watchlist.
- SSE streams read from this cache and push updates to connected clients

### SSE Streaming

- Endpoint: `GET /api/stream/prices`
- Long-lived SSE connection; client uses native `EventSource` API
- Server pushes price updates at a regular cadence (~500ms) via a separate polling loop
- **Each SSE event is a full snapshot of all tickers currently in the cache**, sent as a single `data:` line containing a JSON object keyed by ticker symbol. Example:
  ```
  data: {"AAPL": {"ticker": "AAPL", "price": 190.50, "previous_price": 190.10, "timestamp": 1707580800.0, "change": 0.40, "change_percent": 0.21, "direction": "up"}, "GOOGL": {...}}
  ```
- The frontend must parse this full-snapshot format — not individual per-ticker events
- Fields per ticker: `ticker`, `price`, `previous_price`, `timestamp`, `change` (absolute), `change_percent`, `direction` (`"up"/"down"/"flat"`)
- A `retry:` directive (e.g. `retry: 3000`) is sent at the start of each connection to configure reconnect timing
- Client handles reconnection automatically (EventSource has built-in retry)

---

## 7. Database

### SQLite Initialization at Startup

The backend initializes the database as an explicit step during the FastAPI `lifespan` startup, before background tasks (market data, portfolio snapshots) begin. If the file doesn't exist or tables are missing, it creates the schema and seeds default data. This means:

- No separate migration step
- No manual database setup
- Fresh Docker volumes start with a clean, seeded database automatically
- Background tasks can safely read seeded watchlist data from the moment they start

**Database access:** Use `aiosqlite` with plain SQL strings. No ORM. This keeps the layer simple and dependency-light while being non-blocking in async routes.

**Required backend dependencies** (add to `pyproject.toml` before building these components):
- `aiosqlite` — async SQLite access
- `litellm` — LLM API calls
- `pydantic` — structured output validation

### Schema

All tables include a `user_id` column defaulting to `"default"`. This is hardcoded for now (single-user) but enables future multi-user support without schema migration.

**users_profile** — User state (cash balance)
- `id` TEXT PRIMARY KEY (default: `"default"`)
- `cash_balance` REAL (default: `10000.0`)
- `created_at` TEXT (ISO timestamp)

**watchlist** — Tickers the user is watching
- `id` TEXT PRIMARY KEY (UUID)
- `user_id` TEXT (default: `"default"`)
- `ticker` TEXT
- `added_at` TEXT (ISO timestamp)
- UNIQUE constraint on `(user_id, ticker)`

**positions** — Current holdings (one row per ticker per user)
- `id` TEXT PRIMARY KEY (UUID)
- `user_id` TEXT (default: `"default"`)
- `ticker` TEXT
- `quantity` REAL (fractional shares supported)
- `avg_cost` REAL
- `updated_at` TEXT (ISO timestamp)
- UNIQUE constraint on `(user_id, ticker)`

**trades** — Trade history (append-only log)
- `id` TEXT PRIMARY KEY (UUID)
- `user_id` TEXT (default: `"default"`)
- `ticker` TEXT
- `side` TEXT (`"buy"` or `"sell"`)
- `quantity` REAL (fractional shares supported)
- `price` REAL
- `executed_at` TEXT (ISO timestamp)

**portfolio_snapshots** — Portfolio value over time (for P&L chart). Recorded every 30 seconds by a background task, and immediately after each trade execution.
- `id` TEXT PRIMARY KEY (UUID)
- `user_id` TEXT (default: `"default"`)
- `total_value` REAL
- `recorded_at` TEXT (ISO timestamp)

The snapshot background task computes `total_value` by summing `position.quantity * cache.get_price(ticker)` for all positions, plus cash balance. Factor this into a shared `calculate_portfolio_value(positions, cash, price_cache)` utility function — it is also needed by `GET /api/portfolio` and should not be duplicated. If a ticker is in positions but has no price in the cache (e.g. startup race or removed from watchlist), fall back to `avg_cost` as the current price, making unrealized P&L zero for that position.



**chat_messages** — Conversation history with LLM
- `id` TEXT PRIMARY KEY (UUID)
- `user_id` TEXT (default: `"default"`)
- `role` TEXT (`"user"` or `"assistant"`)
- `content` TEXT
- `actions` TEXT (JSON — trades executed, watchlist changes made; null for user messages)
- `created_at` TEXT (ISO timestamp)

### Default Seed Data

- One user profile: `id="default"`, `cash_balance=10000.0`
- Ten watchlist entries: AAPL, GOOGL, MSFT, AMZN, TSLA, NVDA, META, JPM, V, NFLX

---

## 8. API Endpoints

### Market Data
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/stream/prices` | SSE stream of live price updates |

### Portfolio
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/portfolio` | Current positions, cash balance, total value, unrealized P&L |
| POST | `/api/portfolio/trade` | Execute a trade: `{ticker, quantity, side}` — returns `200` on success, `400` on validation failure |
| GET | `/api/portfolio/history` | Portfolio value snapshots over time (for P&L chart) |

**Trade validation rules** (applied to both manual trades and LLM-requested trades):
- `quantity` must be a positive number (> 0); zero or negative quantities return `400`
- `side` must be `"buy"` or `"sell"`
- `ticker` must have a current price in the cache; trades on unknown/untracked tickers return `400`
- Buy: sufficient cash required (`cash >= quantity * current_price`)
- Sell: sufficient shares required (`position.quantity >= requested_quantity`); short selling is not supported
- On failure, return `{"detail": "<reason string>"}` with HTTP `400`

### Watchlist
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/watchlist` | Array of `{ticker, price, previous_price, change, direction}` from the price cache; `price` is null if not yet cached |
| POST | `/api/watchlist` | Add a ticker: `{ticker}` |
| DELETE | `/api/watchlist/{ticker}` | Remove a ticker |

**Ticker normalisation:** All watchlist API endpoints must normalise the ticker to `ticker.upper().strip()` before writing to the database or calling `source.add_ticker` / `source.remove_ticker`. This ensures consistency between the simulator and Massive API, and prevents case-mismatch bugs in the price cache.

### Chat
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chat` | Send a message, receive complete JSON response (message + executed actions) |
| GET | `/api/chat/history` | fetch existing conversation history, even when the page reloads |


### System
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check (for Docker/deployment) |

---

## 9. LLM Integration

LLM calls use LiteLLM via OpenRouter with the `openrouter/openai/gpt-oss-120b` model and Cerebras as the inference provider. Structured Outputs are used to interpret the results.

**Async requirement:** The chat endpoint is an `async def` FastAPI route. Always use `await litellm.acompletion(...)` — never the synchronous `litellm.completion(...)` — to avoid blocking the event loop.

### How It Works

When the user sends a chat message, the backend:

1. Loads the user's current portfolio context (cash, positions with P&L, watchlist with live prices, total portfolio value)
2. Loads recent conversation history from the `chat_messages` table
3. Constructs a prompt with a system message, portfolio context, conversation history, and the user's new message
4. Calls the LLM via LiteLLM → OpenRouter, requesting structured output
5. Parses the complete structured JSON response
6. Auto-executes any trades or watchlist changes specified in the response
7. Stores the message and executed actions in `chat_messages`
8. Returns the complete JSON response to the frontend (no token-by-token streaming — Cerebras inference is fast enough that a loading indicator is sufficient)
9. When the LLM emits a `watchlist_changes` entry for a ticker already in the watchlist (action: "add"), or tries to remove a ticker not in the watchlist, backend should handle it — silently ignore. 

### Structured Output Schema

The LLM is instructed to respond with JSON matching this schema:

```json
{
  "message": "Your conversational response to the user",
  "trades": [
    {"ticker": "AAPL", "side": "buy", "quantity": 10}
  ],
  "watchlist_changes": [
    {"ticker": "PYPL", "action": "add"}
  ]
}
```

- `message` (required): The conversational text shown to the user
- `trades` (optional): Array of trades to auto-execute. Each trade goes through the same validation as manual trades (sufficient cash for buys, sufficient shares for sells)
- `watchlist_changes` (optional): Array of watchlist modifications

### Auto-Execution

Trades specified by the LLM execute automatically — no confirmation dialog. This is a deliberate design choice:
- It's a simulated environment with fake money, so the stakes are zero
- It creates an impressive, fluid demo experience
- It demonstrates agentic AI capabilities — the core theme of the course

Trades from the LLM go through the same validation as manual trades (sufficient cash for buys, sufficient shares for sells). This validation is owned by the trade execution function, reused from the `POST /api/portfolio/trade` route.

### `POST /api/chat` Response Schema

The endpoint always returns HTTP 200 with this shape:

```json
{
  "message": "Here is your portfolio analysis...",
  "trades_executed": [
    {"ticker": "AAPL", "side": "buy", "quantity": 10, "price": 189.50, "status": "ok"}
  ],
  "trades_failed": [
    {"ticker": "TSLA", "side": "buy", "quantity": 100, "reason": "Insufficient cash"}
  ],
  "watchlist_changes": [
    {"ticker": "PYPL", "action": "add", "status": "ok"}
  ]
}
```

- `trades_executed`: trades that succeeded, with the fill price
- `trades_failed`: trades the LLM requested but validation rejected, with a reason string
- `watchlist_changes`: add/remove actions; silently omitted if the ticker was already in the desired state
- All arrays may be empty; they are always present (not null) for easy frontend rendering

### System Prompt Guidance

The LLM should be prompted as "FinAlly, an AI trading assistant" with instructions to:
- Analyze portfolio composition, risk concentration, and P&L
- Suggest trades with reasoning
- Execute trades when the user asks or agrees
- Manage the watchlist proactively
- Be concise and data-driven in responses
- Always respond with valid structured JSON

### LLM Mock Mode

When `LLM_MOCK=true`, the backend returns deterministic mock responses instead of calling OpenRouter. This enables:
- Fast, free, reproducible E2E tests
- Development without an API key
- CI/CD pipelines

Use one canonical mock JSON response, so the backend and E2E test agents produce consistent behavior without needing to coordinate. The canonical mock response is:

```json
{
  "message": "I've reviewed your portfolio. You have $10,000 in cash and no open positions. Consider buying some AAPL to get started.",
  "trades": [],
  "watchlist_changes": []
}
```

Define this as a constant (`MOCK_LLM_RESPONSE`) in the LLM module so E2E tests can assert against it without coordination.

---

## 10. Frontend Design

### Layout

The frontend is a single-page application with a dense, terminal-inspired layout. The specific component architecture and layout system is up to the Frontend Engineer, but the UI should include these elements:

- **Watchlist panel** — grid/table of watched tickers with: ticker symbol, current price (flashing green/red on change), tick-to-tick change % (derived from `change` and `previous_price` in the SSE event — no daily open/close is available from the simulator), and a sparkline mini-chart (accumulated from SSE since page load)
- **Main chart area** — larger chart for the currently selected ticker, with at minimum price over time. Clicking a ticker in the watchlist selects it here.
- **Portfolio heatmap** — treemap visualization where each rectangle is a position, sized by portfolio weight, colored by P&L (green = profit, red = loss)
- **P&L chart** — line chart showing total portfolio value over time, using data from `portfolio_snapshots`
- **Positions table** — tabular view of all positions: ticker, quantity, avg cost, current price, unrealized P&L, % change
- **Trade bar** — simple input area: ticker field, quantity field, buy button, sell button. Market orders, instant fill.
- **AI chat panel** — docked/collapsible sidebar, oen-by-default. Message input, scrolling conversation history, loading indicator while waiting for LLM response. Trade executions and watchlist changes shown inline as confirmations.
- **Header** — portfolio total value (updating live), connection status indicator, cash balance

### Technical Notes

- Use `EventSource` for SSE connection to `/api/stream/prices`
- Canvas-based charting library preferred (Lightweight Charts) for performance
- Price flash effect: on receiving a new price, briefly apply a CSS class with background color transition, then remove it
- All API calls go to the same origin (`/api/*`) — no CORS configuration needed
- Tailwind CSS for styling with a custom dark theme


---

## 11. Docker & Deployment

### Multi-Stage Dockerfile

```
Stage 1: Node 20 slim
  - Copy frontend/
  - npm install && npm run build (produces static export)

Stage 2: Python 3.12 slim
  - Install uv
  - Copy backend/
  - uv sync (install Python dependencies from lockfile)
  - Copy frontend build output into a static/ directory
  - Expose port 8000
  - CMD: uvicorn serving FastAPI app
```

FastAPI serves the static frontend files and all API routes on port 8000.

### Docker Volume

The SQLite database persists via a named Docker volume. The canonical run command is:

```bash
docker run -v finally-data:/app/db -p 8000:8000 --env-file .env finally
```

The named volume `finally-data` is mounted at `/app/db` inside the container. The backend writes `finally.db` to this path. The `db/` directory in the project root is only a placeholder to keep the path in version control — it is not bind-mounted at runtime.

### Start/Stop Scripts

**`scripts/start_mac.sh`** (macOS/Linux):
- Builds the Docker image if not already built (or if `--build` flag passed)
- Runs the container with the volume mount, port mapping, and `.env` file
- Prints the URL to access the app
- Optionally opens the browser

**`scripts/stop_mac.sh`** (macOS/Linux):
- Stops and removes the running container
- Does NOT remove the volume (data persists)

**`scripts/start_windows.ps1`** / **`scripts/stop_windows.ps1`**: PowerShell equivalents for Windows.

All scripts should be idempotent — safe to run multiple times.

### Optional Cloud Deployment

The container is designed to deploy to AWS App Runner, Render, or any container platform. A Terraform configuration for App Runner may be provided in a `deploy/` directory as a stretch goal, but is not part of the core build.

---

## 12. Testing Strategy

### Unit Tests (within `frontend/` and `backend/`)

**Backend (pytest)**:
- Market data: simulator generates valid prices, GBM math is correct, Massive API response parsing works, both implementations conform to the abstract interface
- Portfolio: trade execution logic, P&L calculations, edge cases (selling more than owned, buying with insufficient cash, selling at a loss)
- LLM: structured output parsing handles all valid schemas, graceful handling of malformed responses, trade validation within chat flow
- API routes: correct status codes, response shapes, error handling

**Frontend (React Testing Library or similar)**:
- Component rendering with mock data
- Price flash animation triggers correctly on price changes
- Watchlist CRUD operations
- Portfolio display calculations
- Chat message rendering and loading state

### E2E Tests (in `test/`)

**Infrastructure**: A separate `docker-compose.test.yml` in `test/` that spins up the app container plus a Playwright container. This keeps browser dependencies out of the production image.

**Environment**: Tests run with `LLM_MOCK=true` by default for speed and determinism.

**Key Scenarios**:
- Fresh start: default watchlist appears, $10k balance shown, prices are streaming
- Add and remove a ticker from the watchlist
- Buy shares: cash decreases, position appears, portfolio updates
- Sell shares: cash increases, position updates or disappears
- Portfolio visualization: heatmap renders with correct colors, P&L chart has data points
- AI chat (mocked): send a message, receive a response, trade execution appears inline
- SSE resilience: simulate disconnect via Playwright `page.route('**/api/stream/prices', route => route.abort())`, then unblock and verify the `EventSource` reconnects and prices resume updating

---

## 13. Open Questions

*Updated 2026-03-22.*

**Resolved questions** (documented here for agent reference):
- FastAPI entry point: `backend/app/main.py`
- Database access: `aiosqlite` with plain SQL
- DB initialization: explicit at lifespan startup, before background tasks
- SSE format: full snapshot dict per cycle (all tickers), not one event per ticker
- Ticker normalisation: `ticker.upper().strip()` at API boundary before DB writes and cache calls
- LLM model: `openrouter/openai/gpt-oss-120b` with `extra_body={"provider": {"order": ["cerebras"]}}` — this is the confirmed model string; `OPENROUTER_API_KEY` is only required when `LLM_MOCK=false`
- LLM calls: `await litellm.acompletion(...)` — async only
- Canonical mock response: defined in section 9 as `MOCK_LLM_RESPONSE` constant
- Price cache scope: union of watchlist tickers + open position tickers (see §6)
- Trade validation failures: HTTP `400` with `{"detail": "<reason>"}` (see §8)
- Trades on non-watchlist tickers: rejected with `400` if ticker has no cached price
- Docker volume: named volume `finally-data` is canonical; `db/` in project root is a placeholder only
- `OPENROUTER_API_KEY`: required only when `LLM_MOCK=false`
- Fractional shares: supported in DB and trade logic; UI displays up to 4 decimal places

---
