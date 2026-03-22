# External Integrations

**Analysis Date:** 2026-03-22

## APIs & External Services

**Market Data:**
- Polygon.io (via Massive SDK) - Real-time and historical stock price data
  - SDK/Client: `massive` package (RESTful, not WebSocket)
  - Auth: `MASSIVE_API_KEY` environment variable
  - Activation: Automatic when env var is set; optional (simulator used if absent)
  - Implementation: `backend/app/market/massive_client.py` (`MassiveDataSource` class)
  - Rate limiting: Free tier (5 req/min) polls every 15s; paid tiers adjust polling interval
  - Endpoint: `GET /v2/snapshot/locale/us/markets/stocks/tickers`

**LLM & AI:**
- OpenRouter (Cerebras inference) - AI trading assistant chat
  - SDK/Client: `litellm` (not yet added to dependencies; planned for portfolio/chat phases)
  - Auth: `OPENROUTER_API_KEY` environment variable
  - Model: `openrouter/openai/gpt-oss-120b` with `extra_body={"provider": {"order": ["cerebras"]}}`
  - Mode: `LLM_MOCK` environment variable enables deterministic mock responses for testing (default: false)
  - Activation: Required when `LLM_MOCK=false`; omitted when `LLM_MOCK=true` or during tests
  - Mock Response: Defined as constant in LLM module: `{"message": "I've reviewed your portfolio...", "trades": [], "watchlist_changes": []}`
  - Usage: Structured outputs for parsing trades, watchlist changes, and conversational responses
  - Implementation location: `backend/app/llm/` (currently empty, planned)

## Data Storage

**Databases:**
- SQLite
  - File path: `db/finally.db` (volume-mounted in Docker at `/app/db/finally.db`)
  - Client: `aiosqlite` (planned; provides async SQLite access without blocking event loop)
  - Access pattern: Plain SQL strings (no ORM)
  - Initialization: Automatic during FastAPI lifespan startup; schema created and default data seeded if file is missing or empty
  - Schema tables:
    - `users_profile` - User state (cash balance, created timestamp)
    - `watchlist` - Tracked tickers (user_id, ticker, added_at)
    - `positions` - Current holdings (user_id, ticker, quantity, avg_cost)
    - `trades` - Trade history (user_id, ticker, side, quantity, price, executed_at)
    - `portfolio_snapshots` - Portfolio value over time (user_id, total_value, recorded_at)
    - `chat_messages` - Conversation history (user_id, role, content, actions, created_at)
  - Single user: All tables include `user_id` column defaulting to `"default"` (hardcoded for MVP, enables future multi-user)

**File Storage:**
- Local filesystem only
  - Frontend static assets: Served from `backend/static/` (Next.js build output mounted here)
  - Database file: `db/finally.db` in Docker volume

**Caching:**
- In-memory price cache (no external service)
  - Implementation: `backend/app/market/cache.py` (`PriceCache` class)
  - Thread-safe with lock
  - Scope: Union of watchlist tickers + open position tickers
  - Used by: SSE streaming, portfolio valuation, trade execution

## Authentication & Identity

**Auth Provider:**
- None (single-user MVP)
  - Implementation: Hardcoded `user_id="default"` in all database operations
  - No login, signup, or session management
  - Future: Multi-user support designed into schema (user_id column in all tables)

## Monitoring & Observability

**Error Tracking:**
- None configured
  - Planned: Could integrate Sentry or similar for production
  - Current: Logging via Python `logging` module

**Logs:**
- Python standard `logging` module
  - Output: stdout/stderr in container (captured by Docker logs)
  - Log levels: INFO (market data updates, SSE connections), WARNING (API misses), ERROR (exceptions)
  - Loggers per module: `backend/app/market/` modules log data source events, SSE client lifecycle

## CI/CD & Deployment

**Hosting:**
- Docker container (single port 8000)
  - Registry: Not specified; can push to Docker Hub, ECR, or container platform of choice
  - Deployment targets: AWS App Runner, Render, Heroku, or any Docker-compatible platform
  - Volume persistence: Named Docker volume `finally-data` mounts to `/app/db`

**CI Pipeline:**
- GitHub Actions (optional, configured in `.github/workflows/`)
  - Trigger: Pull requests, pushes to main/develop branches (not yet fully configured)
  - Stages: Lint (ruff), tests (pytest), build Docker image (optional push)
  - Current status: Workflows exist (e.g., code review); full CI not required for MVP

**Build Process:**
- Multi-stage Dockerfile
  - Stage 1: Node.js 20 slim → build Next.js static export
  - Stage 2: Python 3.12 slim → install `uv`, dependencies, copy frontend static files, expose port 8000
  - Entry point: `uvicorn backend.app.main:app --host 0.0.0.0 --port 8000` (assumed; app.main not yet implemented)

## Environment Configuration

**Required env vars:**
- `OPENROUTER_API_KEY` - Required when `LLM_MOCK=false` (no default); chat functionality fails without it
- None others strictly required (all are optional or have sensible defaults)

**Optional env vars:**
- `MASSIVE_API_KEY` - Enables real market data; if absent, built-in simulator is used (recommended default)
- `LLM_MOCK` - Set to `"true"` for deterministic mock LLM responses (testing/demo without API key)
- `OPENAI_MODEL` - Model name, default `"gpt-oss-120b"`
- `MODEL` - Duplicate of `OPENAI_MODEL` (consolidation candidate)

**Secrets location:**
- `.env` file in project root (gitignored; must not be committed)
- At runtime: Loaded by `python-dotenv` during application startup
- In Docker: Passed via `--env-file .env` flag in run command
- Example file: Create `.env.example` with placeholder values for documentation

## Webhooks & Callbacks

**Incoming:**
- None configured
  - Potential future: Webhook receiver for Polygon.io price alerts (low priority)

**Outgoing:**
- None

---

*Integration audit: 2026-03-22*
