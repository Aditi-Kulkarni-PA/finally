# Codebase Concerns

**Analysis Date:** 2026-03-22

## Project Status

The FinAlly platform is in **early-stage development**. Market data component is complete and reviewed. Frontend, full API layer, database schema, portfolio logic, LLM integration, and test infrastructure remain unbuilt. This document captures known issues in the existing market data code and architectural gaps that will impact downstream development.

---

## Tech Debt — Market Data Layer

**Location:** `backend/app/market/`

All identified issues from the code review (planning/review.md) are technical debt that must be resolved before integration with the API layer. These were discovered during market data component completion.

### P1 Issues — Must Fix Before Integration

**1. SSE router factory is mutated at module scope**
- **Files:** `backend/app/market/stream.py` lines 17, 20–48
- **Issue:** The `APIRouter` is created outside `create_stream_router()`, then route decorators are applied inside the function. On second call to `create_stream_router()`, routes are registered twice on the same object. The factory pattern is violated.
- **Impact:** Fragile design that works by accident (app only calls it once). If future code calls it twice, routes are duplicated.
- **Fix approach:** Move `router = APIRouter(...)` inside `create_stream_router()` to ensure each call returns a distinct, fresh router.

**2. SSE retry directive violates spec**
- **Files:** `backend/app/market/stream.py` line 60
- **Issue:** Code emits `retry: 1000` (1 second) but spec requires `retry: 3000` (3 seconds). Direct specification violation.
- **Impact:** On network disconnection, client reconnects every 1 second instead of 3, creating reconnect storms on lossy networks. SSE broker logs spam.
- **Fix approach:** Change `"retry: 1000\n\n"` to `"retry: 3000\n\n"`.

**3. Cache timestamp field treats 0 as falsy**
- **Files:** `backend/app/market/cache.py` line 30
- **Issue:** Logic `ts = timestamp or time.time()` uses truthiness, not explicit `None` check. Caller passing `timestamp=0.0` (epoch) is silently replaced with current wall-clock time.
- **Impact:** Latent bug. Massive API client converts millisecond timestamps to seconds; if a market event occurs at epoch (timestamp 0), stored timestamp will be wrong. More importantly, it's a code smell — zero is a valid timestamp value.
- **Fix approach:** Change to `ts = timestamp if timestamp is not None else time.time()`. Accept explicit `None`, reject falsy values.

**4. MarketDataSource.add_ticker() before start() is silent no-op**
- **Files:** `backend/app/market/simulator.py` lines 246–252
- **Issue:** `add_ticker()` checks `if self._sim is None` — if called before `start()`, the call is silently ignored. Watchlist API calls `source.add_ticker()` at any time, including before lifespan initialization.
- **Impact:** Startup race: if watchlist endpoint is reached before market data source starts, added tickers are dropped. Violates spec requirement: "Adding a ticker to the watchlist starts tracking it."
- **Fix approach:** Queue tickers added before `start()` is called. Drain queue in `start()` and deduplicate. (Code already does this but only for simulator, not documented as a public contract.)

**5. MarketDataSource.remove_ticker() similarly fragile**
- **Files:** `backend/app/market/simulator.py` lines 260–264
- **Issue:** `remove_ticker()` calls `self._sim.remove_ticker()` only if `self._sim` is not `None`. Interface docstring claims it "also removes from PriceCache" — this is always true, but the simulator removal is conditional.
- **Impact:** Less critical than issue 4 (cache is always evicted), but violates the semantic contract. If `remove_ticker` is called before `start()`, ticker is evicted from cache but simulator never knew about it. Behaviour is consistent but undocumented.
- **Fix approach:** Document in `interface.py` that `remove_ticker()` always evicts from cache unconditionally; simulator eviction depends on initialization state. Or enforce that both happen together.

---

### P2 Issues — Should Fix Before Full Integration

**6. SSE empty-cache suppression undocumented**
- **Files:** `backend/app/market/stream.py` lines 78–81
- **Issue:** Code has `if prices:` guard on line 80. If cache is empty when client connects, `_generate_events` waits up to 500ms for first price update before sending any event. Guard's purpose is for change detection, but empty-cache case is undocumented.
- **Impact:** Frontend client experiences up to 500ms delay on first connect if cache happens to be empty. Not a bug, but maintainer confusion risk.
- **Fix approach:** Add comment explaining both guards: (a) version-change detection, (b) empty-cache edge case is intentional.

