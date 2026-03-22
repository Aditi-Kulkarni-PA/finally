# FinAlly — AI Trading Workstation

An AI-powered trading workstation that streams live market data, supports simulated portfolio trading, and includes an LLM chat assistant that can analyze positions and execute trades on your behalf. Designed to look and feel like a modern Bloomberg terminal with an AI copilot.

## Features

- **Live price streaming** via Server-Sent Events — prices flash green/red on change
- **Sparkline mini-charts** per ticker, built from the live price stream
- **Simulated portfolio** — $10,000 starting cash, instant market order fills
- **Portfolio heatmap** (treemap) — positions sized by weight, colored by P&L
- **P&L chart** — total portfolio value over time
- **AI chat assistant** — powered by Cerebras/OpenRouter; analyzes positions and executes trades via natural language
- **Watchlist management** — add/remove tickers manually or through the AI

## Quick Start

```bash
# Copy and configure environment variables
cp .env.example .env
# Edit .env — set OPENROUTER_API_KEY (or set LLM_MOCK=true for development)

# Start the app
./scripts/start_mac.sh        # macOS/Linux
./scripts/start_windows.ps1   # Windows PowerShell
```

Open [http://localhost:8000](http://localhost:8000) in your browser.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | Yes (unless `LLM_MOCK=true`) | OpenRouter API key for LLM chat |
| `MASSIVE_API_KEY` | No | Real market data; omit to use the built-in simulator |
| `LLM_MOCK` | No | Set `true` for deterministic mock LLM responses (no API key needed) |

## Architecture

Single Docker container on port 8000:

- **Frontend**: Next.js (TypeScript), built as a static export, served by FastAPI
- **Backend**: FastAPI (Python/uv) — REST API, SSE streaming, LLM integration
- **Database**: SQLite at `db/finally.db`, persisted via Docker named volume
- **Market data**: Built-in GBM simulator (default) or Massive REST API
- **AI**: LiteLLM → OpenRouter → Cerebras (`openai/gpt-oss-120b`)

## Development

### Backend

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Tests

```bash
# Backend unit tests
cd backend && uv run pytest

# E2E tests (requires Docker)
cd test && docker compose -f docker-compose.test.yml up
```

## Docker

```bash
# Build and run
docker build -t finally .
docker run -v finally-data:/app/db -p 8000:8000 --env-file .env finally
```

## License

MIT
