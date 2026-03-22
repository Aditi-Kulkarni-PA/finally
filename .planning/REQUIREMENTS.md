# Requirements: FinAlly

**Defined:** 2026-03-22
**Core Value:** Users can watch live prices, trade with fake money, and have AI analyze/execute their portfolio — in a Bloomberg-style terminal from a single Docker command.

## v1 Requirements

### Backend Core

- [ ] **CORE-01**: FastAPI app at backend/app/main.py with lifespan context manager
- [ ] **CORE-02**: Database initialized at lifespan startup (schema + seed if not exists)
- [ ] **CORE-03**: Default user profile seeded (id="default", cash=10000)
- [ ] **CORE-04**: Default watchlist seeded (AAPL, GOOGL, MSFT, AMZN, TSLA, NVDA, META, JPM, V, NFLX)
- [ ] **CORE-05**: Market data background task starts after DB init in lifespan
- [ ] **CORE-06**: Portfolio snapshot background task runs every 30s in lifespan
- [ ] **CORE-07**: FastAPI serves Next.js static export for all non-/api/* routes
- [ ] **CORE-08**: GET /api/health returns 200

### Portfolio

- [ ] **PORT-01**: GET /api/portfolio returns positions, cash, total_value, unrealized P&L
- [ ] **PORT-02**: POST /api/portfolio/trade executes buy/sell market orders
- [ ] **PORT-03**: Trade validation: positive quantity, known ticker, sufficient cash/shares
- [ ] **PORT-04**: Trade returns 400 with {"detail": reason} on validation failure
- [ ] **PORT-05**: GET /api/portfolio/history returns portfolio_snapshots for P&L chart
- [ ] **PORT-06**: Portfolio snapshot recorded immediately after each trade
- [ ] **PORT-07**: calculate_portfolio_value() shared utility (used by GET /api/portfolio + snapshots)

### Watchlist

- [ ] **WTCH-01**: GET /api/watchlist returns tickers with live prices from cache
- [ ] **WTCH-02**: POST /api/watchlist adds ticker (normalised to upper().strip())
- [ ] **WTCH-03**: DELETE /api/watchlist/{ticker} removes ticker
- [ ] **WTCH-04**: Adding watchlist ticker starts price tracking in market data source
- [ ] **WTCH-05**: Removing watchlist ticker evicts from cache only if no open position

### Chat / LLM

- [ ] **CHAT-01**: POST /api/chat sends message, calls LLM, auto-executes trades/watchlist changes
- [ ] **CHAT-02**: GET /api/chat/history returns conversation history
- [ ] **CHAT-03**: LLM uses LiteLLM → OpenRouter (openrouter/openai/gpt-oss-120b, Cerebras provider)
- [ ] **CHAT-04**: LLM responds with structured JSON: {message, trades[], watchlist_changes[]}
- [ ] **CHAT-05**: LLM_MOCK=true returns deterministic MOCK_LLM_RESPONSE constant
- [ ] **CHAT-06**: Chat response always returns trades_executed, trades_failed, watchlist_changes arrays
- [ ] **CHAT-07**: LLM receives portfolio context (cash, positions, watchlist, total_value)

### Frontend

- [ ] **FE-01**: Next.js TypeScript project with Tailwind CSS, static export
- [ ] **FE-02**: Dark theme: bg #0d1117, accent yellow #ecad0a, blue #209dd7, purple #753991
- [ ] **FE-03**: EventSource SSE connection to /api/stream/prices with auto-reconnect
- [ ] **FE-04**: Connection status indicator (green/yellow/red dot) in header
- [ ] **FE-05**: Watchlist panel: ticker, price, change%, sparkline mini-chart
- [ ] **FE-06**: Price flash animation: green/red background highlight fading over ~500ms
- [ ] **FE-07**: Sparklines accumulated from SSE since page load
- [ ] **FE-08**: Main chart area with Lightweight Charts for selected ticker
- [ ] **FE-09**: Clicking watchlist ticker selects it in main chart
- [ ] **FE-10**: Portfolio heatmap (treemap) sized by weight, colored by P&L
- [ ] **FE-11**: P&L chart showing total portfolio value over time
- [ ] **FE-12**: Positions table: ticker, qty, avg cost, current price, unrealized P&L, % change
- [ ] **FE-13**: Trade bar: ticker field, quantity field, buy/sell buttons; clears qty after submit
- [ ] **FE-14**: Header: portfolio total value (live), cash balance
- [ ] **FE-15**: AI chat panel: message input, scrolling history, loading indicator
- [ ] **FE-16**: Chat shows inline trade execution confirmations

### Docker & Deployment

- [ ] **DOCK-01**: Multi-stage Dockerfile (Node 20 → Python 3.12)
- [ ] **DOCK-02**: docker-compose.yml with named volume finally-data
- [ ] **DOCK-03**: scripts/start_mac.sh and scripts/stop_mac.sh
- [ ] **DOCK-04**: scripts/start_windows.ps1 and scripts/stop_windows.ps1
- [ ] **DOCK-05**: .env.example with all required variables

### Testing

- [ ] **TEST-01**: Backend unit tests for portfolio trade execution logic
- [ ] **TEST-02**: Backend unit tests for watchlist API
- [ ] **TEST-03**: Backend unit tests for LLM structured output parsing
- [ ] **TEST-04**: E2E test: fresh start shows default watchlist and $10k balance
- [ ] **TEST-05**: E2E test: buy shares → cash decreases, position appears
- [ ] **TEST-06**: E2E test: AI chat with LLM_MOCK=true returns expected response
- [ ] **TEST-07**: test/docker-compose.test.yml for Playwright E2E runs

## v2 Requirements

### Enhancements

- **ENH-01**: Terraform/App Runner cloud deployment config
- **ENH-02**: Multiple user profiles
- **ENH-03**: Limit order support
- **ENH-04**: Mobile-responsive layout
- **ENH-05**: Portfolio export (CSV)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real money / brokerage integration | Demo/educational only |
| User auth / sessions | Single-user, no login |
| Limit/stop orders | Eliminated order book complexity |
| WebSockets | SSE sufficient for one-way push |
| Mobile app | Desktop-first |
| Multi-tenant | Out of scope for v1 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CORE-01 to CORE-08 | Phase 1 | Pending |
| PORT-01 to PORT-07 | Phase 2 | Pending |
| WTCH-01 to WTCH-05 | Phase 2 | Pending |
| CHAT-01 to CHAT-07 | Phase 3 | Pending |
| FE-01 to FE-16 | Phase 4 | Pending |
| DOCK-01 to DOCK-05 | Phase 5 | Pending |
| TEST-01 to TEST-07 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 43 total
- Mapped to phases: 43
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-22*
*Last updated: 2026-03-22 after initial definition*
