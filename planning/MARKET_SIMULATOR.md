# Market Simulator Design

Approach and code structure for the GBM-based stock price simulator used when `MASSIVE_API_KEY` is not set.

---

## Overview

The simulator uses **Geometric Brownian Motion (GBM)** — the standard continuous-time model underlying Black-Scholes. Prices evolve multiplicatively (so they can never go negative) with configurable per-ticker drift and volatility, correlated moves across tickers in the same sector, and occasional random shock events for visual drama.

Updates run at ~500ms intervals, producing a live-feeling price stream for the SSE endpoint.

---

## GBM Math

At each time step:

```
S(t+dt) = S(t) * exp((mu - sigma²/2) * dt + sigma * sqrt(dt) * Z)
```

| Symbol | Meaning | Typical value |
|--------|---------|--------------|
| `S(t)` | Current price | — |
| `mu` | Annualised drift (expected return) | 0.03–0.08 |
| `sigma` | Annualised volatility | 0.17–0.50 |
| `dt` | Time step as fraction of a trading year | ~8.5e-8 |
| `Z` | Correlated standard normal random variable | drawn via Cholesky |

**Calculating `dt`** for 500ms ticks:
```
Trading seconds/year = 252 days × 6.5 hours × 3600 sec = 5,896,800
dt = 0.5 / 5,896,800 ≈ 8.48e-8
```

This tiny `dt` produces sub-cent moves per tick that accumulate naturally over simulated time. A full day of simulation at 500ms ticks (≈ 23,400 updates) produces roughly the right intraday price range for each ticker's volatility.

---

## Correlated Moves

Real stocks in the same sector tend to move together. We model this with a **Cholesky decomposition** of a correlation matrix.

For `n` tickers, build an `n×n` correlation matrix `C` (symmetric, diagonal = 1). Then:
```
L = cholesky(C)        # lower-triangular matrix
Z_correlated = L @ Z_independent    # where Z_independent ~ N(0,1)^n
```

`Z_correlated` has the desired pairwise correlations while preserving unit variance.

### Default Correlation Groups

| Group | Tickers | Intra-group correlation |
|---|---|---|
| Tech | AAPL, GOOGL, MSFT, AMZN, META, NVDA, NFLX | 0.6 |
| Finance | JPM, V | 0.5 |
| TSLA | — | 0.3 with everything (independent-ish) |
| Cross-sector / unknown | any pair not above | 0.3 |

When a ticker is added dynamically (not in the default list), it uses the cross-sector default.

The Cholesky matrix is rebuilt every time a ticker is added or removed. With `n < 50` this is fast (O(n³) but trivial at this scale).

---

## Random Shock Events

Each step, each ticker independently has a small probability (`0.001` = 0.1%) of a sudden 2–5% move. This simulates news events and keeps the dashboard visually interesting.

```python
if random.random() < event_probability:
    magnitude = random.uniform(0.02, 0.05)
    direction = random.choice([-1, 1])
    price *= (1 + magnitude * direction)
```

With 10 tickers at 2 ticks/sec, the expected time between events anywhere in the portfolio is ~50 seconds.

---

## Seed Prices and Parameters

```python
# backend/app/market/seed_prices.py

SEED_PRICES: dict[str, float] = {
    "AAPL": 190.0,
    "GOOGL": 175.0,
    "MSFT": 420.0,
    "AMZN": 185.0,
    "TSLA": 250.0,
    "NVDA": 800.0,
    "META": 500.0,
    "JPM": 195.0,
    "V": 280.0,
    "NFLX": 600.0,
}

TICKER_PARAMS: dict[str, dict[str, float]] = {
    "AAPL":  {"sigma": 0.22, "mu": 0.05},
    "GOOGL": {"sigma": 0.25, "mu": 0.05},
    "MSFT":  {"sigma": 0.20, "mu": 0.05},
    "AMZN":  {"sigma": 0.28, "mu": 0.05},
    "TSLA":  {"sigma": 0.50, "mu": 0.03},  # high vol
    "NVDA":  {"sigma": 0.40, "mu": 0.08},  # high vol + strong drift
    "META":  {"sigma": 0.30, "mu": 0.05},
    "JPM":   {"sigma": 0.18, "mu": 0.04},  # low vol (bank)
    "V":     {"sigma": 0.17, "mu": 0.04},  # low vol (payments)
    "NFLX":  {"sigma": 0.35, "mu": 0.05},
}

DEFAULT_PARAMS: dict[str, float] = {"sigma": 0.25, "mu": 0.05}
```

Dynamically-added tickers not in `SEED_PRICES` start at a random price in `[50, 300]`.

---

## GBMSimulator Class

