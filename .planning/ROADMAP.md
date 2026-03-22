# Roadmap: FinAlly v1.0

**Created:** 2026-03-22
**Milestone:** v1.0 — Full trading workstation

## Milestone Overview

| Phase | Name | Status | Plans |
|-------|------|--------|-------|
| 1 | Backend Core | ○ Pending | 4 |
| 2 | Portfolio & Watchlist APIs | ○ Pending | 4 |
| 3 | LLM Chat Integration | ○ Pending | 3 |
| 4 | Frontend | ○ Pending | 6 |
| 5 | Docker & Deployment | ○ Pending | 3 |
| 6 | Testing | ○ Pending | 3 |

---

## Phase 1: Backend Core

**Goal:** FastAPI application boots, DB initializes with seed data, market data streams, health endpoint responds.

**Requirements:** CORE-01 to CORE-08

**Deliverables:**
- `backend/app/main.py` — FastAPI app with lifespan
- `backend/app/database.py` — aiosqlite DB init + schema + seed
- `backend/app/routes/health.py` — GET /api/health
- Dependencies added: aiosqlite, litellm, pydantic

**Done when:** `GET /api/health` returns 200, DB is seeded, SSE stream works with default watchlist.

---

## Phase 2: Portfolio & Watchlist APIs

**Goal:** Users can query portfolio state, execute trades, and manage their watchlist via REST API.

**Requirements:** PORT-01 to PORT-07, WTCH-01 to WTCH-05

**Deliverables:**
- `backend/app/routes/portfolio.py` — portfolio + trade endpoints
- `backend/app/routes/watchlist.py` — watchlist CRUD
- `backend/app/portfolio.py` — trade execution logic, calculate_portfolio_value()
- Portfolio snapshot background task in lifespan

**Done when:** Can buy/sell via API, watchlist CRUD works, portfolio snapshots accumulate.

---

## Phase 3: LLM Chat Integration

**Goal:** AI assistant receives user messages, analyzes portfolio, auto-executes trades, responds with structured JSON.

**Requirements:** CHAT-01 to CHAT-07

**Deliverables:**
- `backend/app/llm/client.py` — LiteLLM wrapper with mock mode
- `backend/app/llm/prompts.py` — system prompt, portfolio context builder
- `backend/app/routes/chat.py` — POST /api/chat, GET /api/chat/history

**Done when:** Can chat with AI (mock mode), trades auto-execute from AI, history persists.

---

## Phase 4: Frontend

**Goal:** Full Bloomberg-style trading terminal UI connected to the backend.

**Requirements:** FE-01 to FE-16

**Deliverables:**
- `frontend/` — Next.js TypeScript project
- SSE hook with EventSource, price flash animations
- Watchlist panel with sparklines
- Lightweight Charts integration (main chart + sparklines)
- Portfolio heatmap, P&L chart, positions table
- Trade bar, AI chat panel, header

**Done when:** All UI elements render with live data, trades work from UI, chat panel functional.

---

## Phase 5: Docker & Deployment

**Goal:** Single `docker run` command launches the complete application.

**Requirements:** DOCK-01 to DOCK-05

**Deliverables:**
- `Dockerfile` — multi-stage Node → Python build
- `docker-compose.yml`
- `scripts/start_mac.sh`, `scripts/stop_mac.sh`
- `scripts/start_windows.ps1`, `scripts/stop_windows.ps1`
- `.env.example`

**Done when:** `./scripts/start_mac.sh` builds and runs the app, browser opens to working UI.

---

## Phase 6: Testing

**Goal:** Backend unit tests and E2E Playwright tests validate critical flows.

**Requirements:** TEST-01 to TEST-07

**Deliverables:**
- `backend/tests/test_portfolio.py` — trade execution unit tests
- `backend/tests/test_watchlist.py` — watchlist API tests
- `backend/tests/test_chat.py` — LLM parsing tests
- `test/e2e/` — Playwright E2E test suite
- `test/docker-compose.test.yml` — test infrastructure

**Done when:** All unit tests pass, E2E tests cover key flows (fresh start, buy shares, chat mock).

---

## Success Criteria (v1.0)

- [ ] Single `docker run` command starts the app
- [ ] Default watchlist streams live prices
- [ ] User starts with $10,000 cash
- [ ] Buy/sell trades execute instantly
- [ ] Portfolio heatmap and P&L chart update in real time
- [ ] AI chat analyzes portfolio and executes trades
- [ ] All unit tests pass (73 existing + new)
- [ ] E2E tests pass in docker-compose environment

---
*Roadmap created: 2026-03-22*