**7. Massive client normalizes ticker, simulator does not**
- **Files:** `backend/app/market/massive_client.py` lines 67, 73
- **Issue:** `MassiveDataSource.add_ticker()` and `remove_ticker()` call `.upper().strip()`, but `SimulatorDataSource` does not. Spec requires normalization at API boundary, not inside sources. Internal inconsistency.
- **Impact:** If watchlist API layer (not yet built) fails to normalize, simulator accepts `"aapl"` as different from `"AAPL"` in cache, breaking ticker identity.
- **Fix approach:** Remove `.upper().strip()` from `massive_client.py`. Add requirement to interface docstring that callers must normalize. Watchlist API layer owns normalization.

**8. Exception handler in simulator loop lacks backoff**
- **Files:** `backend/app/market/simulator.py` lines 269–279
- **Issue:** Bare `except Exception` logs error but retries immediately on next 500ms cycle. If `GBMSimulator.step()` enters a corrupt state (numpy error), loop spams logs forever.
- **Impact:** Poor diagnostics. Server keeps running but produces no prices and spams logs. Hard to detect/debug in production.
- **Fix approach:** Add failure counter. If >3 consecutive failures, cancel task and log CRITICAL instead of retrying forever. Or exponential backoff (1s, 2s, 4s, etc.).

**9. TSLA correlation special case is fragile coupling**
- **Files:** `backend/app/market/seed_prices.py` line 39 (group membership), `backend/app/market/simulator.py` lines 189–190 (special case)
- **Issue:** TSLA is in `CORRELATION_GROUPS["tech"]` but `_pairwise_correlation()` special-cases it with lower 0.3 correlation. Logic and data are coupled with no enforcement.
- **Impact:** If TSLA is removed from tech group without updating the special case (or vice versa), behavior changes silently. Maintenance footgun.
- **Fix approach:** Either remove TSLA from tech group (special case is fully self-contained) or add strong coupling: comment in both places with back-references and assertion logic.

**10. PriceUpdate.change is 4-decimal-place while prices are 2-decimal**
- **Files:** `backend/app/market/models.py` line 21
- **Issue:** `change = round(self.price - self.previous_price, 4)`. But prices are rounded to 2dp in cache, so change can never exceed 2dp precision. 4dp rounding is cosmetic and misleading.
- **Impact:** Low risk, but frontend engineers might assume 4dp precision and try to display it, creating false precision in UI.
- **Fix approach:** Document rounding hierarchy in a comment. Consider simplifying to `round(..., 2)` for honesty. Or round prices at 4dp throughout (backwards-incompatible).

---

### P3 Issues — Minor / Low Risk

**11. Tests access private attributes**
- **Files:** `backend/tests/market/test_simulator.py` lines 48, 83; `test_simulator_source.py` line 108
- **Issue:** Tests directly access `_tickers`, `_cholesky`, `_task` private attributes. Couples tests to implementation details.
- **Impact:** Tests break if internals are refactored (e.g., `_tickers` becomes a set). Low user impact but poor test design.
- **Fix approach:** Use public APIs (`get_tickers()`) or add public properties (`is_running()`, `active_tickers`).

**12. Missing SSE output format test coverage**
- **Files:** `backend/app/market/stream.py` (no test coverage)
- **Issue:** No tests verify the SSE format. Spec requires precise JSON structure: `{"AAPL": {...}, ...}`, all 7 fields per ticker, `retry:` directive.
- **Impact:** Bug in `_generate_events` could produce malformed SSE that silently fails in browser.
- **Fix approach:** Add `test_stream.py` with `httpx.AsyncClient` or async generator tests verifying output format, `retry:` value, and behavior on disconnect.

**13. Cache eviction responsibility boundary undocumented**
- **Files:** `backend/app/market/interface.py` lines 49–54
- **Issue:** Interface says `remove_ticker` "removes from PriceCache", but spec says eviction depends on (position exists, ticker in watchlist). That logic lives in watchlist API layer, not market layer. Boundary is unclear.
- **Impact:** API layer engineer may incorrectly implement cache scope in market layer instead of watchlist layer, duplicating responsibility.
- **Fix approach:** Add docstring clarifying: "Cache removal is always unconditional at the market layer. The caller (watchlist API) decides when to invoke this method based on the cache scope policy."

---

## Architectural Gaps — Missing Components

**Overall Status:** Frontend, API routes, database, portfolio engine, and LLM integration are unbuilt. Market data is complete and tested. The following gaps will block downstream work.

### Database Not Initialized