```python
# backend/app/market/simulator.py
import math
import random
import numpy as np
from .seed_prices import SEED_PRICES, TICKER_PARAMS, DEFAULT_PARAMS

class GBMSimulator:
    """Correlated GBM price simulation for multiple tickers.

    Call step() every ~500ms to advance all prices by one time step.
    """

    TRADING_SECONDS_PER_YEAR = 252 * 6.5 * 3600  # 5,896,800
    DEFAULT_DT = 0.5 / TRADING_SECONDS_PER_YEAR   # ~8.48e-8

    def __init__(
        self,
        tickers: list[str],
        dt: float = DEFAULT_DT,
        event_probability: float = 0.001,
    ) -> None:
        self._dt = dt
        self._event_prob = event_probability
        self._tickers: list[str] = []
        self._prices: dict[str, float] = {}
        self._params: dict[str, dict[str, float]] = {}
        self._cholesky: np.ndarray | None = None

        for ticker in tickers:
            self._add_internal(ticker)
        self._rebuild_cholesky()

    def step(self) -> dict[str, float]:
        """Advance all tickers by one time step. Returns {ticker: price}."""
        n = len(self._tickers)
        if n == 0:
            return {}

        z = np.random.standard_normal(n)
        if self._cholesky is not None:
            z = self._cholesky @ z

        result: dict[str, float] = {}
        for i, ticker in enumerate(self._tickers):
            mu = self._params[ticker]["mu"]
            sigma = self._params[ticker]["sigma"]

            drift     = (mu - 0.5 * sigma**2) * self._dt
            diffusion = sigma * math.sqrt(self._dt) * z[i]
            self._prices[ticker] *= math.exp(drift + diffusion)

            if random.random() < self._event_prob:
                shock = random.uniform(0.02, 0.05) * random.choice([-1, 1])
                self._prices[ticker] *= (1 + shock)

            result[ticker] = round(self._prices[ticker], 2)

        return result

    def add_ticker(self, ticker: str) -> None:
        if ticker not in self._prices:
            self._add_internal(ticker)
            self._rebuild_cholesky()

    def remove_ticker(self, ticker: str) -> None:
        if ticker in self._prices:
            self._tickers.remove(ticker)
            del self._prices[ticker]
            del self._params[ticker]
            self._rebuild_cholesky()

    def get_price(self, ticker: str) -> float | None:
        return self._prices.get(ticker)

    def get_tickers(self) -> list[str]:
        return list(self._tickers)

    def _add_internal(self, ticker: str) -> None:
        self._tickers.append(ticker)
        self._prices[ticker] = SEED_PRICES.get(ticker, random.uniform(50.0, 300.0))
        self._params[ticker] = dict(TICKER_PARAMS.get(ticker, DEFAULT_PARAMS))

    def _rebuild_cholesky(self) -> None:
        n = len(self._tickers)
        if n <= 1:
            self._cholesky = None
            return
        corr = np.eye(n)
        for i in range(n):
            for j in range(i + 1, n):
                rho = _pairwise_correlation(self._tickers[i], self._tickers[j])
                corr[i, j] = rho
                corr[j, i] = rho
        self._cholesky = np.linalg.cholesky(corr)


_TECH    = {"AAPL", "GOOGL", "MSFT", "AMZN", "META", "NVDA", "NFLX"}
_FINANCE = {"JPM", "V"}

def _pairwise_correlation(t1: str, t2: str) -> float:
    if t1 == "TSLA" or t2 == "TSLA":
        return 0.3
    if t1 in _TECH and t2 in _TECH:
        return 0.6
    if t1 in _FINANCE and t2 in _FINANCE:
        return 0.5
    return 0.3
```

---

## SimulatorDataSource Async Wrapper

`SimulatorDataSource` is the `MarketDataSource` implementation that runs `GBMSimulator.step()` in an asyncio loop:

```python
class SimulatorDataSource(MarketDataSource):

    async def start(self, tickers: list[str]) -> None:
        self._sim = GBMSimulator(tickers=tickers)
        # Seed cache so SSE has data before first loop tick
        for ticker in tickers:
            if (p := self._sim.get_price(ticker)) is not None:
                self._cache.update(ticker=ticker, price=p)
        self._task = asyncio.create_task(self._run_loop(), name="simulator-loop")

    async def _run_loop(self) -> None:
        while True:
            prices = self._sim.step()
            for ticker, price in prices.items():
                self._cache.update(ticker=ticker, price=price)
            await asyncio.sleep(self._interval)   # 0.5s default
```

The loop is non-blocking. `GBMSimulator.step()` is pure Python/NumPy and completes in microseconds — no need to run it in a thread pool.

---

## Properties and Invariants

| Property | Value | Reason |
|---|---|---|
| Prices always positive | Yes | `exp()` is always > 0 |
| Update frequency | 500ms | Matches SSE push cadence |
| Correlation matrix positive-definite | Yes | Cholesky decomposition requires this; our values (0.3–0.6) guarantee it |
| New tickers get price immediately | Yes | `start()` and `add_ticker()` both seed the cache |
| Memory per ticker | ~3 floats + dict entry | Negligible at n < 100 |

---

## Behavioural Notes

- **TSLA volatility (`sigma=0.50`)** produces roughly the right intraday swing — TSLA genuinely moves 3–8% some days.
- **NVDA drift (`mu=0.08`)** means simulated NVDA trends slightly upward on average, which matches its recent history.
- **Cross-group correlation (0.3)** means a market-wide "sell-off" still moves all stocks somewhat together, which looks realistic.
- **Random events** at `p=0.001` per step: with a 500ms interval and 10 tickers, expect roughly one event every 50 seconds somewhere in the portfolio. The effect (2–5% shock) is visible as a price flash on the frontend.
