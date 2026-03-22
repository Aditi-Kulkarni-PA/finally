# FinAlly — AI Trading Workstation

## What This Is

FinAlly (Finance Ally) is a visually stunning AI-powered trading workstation that streams live market data, lets users trade a simulated portfolio, and integrates an LLM chat assistant that can analyze positions and execute trades on the user's behalf. It looks and feels like a modern Bloomberg terminal with an AI copilot. Built as a capstone project demonstrating orchestrated AI agents producing a production-quality full-stack application.

## Core Value

A user can open the app, watch live prices stream, trade with fake money, and ask the AI to analyze or manage their portfolio — all in one dark-themed terminal aesthetic, served from a single Docker container.

## Requirements

### Validated

- ✓ Market data subsystem (simulator + Massive API) — existing
- ✓ SSE stream endpoint (/api/stream/prices) — existing
- ✓ PriceCache with thread-safe access — existing
- ✓ 73 passing market data unit tests — existing

### Active

- [ ] FastAPI app entry point (backend/app/main.py) with lifespan startup
- [ ] Database: SQLite via aiosqlite, initialized at startup with seed data
- [ ] Portfolio API: GET /api/portfolio, POST /api/portfolio/trade, GET /api/portfolio/history
- [ ] Watchlist API: GET/POST/DELETE /api/watchlist with ticker normalization
- [ ] Portfolio snapshot background task (every 30s + on trade)
- [ ] LLM chat integration: LiteLLM → OpenRouter/Cerebras with structured outputs
- [ ] Chat API: POST /api/chat, GET /api/chat/history
- [ ] LLM mock mode (LLM_MOCK=true) for testing
- [ ] Frontend: Next.js TypeScript static export, Bloomberg terminal aesthetic
- [ ] Watchlist panel with price flash animations and sparklines
- [ ] Main chart area (Lightweight Charts) for selected ticker
- [ ] Portfolio heatmap (treemap), P&L chart, positions table
- [ ] Trade bar: ticker + quantity + buy/sell, instant fill
- [ ] AI chat panel with inline trade confirmations
- [ ] Header: total value, cash, connection status indicator
- [ ] Multi-stage Dockerfile, docker-compose.yml
- [ ] start/stop scripts for macOS and Windows
- [ ] Backend unit tests for portfolio, watchlist, chat modules
- [ ] E2E Playwright tests (docker-compose.test.yml)

### Out of Scope

- Real-money trading — this is simulated only
- User authentication / multi-user — single default user
- Limit orders / order book — market orders only
- Mobile app — desktop-first
- Real-time WebSocket bidirectional — SSE is sufficient
- Cloud deployment (Terraform/App Runner) — stretch goal only

## Context

- Market data subsystem is complete and tested (see planning/MARKET_DATA_SUMMARY.md)
- Backend uses FastAPI + uv + aiosqlite (no ORM)
- Frontend: Next.js with TypeScript, static export, Tailwind CSS
- Single Docker container on port 8000
- AI: LiteLLM → OpenRouter → Cerebras (openrouter/openai/gpt-oss-120b)
- DB: SQLite at db/finally.db, volume-mounted

## Constraints

- **Tech Stack**: FastAPI + Next.js + SQLite + SSE + LiteLLM — fixed per PLAN.md
- **Package Manager**: uv for Python, npm for Node — no pip, no yarn
- **Single Port**: Everything on port 8000 — frontend served as static files by FastAPI
- **No ORM**: aiosqlite with plain SQL strings only
- **Async**: All FastAPI routes async, litellm.acompletion (never sync)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| SSE over WebSockets | One-way push sufficient; simpler | — Pending |
| Static Next.js export | Single origin, no CORS, one container | — Pending |
| SQLite over Postgres | Single user, zero config, self-contained | — Pending |
| Market orders only | Eliminates order book complexity | — Pending |
| LiteLLM → OpenRouter | Cerebras fast inference, structured outputs | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-22 after initialization*
