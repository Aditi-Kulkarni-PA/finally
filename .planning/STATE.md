# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-22)

**Core value:** Single Docker command → Bloomberg-style AI trading terminal with live prices, simulated portfolio, and AI chat.
**Current focus:** Phase 2 — Portfolio & Watchlist APIs

## Current Phase

**Phase 1: Backend Core** — Complete

## Phase Progress

| Phase | Name | Status |
|-------|------|--------|
| 1 | Backend Core | ✓ Complete |
| 2 | Portfolio & Watchlist APIs | ○ Pending |
| 3 | LLM Chat Integration | ○ Pending |
| 4 | Frontend | ○ Pending |
| 5 | Docker & Deployment | ○ Pending |
| 6 | Testing | ○ Pending |

## Decisions Made

- **SSE route in main.py**: Defined SSE route inline reading `app.state.price_cache` rather than using `create_stream_router` factory, to avoid cache-before-routes ordering problem.
- **Portfolio snapshot stub**: `_portfolio_snapshot_task` is a no-op loop until Phase 2 implements `calculate_portfolio_value`.
- **DB_PATH**: Defaults to `db/finally.db` for local dev, `/app/db/finally.db` for Docker (via `DB_PATH` env var).

## Known Context

- Market data subsystem complete: backend/app/market/ (73 tests passing)
- Backend deps added: aiosqlite, litellm, pydantic
- Database schema created: 6 tables, seeded default user + 10 watchlist tickers
- FastAPI app boots, health endpoint responds, SSE stream works
- Frontend directory is empty — needs full Next.js setup
- routes/ has health.py; llm/ dir still empty

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 1 | 1 | ~15 min | 4 | 6 |

---
*Last session: 2026-03-22 — Completed Phase 1 Backend Core*