**Status:** Spec complete, no code.
- **Files:** `backend/db/` (empty)
- **Issue:** Schema, seed logic, and async SQLite initialization in lifespan are not implemented. Spec requires tables and default data on startup.
- **Impact:** Portfolio endpoints cannot be built until database layer exists. Trade logic depends on positions table.
- **Unblocks:** All portfolio, watchlist, chat, and trade endpoints.

### FastAPI Main Application Not Bootstrapped

**Status:** No entry point.
- **Files:** `backend/app/main.py` does not exist. Spec says it should be the FastAPI entry point.
- **Issue:** No lifespan context manager. No route registration. No static file serving for frontend.
- **Impact:** Backend cannot start. Market data source is never instantiated.
- **Unblocks:** All API endpoints and frontend serving.

### API Routes Skeleton Only

**Status:** Spec complete, no implementation.
- **Files:** `backend/app/routes/` (empty)
- **Issue:** Portfolio, watchlist, chat, and system endpoints not implemented. Spec requires validation, database calls, and error handling.
- **Impact:** Frontend cannot make any API calls.
- **Unblocks:** Frontend integration testing.

### Portfolio Calculation Logic Missing

**Status:** No implementation.
- **Files:** Not created yet.
- **Issue:** `calculate_portfolio_value()` utility (mentioned in spec) and trade execution logic are not implemented. Must handle cash, positions, P&L, unrealized losses.
- **Impact:** Watchlist and portfolio endpoints cannot compute portfolio state.
- **Unblocks:** Trading functionality.

### LLM Integration Not Implemented

**Status:** Spec complete, skeleton only.
- **Files:** `backend/app/llm/` (empty)
- **Issue:** LiteLLM initialization, prompt construction, structured output parsing, auto-execution of trades, and canonical mock response not implemented.
- **Impact:** Chat endpoint cannot function.
- **Unblocks:** Conversational trading feature.

### Frontend Entirely Missing

**Status:** Spec complete, no code.
- **Files:** `frontend/` (empty)
- **Issue:** Next.js project, all UI components, SSE client, charting, trade submission, and watchlist UI not implemented.
- **Impact:** No user interface.
- **Unblocks:** End-to-end demonstration.

### Docker Multi-Stage Build Missing

**Status:** Spec complete, no Dockerfile.
- **Files:** `Dockerfile` (not present)
- **Issue:** Multi-stage build (Node → Python), static file copy, uvicorn CMD not implemented.
- **Impact:** App cannot be containerized.
- **Unblocks:** Deployment and E2E testing.

### E2E Test Infrastructure Missing

**Status:** Spec complete, no tests.
- **Files:** `test/` is partially empty (Playwright setup missing)
- **Issue:** `docker-compose.test.yml`, Playwright configuration, E2E test scenarios not implemented.
- **Impact:** No automated browser-based testing.
- **Unblocks:** End-to-end validation.

---

## Security Considerations

### API Input Validation Missing

**Status:** Spec defines validation rules, no enforcement.
- **Issue:** Watchlist endpoints must normalize tickers (`upper().strip()`). Trade endpoints must validate (quantity > 0, side in ["buy", "sell"], sufficient cash/shares). Chat input requires LLM prompt injection protection.
- **Impact:** Malformed/malicious input could crash API or trigger unintended behavior.
- **Recommendation:** Implement Pydantic models with validators for all request bodies. Use FastAPI's exception handlers for validation errors.

### API Key Exposure Risk

**Status:** OPENROUTER_API_KEY required when LLM_MOCK=false.
- **Issue:** API key must be passed via environment variable in `.env`. If accidentally committed or logged, credentials leak.
- **Impact:** Compromised OpenRouter account. Attacker can make LLM calls at victim's expense.
- **Recommendation:** (Already mitigated) `.env` is in `.gitignore`. Add secret scanning in CI/CD (e.g., `detect-secrets`). Never log environment variables.

### MASSIVE_API_KEY Same Risk

**Status:** Optional real market data.
- **Issue:** Polygon.io API key exposure.
- **Impact:** Compromised API quota.
- **Recommendation:** Same as above — never log, use secret scanning.

### SQLite File Permissions

**Status:** Will be created at runtime in Docker volume.
- **Issue:** SQLite database file `db/finally.db` will contain user portfolio state (positions, trade history, chat messages). If volume is accessible outside the container, data leaks.
- **Impact:** Exposure of trading history and chat context.
- **Recommendation:** Volume should be mounted only to the app container. In cloud deployments, use managed storage (e.g., AWS EBS) with encryption at rest.

### Single-User Hardcoding

