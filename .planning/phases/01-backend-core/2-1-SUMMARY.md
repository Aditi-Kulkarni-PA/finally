---
phase: 2
plan: 1
subsystem: portfolio-watchlist-apis
tags: [fastapi, sqlite, aiosqlite, portfolio, watchlist, trade-execution]
dependency_graph:
  requires: [Phase 1 Backend Core (FastAPI app, database, price cache, market source)]
  provides: [GET/POST /api/portfolio, POST /api/portfolio/trade, GET /api/portfolio/history, GET/POST/DELETE /api/watchlist]
  affects: [Phase 3 LLM chat (reuses execute_trade), Phase 4 frontend (consumes all these endpoints)]
tech_stack:
  added: []
  patterns: [shared utility module for portfolio math, request.app.state for dependency injection, upsert via INSERT OR REPLACE, weighted average cost for buys]
key_files:
  created:
    - backend/app/portfolio.py
    - backend/app/routes/portfolio.py
    - backend/app/routes/watchlist.py
  modified:
    - backend/app/main.py
decisions:
  - execute_trade lives in portfolio.py (not in the route) so Phase 3 chat can reuse it without importing from routes
  - record_portfolio_snapshot is a separate helper called by both the route and the background task to avoid duplication
  - Watchlist DELETE keeps ticker in cache if user holds an open position (per PLAN.md spec)
  - Portfolio snapshot task logs exceptions and continues (does not crash the server on transient DB errors)
metrics:
  duration: ~20 minutes
  completed: 2026-03-22
  tasks_completed: 4
  files_created: 3
  files_modified: 1
---

# Phase 2 Plan 1: Portfolio & Watchlist APIs Summary

**One-liner:** Portfolio valuation, market-order trade execution with weighted-average cost accounting, and watchlist CRUD backed by live price cache, all validated against PLAN.md §8 rules.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Create portfolio.py: calculate_portfolio_value, execute_trade, record_portfolio_snapshot | 18907cc |
| 2 | Create routes/portfolio.py: GET /api/portfolio, POST /api/portfolio/trade, GET /api/portfolio/history | 18907cc |
| 3 | Create routes/watchlist.py: GET /api/watchlist, POST /api/watchlist, DELETE /api/watchlist/{ticker} | 18907cc |
| 4 | Update main.py: wire routers, replace snapshot stub with real 30-second loop | 18907cc |

## Verification Results

All endpoints confirmed working against a fresh DB (port 8002):

- `GET /api/portfolio` → `{"cash_balance": 10000.0, "positions": [], "total_value": 10000.0}`
- `GET /api/watchlist` → 10 tickers with live prices, change, change_percent, direction
- `POST /api/portfolio/trade {"ticker":"AAPL","quantity":5,"side":"buy"}` → fill at current price, cash reduced correctly
- `GET /api/portfolio` after buy → position with weighted avg_cost, unrealized_pnl=0 at fill price
- `POST /api/portfolio/trade {"quantity":0}` → 400 `{"detail": "Quantity must be positive"}`
- `POST /api/portfolio/trade {"ticker":"FAKE"}` → 400 `{"detail": "Unknown ticker or price not available"}`
- `GET /api/portfolio/history` → one snapshot entry recorded on trade completion

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all functionality is fully wired.

## Self-Check: PASSED

- `backend/app/portfolio.py` — FOUND
- `backend/app/routes/portfolio.py` — FOUND
- `backend/app/routes/watchlist.py` — FOUND
- `backend/app/main.py` modified — FOUND
- Commit 18907cc — FOUND
- All 6 endpoints respond correctly — VERIFIED
