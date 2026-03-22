# Market Data Backend — Code Review

**Reviewed against:** PLAN.md sections 6 and 8, plus MARKET_DATA_SUMMARY.md
**Review date:** 2026-03-22
**Scope:** `backend/app/market/` (all modules) and `backend/tests/market/` (all test files)

Issues are prioritised: P1 = must fix before integration, P2 = should fix, P3 = minor / low risk.

---

## P1 — Must Fix

### 1. `stream.py` line 17: Module-level router is mutated inside the factory function

The `router` object is created at module scope (line 17), then `@router.get("/prices")` decorates a function inside `create_stream_router()` every time it is called. On the second call, the route is registered a second time on the same router object. In practice the app only calls this once, but the design is fragile and wrong in principle — the factory pattern promises a fresh, isolated router per call.

**Fix:** Move `router = APIRouter(...)` inside `create_stream_router()` so each call returns a distinct router.

---

### 2. `stream.py` lines 62–63: `retry:` value does not match spec; sent only once at connection, but the spec requirement is met by the placement

The spec says `retry: 3000` (3 seconds). The code emits `retry: 1000` (1 second). This is a direct spec violation. For a demo app on an unreliable network, 1 second is aggressive and will hammer the server on reconnect storms. The spec was deliberate.

**Fix:** Change `"retry: 1000\n\n"` to `"retry: 3000\n\n"`.

---

### 3. `cache.py` line 30: `timestamp=0` is treated as falsy, silently replaced by `time.time()`

```python
ts = timestamp or time.time()
```

If a caller legitimately passes `timestamp=0.0` (epoch), the cache replaces it with the current wall clock. This is a latent bug: the Massive client converts millisecond timestamps to seconds and passes them through. If a market event timestamped at exactly 0 arrives (unlikely but possible), the stored timestamp will be wrong. More importantly, the pattern is a code smell — `None` should be distinguished from `0` explicitly.

**Fix:** Change to `ts = timestamp if timestamp is not None else time.time()`.

---

### 4. `simulator.py` lines 242–248: `add_ticker()` called before `start()` is a silent no-op

`add_ticker` checks `if self._sim:` — if `start()` has not been called, `self._sim` is `None` and the call is silently ignored. The watchlist API endpoint calls `source.add_ticker()` at any time. If called before the lifespan has initialised the source (a narrow startup race, or if the order of operations changes), the ticker is silently dropped and will never be priced.

The spec's cache scope rule ("Adding a ticker to the watchlist starts tracking it") requires this to work reliably.

**Fix:** Either raise `RuntimeError("start() has not been called")`, or queue tickers added before start and drain the queue in `start()`.

---

### 5. `interface.py` line 54: `remove_ticker` docstring says it "also removes the ticker from the PriceCache" — but `SimulatorDataSource` only honours this when `self._sim` is not None

In `simulator.py` `remove_ticker` (lines 251–255):
```python
async def remove_ticker(self, ticker: str) -> None:
    if self._sim:
        self._sim.remove_ticker(ticker)
    self._cache.remove(ticker)  # Always runs
```

The `self._cache.remove(ticker)` runs unconditionally, which is correct. However, `self._sim.remove_ticker(ticker)` is guarded by `if self._sim`. If `stop()` has been called (setting the task to None but leaving `self._sim` alive) this is fine. But if `remove_ticker` is called before `start()`, the cache entry is removed but the simulator never knew about the ticker — this is consistent but should be documented, not silently swallowed.

This is a lower-priority variant of issue 4 above, documented here for completeness.

---

## P2 — Should Fix

### 6. `stream.py` lines 75–83: Version-change guard means first SSE event is never sent until a price update occurs after the client connects

`last_version` starts at `-1`. On the first loop iteration, `current_version` will equal the number of updates since startup — it will not equal `-1`, so the first event is sent immediately. This is actually correct behaviour. However, if the cache is empty at the moment of connection (no tickers yet), `if prices:` on line 80 suppresses the event entirely and sends nothing. The client will sit with a stale `last_version` until the next real price change.

This means: if a client connects and the cache happens to be empty at that instant, it waits up to `interval` seconds for the next update before receiving any event. This is acceptable but the comment in the code claims the guard is for change detection — the empty-cache case is undocumented and could confuse future maintainers.

**Fix:** Add a comment explaining the `if prices:` guard and why it is intentional.

---

### 7. `massive_client.py` lines 66–70: `add_ticker` normalises with `.upper().strip()` but `SimulatorDataSource.add_ticker` does not

The spec mandates normalisation at the API boundary (watchlist endpoints), not inside the data source. Having `MassiveDataSource` normalise internally but `SimulatorDataSource` skip it creates an inconsistency. If the watchlist API layer ever fails to normalise (e.g. a future developer adds a direct call), the simulator will accept `"aapl"` as a different ticker from `"AAPL"` in the cache.

Both implementations should behave identically. Either both normalise, or neither does and the API layer is the sole owner of normalisation. The spec implies the latter ("at API boundary"), so `MassiveDataSource` should not duplicate the normalisation.

**Fix:** Remove the `.upper().strip()` calls from `massive_client.py` lines 67 and 73. Document in `interface.py` that callers are responsible for normalisation.

---

### 8. `simulator.py` line 269: Bare `except Exception` swallows the error log but continues the loop

```python
except Exception:
    logger.exception("Simulator step failed")
```

The exception is logged at `ERROR` level (via `logger.exception`), which is correct. However, after a step failure the loop calls `asyncio.sleep` and then tries again immediately. If the failure is due to a corrupted `self._sim` state (e.g., an unexpected `numpy` error mid-step), the loop will spam logs at 500ms intervals indefinitely.

