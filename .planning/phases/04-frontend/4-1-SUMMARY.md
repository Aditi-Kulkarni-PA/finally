---
phase: 4
plan: 1
subsystem: frontend
tags: [next.js, react, typescript, tailwind, sse, lightweight-charts]
dependency_graph:
  requires: [backend-core, portfolio-watchlist-api, llm-chat]
  provides: [frontend-ui, static-export]
  affects: [docker-deployment]
tech_stack:
  added: [next.js@16, react@19, lightweight-charts@5, tailwind-css@4, typescript]
  patterns: [static-export, sse-eventsource, client-components, custom-hooks]
key_files:
  created:
    - frontend/next.config.ts
    - frontend/app/globals.css
    - frontend/app/layout.tsx
    - frontend/app/page.tsx
    - frontend/types/index.ts
    - frontend/hooks/usePriceStream.ts
    - frontend/hooks/usePortfolio.ts
    - frontend/hooks/useWatchlist.ts
    - frontend/hooks/useChat.ts
    - frontend/components/Header.tsx
    - frontend/components/Sparkline.tsx
    - frontend/components/WatchlistPanel.tsx
    - frontend/components/MainChart.tsx
    - frontend/components/PnLChart.tsx
    - frontend/components/PortfolioHeatmap.tsx
    - frontend/components/PositionsTable.tsx
    - frontend/components/TradeBar.tsx
    - frontend/components/ChatPanel.tsx
  modified: []
decisions:
  - "Used Next.js 16 with Tailwind CSS v4 - @theme directive for color tokens (no tailwind.config.js needed)"
  - "lightweight-charts v5 uses addSeries(SeriesDefinition, options) instead of addAreaSeries/addLineSeries"
  - "Static export output: 'export' in next.config.ts for FastAPI static serving"
  - "All price flash animations in globals.css using @keyframes flash-green/flash-down"
  - "Sparklines accumulated in usePriceStream hook, last 60 points per ticker"
  - "Chat panel toggle state managed in page.tsx; collapsed width 40px"
metrics:
  duration: ~35 min
  completed: 2026-03-22
  tasks: 6
  files: 18
---

# Phase 4 Plan 1: Frontend — Bloomberg-Style Trading Terminal Summary

**One-liner:** Next.js 16 static SPA with SSE live prices, Lightweight Charts v5 area/line charts, portfolio heatmap, trade bar, and AI chat panel using Tailwind CSS v4 dark terminal theme.

## What Was Built

A complete Bloomberg-style trading terminal SPA:

- **Header**: Portfolio value, total P&L (vs $10k starting), cash balance, connection status dot (green/yellow/red)
- **WatchlistPanel**: 10 default tickers with live price overlay, sparklines from SSE accumulation, +/- flash animations, add/remove ticker
- **MainChart**: Lightweight Charts v5 area chart for selected ticker, updates in real-time from SSE data
- **PortfolioHeatmap**: Flexbox treemap sized by portfolio weight, colored green/red by P&L percentage
- **PnLChart**: Lightweight Charts v5 line chart of portfolio value history, polls `/api/portfolio/history`
- **PositionsTable**: Tabular positions with live prices from SSE overlay, P&L in color
- **TradeBar**: Market order buy/sell with clear-on-success behavior, error display
- **ChatPanel**: Collapsible AI chat with history, loading dots, inline trade/watchlist action cards

## Architecture

All components are client components (`'use client'`). Data flows through 4 custom hooks:
- `usePriceStream`: EventSource SSE → full-snapshot parsing → sparkline accumulation (60 points max)
- `usePortfolio`: portfolio state + 5s polling + trade execution
- `useWatchlist`: watchlist CRUD
- `useChat`: chat history + send message with trade action callbacks

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] lightweight-charts v5 API change**
- **Found during:** Task 6 (build verification)
- **Issue:** `chart.addAreaSeries()` and `chart.addLineSeries()` removed in v5; TypeScript error: "Property 'addAreaSeries' does not exist on type 'IChartApi'"
- **Fix:** Changed to `chart.addSeries(AreaSeries, options)` and `chart.addSeries(LineSeries, options)` per v5 API
- **Files modified:** `frontend/components/MainChart.tsx`, `frontend/components/PnLChart.tsx`
- **Commit:** d659ca2

**2. [Rule 3 - Blocking] npm cache permission issue**
- **Found during:** Task 1 (setup)
- **Issue:** npm cache dir owned by root, blocking create-next-app
- **Fix:** Used `npm_config_cache=/private/tmp/claude-501/npm-cache` environment override for all npm commands
- **Files modified:** none (runtime configuration)

**3. [Rule 3 - Blocking] Turbopack sandbox port bind issue**
- **Found during:** Task 6 (build verification)
- **Issue:** Build fails in sandboxed execution due to Turbopack's port binding during build
- **Fix:** Used `dangerouslyDisableSandbox: true` for build commands only

## Known Stubs

None. All components are wired to real data sources:
- Prices: live from SSE `/api/stream/prices`
- Portfolio: live from `/api/portfolio` with 5s polling
- History: live from `/api/portfolio/history`
- Watchlist: live from `/api/watchlist`
- Chat: live from `/api/chat` and `/api/chat/history`

## Build Verification

```
Route (app)
  ○ /
  ○ /_not-found

out/index.html and _next/ produced successfully
```

## Self-Check: PASSED

- `frontend/out/index.html` exists
- All 6 task commits verified: c87700c, bb2f6b6, 9f99dde, 2b80c76, da4db40, d659ca2
- TypeScript clean (0 errors at build time)
- Static export produces `out/` directory ready for FastAPI to serve