**Status:** All queries filter by `user_id = "default"`.
- **Issue:** Multi-user support is not enforced at the schema or code layer. Adding real users requires careful schema migration and query audit.
- **Impact:** If multi-user is added hastily, single-user filtering could be missed, leaking user A's portfolio to user B.
- **Recommendation:** Future work: (a) enforce `user_id` in all queries via a context variable, (b) add middleware to load user from session/token, (c) audit all DB queries for `user_id` filtering.

### LLM Auto-Execution Risk

**Status:** Spec intentional, trades auto-execute without confirmation.
- **Issue:** LLM-requested trades execute immediately. If LLM is hallucinating or prompt-injected, trades execute anyway.
- **Impact:** Unintended trades (e.g., LLM suggests "sell all AAPL" and does it). In production with real money, this is catastrophic.
- **Recommendation:** Current design acceptable for demo (fake money, simulation). For production: require confirmation, add rate limits, implement trade review queue, or use separate "dry-run" mode.

---

## Performance Bottlenecks

### SSE Change Detection with Version Counter

**Status:** Implemented, no known issues.
- **Approach:** `PriceCache.version` is a monotonic counter. SSE generator checks `if current_version != last_version` to avoid redundant sends.
- **Capacity:** Works for one client. With 100+ concurrent SSE clients, each sleeping for 500ms between checks, CPU time is negligible. Event serialization (JSON dump of ~10 tickers) is fast.
- **No action needed yet.** Monitor if client count exceeds 1000s.

### GBM Simulator Performance

**Status:** Runs every 500ms.
- **Approach:** Cholesky decomposition is O(n^2), called on ticker add/remove (not hot path). Step is O(n) matrix multiply + individual price updates.
- **Capacity:** For 50 tickers (well above 10-ticker watchlist), step takes <1ms. Cholesky rebuild takes <5ms.
- **No bottleneck.** Simulator can handle dynamic watchlist changes without lag.

### Massive API Rate Limits

**Status:** Spec addresses, default 15s interval.
- **Constraint:** Free tier is 5 req/min (one poll every 12s is safe margin). Paid tiers are faster.
- **Risk:** If customer switches from simulator to Massive without understanding limits, API rate-limit errors will silence prices.
- **Recommendation:** Add env var `MASSIVE_POLL_INTERVAL` with defaults per tier. Document clearly. Log warnings if 429 (rate limit) errors occur.

### SSE Stream Memory Leak Risk

**Status:** Streams from start of app lifetime; no backpressure.
- **Issue:** If `_generate_events` yields events faster than the client consumes, buffer grows unbounded (unlikely with 500ms interval and fast network).
- **Mitigation:** FastAPI + uvicorn handle backpressure via TCP socket buffers. For long slow clients on lossy networks, buffer could grow. Not critical for <100 concurrent clients.
- **Recommendation:** Monitor; add client timeout and backpressure mechanism if >500 concurrent clients.

---

## Fragile Areas — Requires Careful Modification

### Market Data Source Lifecycle