**Fix:** Add a backoff or failure counter. If more than N consecutive failures occur, cancel the task and log a critical error rather than retrying forever.

---

### 9. `seed_prices.py` lines 39–41: `TSLA` is in the `"tech"` correlation group but `_pairwise_correlation` special-cases it before the group lookup

This works correctly today but is fragile. If TSLA is ever removed from the `"tech"` set in `seed_prices.py` without updating `_pairwise_correlation`, the behaviour changes silently. The special-case logic in `simulator.py` and the group membership in `seed_prices.py` are coupled with no enforcement.

**Fix:** Either remove TSLA from the `"tech"` set (making the special case fully self-contained in the logic), or add a comment in both places documenting the coupling.

---

### 10. `models.py` line 21: `change` rounds to 4 decimal places but `cache.py` rounds prices to 2 decimal places — the rounding is applied twice in sequence, potentially producing misleading values

When `cache.update` rounds `price` to 2dp and `previous_price` to 2dp, then `change = round(price - previous_price, 4)` can only ever produce a value with 2dp anyway. The 4dp precision in `change` and `change_percent` is therefore cosmetic at best and misleading at worst — it implies sub-cent precision that does not exist.

This is low risk but worth noting for the frontend's display logic.

---

## P3 — Minor / Low Risk

### 11. `test_simulator.py` line 48: Test accesses private attribute `sim._tickers`

```python
assert len(sim._tickers) == 1
```

The public `get_tickers()` method exists and should be used instead. Accessing private attributes in tests couples them to implementation details.

**Fix:** Replace `len(sim._tickers)` with `len(sim.get_tickers())`.

---

### 12. `test_simulator.py` line 83: Test accesses private attribute `sim._cholesky` directly

The Cholesky matrix is an internal implementation detail. The test is asserting an optimisation (skipping correlation for a single ticker) that is not part of the public contract. If the implementation changes to always compute a 1×1 Cholesky, the test breaks for no user-visible reason.

**Fix:** Remove or convert to a behavioural test (e.g., verify that a single ticker runs 1000 steps without error).

---

### 13. `test_simulator_source.py` line 108: Test accesses `source._task` directly

```python
assert source._task is not None
assert not source._task.done()
```

A public `is_running()` property would be cleaner and would not break if the internal implementation changes from a Task to something else.

This is low priority given the current implementation, but noted for consistency.

---

### 14. `stream.py` lines 65–66: `request.client` can be `None` in test environments

```python
client_ip = request.client.host if request.client else "unknown"
```

The guard is present, which is good. However the fallback string `"unknown"` will make log aggregation harder (all unknown clients look identical). A UUID or sequential connection ID would be more useful for debugging.

---

### 15. Missing test coverage: SSE event format

There are no tests that verify the SSE output format from `stream.py`. The spec is precise about the format:

- `data:` prefix
- Full snapshot dict keyed by symbol
- All seven required fields per ticker (`ticker`, `price`, `previous_price`, `timestamp`, `change`, `change_percent`, `direction`)
- `retry:` directive at connection start

None of this is tested. A bug in `_generate_events` could produce malformed SSE that silently fails in the browser. A test using `httpx` with `TestClient` or a direct async generator test would cover this.

---

### 16. Missing test coverage: cache scope / eviction logic

The spec says tickers are evicted from the cache only when both conditions are true: removed from watchlist AND no open position. This eviction logic is not implemented in the market layer (it belongs to the watchlist API layer, which calls `source.remove_ticker()`). That is correct. But there are no tests asserting that `remove_ticker` on the source always evicts from the cache unconditionally — which is the correct behaviour for the source layer. The cache scope policy belongs to the caller, not the source.

The current tests do cover that `remove_ticker` evicts from cache, but the responsibility boundary is undocumented. The interface docstring for `remove_ticker` should note that cache eviction is always unconditional at the source level; the caller decides when to call it.

---

## Summary Table

| # | Severity | File | Lines | Issue |
|---|----------|------|-------|-------|
| 1 | P1 | `stream.py` | 17, 20–48 | Module-level router mutated inside factory |
| 2 | P1 | `stream.py` | 62 | `retry: 1000` should be `retry: 3000` per spec |
| 3 | P1 | `cache.py` | 30 | `timestamp or time.time()` treats `0.0` as falsy |
| 4 | P1 | `simulator.py` | 242–248 | `add_ticker` before `start()` is a silent no-op |
| 5 | P1 | `simulator.py` | 251–255 | Variant of #4 for `remove_ticker` — less critical |
| 6 | P2 | `stream.py` | 80 | Empty cache suppression undocumented |
| 7 | P2 | `massive_client.py` | 67, 73 | Normalisation inside source is inconsistent with simulator |
| 8 | P2 | `simulator.py` | 262–270 | Bare exception swallow with no backoff |
| 9 | P2 | `seed_prices.py` / `simulator.py` | 39, 189 | TSLA group membership and special-case logic are coupled |
| 10 | P2 | `models.py` | 21 | 4dp `change` is misleading when prices are stored at 2dp |
| 11 | P3 | `test_simulator.py` | 48 | Private `_tickers` accessed in test |
| 12 | P3 | `test_simulator.py` | 83 | Private `_cholesky` accessed in test |
| 13 | P3 | `test_simulator_source.py` | 108 | Private `_task` accessed in test |
| 14 | P3 | `stream.py` | 65–66 | `"unknown"` IP fallback reduces log usefulness |
| 15 | P3 | `stream.py` | (no test) | No tests for SSE event format or `retry:` directive |
| 16 | P3 | `interface.py` | 49–54 | Cache eviction responsibility boundary undocumented |
