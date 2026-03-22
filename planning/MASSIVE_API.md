# Massive API Reference (formerly Polygon.io)

Massive (rebranded from Polygon.io in October 2025) provides real-time and historical US equity data via REST and WebSocket. This document covers the endpoints and Python SDK usage relevant to FinAlly.

---

## Authentication

- **Base URL**: `https://api.massive.com` (legacy `https://api.polygon.io` still supported)
- **Header**: `Authorization: Bearer <API_KEY>`
- **Python**: pass `api_key=` to `RESTClient`, or set `MASSIVE_API_KEY` env var (SDK reads it automatically)

```python
from massive import RESTClient

client = RESTClient()                        # reads MASSIVE_API_KEY from environment
client = RESTClient(api_key="your_key")      # or explicit
```

**Install**: `uv add massive` (Python 3.9+)

---

## Rate Limits

| Tier | Limit | Recommended poll interval |
|------|-------|--------------------------|
| Free | 5 requests / minute | 15 seconds |
| Paid (all tiers) | Unlimited | 2–5 seconds |

The free tier constraint is why FinAlly defaults to 15-second polling. One call fetches all tickers — never one call per ticker.

---

## Primary Endpoint: Multi-Ticker Snapshot

Fetches current price data for any number of tickers in **a single API call**.

**REST**: `GET /v2/snapshot/locale/us/markets/stocks/tickers?tickers=AAPL,MSFT,TSLA`

**Python SDK**:
```python
from massive import RESTClient
from massive.rest.models import SnapshotMarketType

client = RESTClient()

snapshots = client.get_snapshot_all(
    market_type=SnapshotMarketType.STOCKS,
    tickers=["AAPL", "GOOGL", "MSFT", "TSLA", "NVDA"],
)

for snap in snapshots:
    price     = snap.last_trade.price              # current price (float)
    prev_close = snap.prev_day.close               # previous day close
    ts_sec    = snap.last_trade.timestamp / 1000   # API returns Unix ms → convert to seconds
    change_pct = snap.today_change_percent         # % change from prev close
    print(f"{snap.ticker}: ${price:.2f}  ({change_pct:+.2f}%)")
```

**Response JSON structure** (per ticker object in `tickers[]`):
```json
{
  "ticker": "AAPL",
  "todaysChange": 1.23,
  "todaysChangePerc": 0.65,
  "updated": 1707580800000,
  "lastTrade": {
    "p": 192.75,
    "s": 100,
    "t": 1707580800000,
    "x": 4,
    "c": [14, 41]
  },
  "lastQuote": {
    "P": 192.76,
    "S": 2,
    "p": 192.74,
    "s": 3,
    "t": 1707580800000
  },
  "day": {
    "o": 191.00,
    "h": 193.50,
    "l": 190.10,
    "c": 192.75,
    "v": 54321000,
    "vw": 191.88
  },
  "prevDay": {
    "o": 189.50,
    "h": 191.90,
    "l": 188.70,
    "c": 191.45,
    "v": 61000000,
    "vw": 190.10
  },
  "min": {
    "o": 192.50, "h": 192.80, "l": 192.40, "c": 192.75,
    "v": 12340, "vw": 192.63, "av": 54321000, "n": 245,
    "t": 1707580800000
  }
}
```

**Field reference**:

| JSON key | SDK attribute | Meaning |
|---|---|---|
| `lastTrade.p` | `snap.last_trade.price` | **Current price** — use this |
| `lastTrade.t` | `snap.last_trade.timestamp` | Unix **milliseconds** — divide by 1000 |
| `lastTrade.s` | `snap.last_trade.size` | Trade size (shares) |
| `prevDay.c` | `snap.prev_day.close` | Previous day close |
| `day.o/h/l/c` | `snap.day.open/high/low/close` | Today's OHLC |
| `day.v` | `snap.day.volume` | Today's volume |
| `day.vw` | `snap.day.vwap` | Today's VWAP |
| `todaysChange` | `snap.today_change` | Absolute change from prev close |
| `todaysChangePerc` | `snap.today_change_percent` | % change from prev close |
| `lastQuote.P` / `p` | `snap.last_quote.ask` / `.bid` | Best ask / bid |

---

## Single-Ticker Snapshot

```python
snapshot = client.get_snapshot_ticker(
    market_type=SnapshotMarketType.STOCKS,
    ticker="AAPL",
)
# Same attributes as multi-ticker, but returns a single object (not a list)
```

**REST**: `GET /v2/snapshot/locale/us/markets/stocks/tickers/AAPL`

---

## Aggregates (Historical OHLCV Bars)

```python
# SDK auto-paginates via list_aggs — handles next_url transparently
aggs = list(client.list_aggs(
    ticker="AAPL",
    multiplier=1,
    timespan="day",       # second | minute | hour | day | week | month | year
    from_="2024-01-01",
    to="2024-12-31",
    adjusted=True,        # split-adjusted prices (default True)
    limit=50000,          # max per page
))

for a in aggs:
    print(f"{a.timestamp}  O={a.open} H={a.high} L={a.low} C={a.close}  V={a.volume}")
    # a.timestamp is Unix milliseconds (start of bar)
    # a.vwap, a.transactions also available
```

**REST**: `GET /v2/aggs/ticker/{ticker}/range/{multiplier}/{timespan}/{from}/{to}`

---

## Previous Day Close

```python
prev = list(client.get_previous_close_agg(ticker="AAPL"))
# Returns a list; normally one element
print(f"Prev close: ${prev[0].close}")
```

**REST**: `GET /v2/aggs/ticker/AAPL/prev`

---

## Last Trade / Last Quote (Single Ticker)

```python
trade = client.get_last_trade(ticker="AAPL")
print(f"Last trade: ${trade.price} x {trade.size}")

quote = client.get_last_quote(ticker="AAPL")
print(f"Bid: ${quote.bid_price}  Ask: ${quote.ask_price}")
```

These are single-ticker calls — not suitable for polling 10 tickers efficiently. Use the multi-ticker snapshot instead.

---

## WebSocket (not used in FinAlly)

The Massive WebSocket API provides tick-by-tick data with sub-second latency. FinAlly uses REST polling instead — one-way SSE to the browser is simpler and sufficient for a simulated trading terminal.

```python
# Topic prefixes: T.= trades, Q.= quotes, A.= minute bars, AM.= second bars
# wss://socket.massive.com/stocks
from massive import WebSocketClient
ws = WebSocketClient(subscriptions=["T.AAPL", "T.MSFT"])
ws.run(handle_msg=lambda msgs: print(msgs))
```

---

## Error Handling

| HTTP status | Cause | Action |
|---|---|---|
| 401 | Invalid API key | Check `MASSIVE_API_KEY` |
| 403 | Endpoint not in plan | Upgrade plan or use a different endpoint |
| 429 | Rate limit exceeded | Increase poll interval |
| 5xx | Server error | SDK retries 3x automatically |

The Massive client raises exceptions for these. The FinAlly `MassiveDataSource._poll_once()` catches and logs all exceptions, leaving the price cache unchanged until the next successful poll.

---

## Notes

- Tickers must be **uppercase** (e.g. `AAPL`, not `aapl`). Normalise with `.upper().strip()` at the API boundary.
- Timestamps throughout the API are **Unix milliseconds** — always divide by 1000 when writing to `PriceCache` (which uses Unix seconds).
- During market closed hours, `last_trade.price` reflects the last traded price (may be from after-hours).
- The `day` object resets at market open; `prevDay` holds the previous session's data.
- The multi-ticker snapshot has no documented upper limit on `tickers` count. Requesting the full market (omit `tickers` param) returns thousands of symbols.