**Why fragile:**
- Must call `start()` before `add_ticker()` (issue #4). State machine not enforced.
- `stop()` can be called anytime, safe but leaves `self._sim` alive.
- Background task can fail silently (issue #8).

**How to change safely:**
- Add tests for every lifecycle transition (start → add_ticker → remove_ticker → stop → add_ticker again).
- Use asyncio context managers or explicit state enum instead of implicit flags.
- Test exception cases (e.g., what happens if add_ticker fails?).

### GBM Correlation Matrix

**Why fragile:**
- TSLA is special-cased (issue #9). Cholesky decomposition is brittle (can fail if correlation matrix is not positive definite).
- Adding a new ticker with unusual correlation patterns could cause numpy to fail.

**How to change safely:**
- Validate correlation matrix is positive semi-definite before Cholesky.
- Add tests for edge cases: single ticker, all-identical correlations, outlier tickers.
- Document the sector groups and special cases in a single place.

### Ticker Normalization

**Why fragile:**
- Spec says normalize at API boundary, but Massive client does it too (inconsistency). Cache, simulator, and Massive must all agree on ticker casing.
- SQL queries will be case-sensitive on some databases (not SQLite, but relevant for future migrations).

**How to change safely:**
- Enforce normalization in ONE place: the watchlist API endpoints. Market layer should NOT normalize.
- Write tests asserting that simulator and Massive both accept pre-normalized tickers.
- Document the normalization rule prominently in interface.py.

### SSE Event Format

**Why fragile:**
- Spec is precise about JSON structure. Any change breaks the frontend.
- No tests verify the format (issue #12).

**How to change safely:**
- Add comprehensive tests before making changes.
- Coordinate with frontend on format changes.
- Version the SSE event format if future changes are likely.

---

## Test Coverage Gaps

**Overall coverage:** Market data is 84% covered. Other components have 0% coverage.

### Market Data Gaps

| Area | Gap | Risk |
|------|-----|------|
| SSE output format | No tests for JSON structure, `retry:` directive, event sequence | Medium — malformed SSE fails silently in browser |
| Simulator statistics | No tests for GBM correctness (mean, std dev of returns) | Low — visual inspection via demo is sufficient |
| Massive parsing | Mocked API responses; real API never tested | Medium — real API changes break app |
| Exception handling | `_run_loop` catches exceptions but no tests | Medium — corruption scenarios untested |
| Concurrent cache access | No stress tests for multiple readers/writers | Low — test coverage is adequate for single producer |

### Missing Test Suites (Future)

- **API route tests:** Trade validation, error codes, database state transitions
- **Portfolio calculation tests:** P&L accuracy, edge cases (selling at loss, fractional shares)
- **LLM integration tests:** Structured output parsing, graceful error handling
- **Database tests:** Schema correctness, constraint enforcement, seed data
- **Frontend unit tests:** Component rendering, animation timing, event handling
- **E2E tests:** Full user journeys (watch prices, buy/sell, chat with AI)

---

## Dependencies at Risk

### `massive` Package

**Status:** Optional for real market data; simulator is default.
- **Risk:** Polygon.io API changes could break response parsing. Package maintainer could abandon it.
- **Mitigation:** Simulator is the default; real data is opt-in. If Massive breaks, users fall back to simulator.
- **Alternative:** Direct `httpx` REST client to Polygon API (vendor lock-in removed, more control).

### `litellm`

**Status:** Required for LLM integration (not yet built).
- **Risk:** LiteLLM is a wrapper around many LLM APIs. If Cerebras/OpenRouter endpoint changes, LiteLLM patch is required.
- **Mitigation:** Pin `litellm` version. Test with real OpenRouter endpoint in CI/CD.
- **Alternative:** Direct OpenRouter API calls (removes abstraction, more brittle).

### `numpy`

**Status:** Required for GBM Cholesky decomposition.
- **Risk:** Heavy dependency; build issues on ARM. Version mismatches can cause numerical differences.
- **Mitigation:** Version pinned in `pyproject.toml`. Test on multiple architectures.
- **Alternative:** Pure Python correlation logic (slower but no binary dependency).

### FastAPI & Uvicorn

**Status:** Core backend stack.
- **Risk:** API surface changes, security advisories.
- **Mitigation:** Pin major version. Subscribe to security mailing lists.
- **Alternative:** None; widely maintained and stable.

---

## Known Bugs Summary

| Issue | Severity | Status | Blocker |
|-------|----------|--------|---------|
| SSE router mutated at module scope | P1 | Known | No (works by accident) |
| Retry directive wrong value | P1 | Known | No (UX degradation only) |
| Timestamp falsy check | P1 | Known | No (edge case) |
| add_ticker before start silent no-op | P1 | Known | **Yes** — race condition in startup |
| remove_ticker before start inconsistent | P1 | Known | No (less critical) |
| Empty cache SSE undocumented | P2 | Known | No |
| Ticker normalization inconsistency | P2 | Known | Yes — needs fix before API layer |
| Exception handler no backoff | P2 | Known | No |
| TSLA correlation coupling | P2 | Known | No |
| change precision misleading | P2 | Known | No |
| Test private access | P3 | Known | No |
| SSE format untested | P3 | Known | No |
| Eviction responsibility undocumented | P3 | Known | No |

---

## Priorities for Next Phases

1. **CRITICAL (Block other work):**
   - Fix market data P1 issues (#1–5), especially startup race (#4).
   - Build FastAPI main.py with lifespan and market data initialization.
   - Build database layer and initialize schema at startup.

2. **HIGH (Unblock core features):**
   - Build API routes (portfolio, watchlist, trade, chat, health).
   - Build portfolio calculation logic.
   - Build watchlist CRUD.
   - Add comprehensive API input validation.

3. **MEDIUM (Enable demo):**
   - Build LLM integration.
   - Build frontend.
   - Build Docker multi-stage build.
   - Build E2E test infrastructure.

4. **LOW (Polish):**
   - Fix P2/P3 market data issues (logging, documentation, edge cases).
   - Improve test coverage (SSE format, exception handling).
   - Add performance monitoring.

---

*Concerns audit: 2026-03-22*
