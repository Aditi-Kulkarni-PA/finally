# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-22)

**Core value:** Single Docker command → Bloomberg-style AI trading terminal with live prices, simulated portfolio, and AI chat.
**Current focus:** Phase 5 — Docker & Deployment

## Current Phase

**Phase 4: Frontend** — Complete

## Phase Progress

| Phase | Name | Status |
|-------|------|--------|
| 1 | Backend Core | ✓ Complete |
| 2 | Portfolio & Watchlist APIs | ✓ Complete |
| 3 | LLM Chat Integration | ✓ Complete |
| 4 | Frontend | ✓ Complete |
| 5 | Docker & Deployment | ○ Pending |
| 6 | Testing | ○ Pending |

## Decisions Made

- **SSE route in main.py**: Defined SSE route inline reading `app.state.price_cache` rather than using `create_stream_router` factory, to avoid cache-before-routes ordering problem.
- **DB_PATH**: Defaults to `db/finally.db` for local dev, `/app/db/finally.db` for Docker (via `DB_PATH` env var).
- **execute_trade in portfolio.py**: Trade logic lives in shared utility module so Phase 3 chat reuses it without importing from routes.
- **record_portfolio_snapshot**: Separate helper called by both trade route and background task to avoid duplication.
- **Watchlist DELETE cache eviction**: Ticker kept in cache if user holds open position, per PLAN.md §6.
- **LLM response parsing**: fallback to raw content as message on malformed JSON
- **Chat history limit**: last 20 messages per request to bound LLM context size
- **Watchlist idempotency**: silently ignore add for existing ticker, remove for absent ticker
- **Next.js 16 + Tailwind v4**: @theme directive for color tokens; no tailwind.config.js needed
- **lightweight-charts v5 API**: addSeries(SeriesDefinition, options) replaces addAreaSeries/addLineSeries
- **Static export**: output: 'export' in next.config.ts; out/ directory served by FastAPI
- **Sparkline accumulation**: last 60 SSE price points per ticker accumulated in usePriceStream hook
- **Chat panel**: collapsible sidebar; collapsed width 40px, expanded 320px

## Known Context

- Market data subsystem complete: backend/app/market/ (73 tests passing)
- Backend deps added: aiosqlite, litellm, pydantic
- Database schema created: 6 tables, seeded default user + 10 watchlist tickers
- FastAPI app boots, all API endpoints respond correctly
- Portfolio, watchlist, trade, and history endpoints all verified
- routes/ has health.py, portfolio.py, watchlist.py, chat.py
- llm/ module: client.py (LiteLLM async wrapper), prompts.py (system prompt + context builder)
- Chat endpoints: POST /api/chat and GET /api/chat/history both verified in mock mode
- LLM_MOCK=true returns MOCK_LLM_RESPONSE constant; LLM_MOCK=false requires OPENROUTER_API_KEY
- Frontend: Next.js 16 static SPA in frontend/, builds to out/ directory
- All 8 components built and integrated in app/page.tsx
- Build verified: npm run build produces out/index.html with _next/ assets
- Next build requires dangerouslyDisableSandbox=true (Turbopack port binding in sandbox)

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 1 | 1 | ~15 min | 4 | 6 |
| 2 | 1 | ~20 min | 4 | 4 |
| 3 | 1 | ~15 min | 4 | 5 |
| 4 | 1 | ~35 min | 6 | 18 |

---
*Last session: 2026-03-22 — Completed Phase 4 Frontend (Bloomberg-style trading terminal)*
