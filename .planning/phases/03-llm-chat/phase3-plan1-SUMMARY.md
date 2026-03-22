---
phase: 3
plan: 1
subsystem: llm-chat
tags: [llm, chat, litellm, openrouter, mock, structured-output]
dependency_graph:
  requires: [phase2-plan1]
  provides: [chat-endpoint, chat-history, llm-integration]
  affects: [frontend-chat-panel]
tech_stack:
  added: [litellm, openrouter]
  patterns: [structured-output, async-llm, mock-mode, auto-execute-trades]
key_files:
  created:
    - backend/app/llm/__init__.py
    - backend/app/llm/client.py
    - backend/app/llm/prompts.py
    - backend/app/routes/chat.py
  modified:
    - backend/app/main.py
decisions:
  - LLM response parsing: gracefully falls back to raw content as message on malformed JSON
  - Watchlist idempotency: silently ignore add for existing ticker, remove for absent ticker
  - Trade auto-execution: reuses execute_trade() from portfolio.py — same validation as manual trades
  - Chat history: last 20 messages loaded per request to bound context size
metrics:
  duration: ~15 min
  completed: 2026-03-22
  tasks: 4
  files: 5
---

# Phase 3 Plan 1: LLM Chat Integration Summary

**One-liner:** LiteLLM async wrapper with mock mode, portfolio context injection, auto-executing trades/watchlist changes via structured JSON output.

## What Was Built

Four modules added to the backend:

1. **`backend/app/llm/client.py`** — `call_llm()` async function wrapping `litellm.acompletion()`. Returns `MOCK_LLM_RESPONSE` constant when `LLM_MOCK=true`. Handles malformed JSON from LLM by returning raw content as message with empty arrays.

2. **`backend/app/llm/prompts.py`** — `SYSTEM_PROMPT` instructing the LLM to respond as "FinAlly" with structured JSON. `build_portfolio_context()` formats cash, total value, positions with P&L, and watchlist into a readable string injected into the system message.

3. **`backend/app/routes/chat.py`** — Two endpoints:
   - `POST /api/chat`: loads portfolio + watchlist + history, builds LLM messages, stores user message, calls LLM, auto-executes trades and watchlist changes, stores assistant message with actions JSON, returns structured response
   - `GET /api/chat/history`: returns all messages for default user ordered by created_at ASC

4. **`backend/app/main.py`** — Chat router registered with `app.include_router(chat_router)`.

## Validation

Mock mode tested end-to-end:
- `POST /api/chat {"message": "How is my portfolio doing?"}` returned canonical mock response with empty trades/watchlist arrays (HTTP 200)
- `GET /api/chat/history` returned both the user message and assistant reply with correctly structured `actions` field

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all endpoints are wired to live DB and price cache. Mock mode is intentional test behavior, not a stub.

## Self-Check: PASSED

Files verified:
- backend/app/llm/__init__.py: FOUND
- backend/app/llm/client.py: FOUND
- backend/app/llm/prompts.py: FOUND
- backend/app/routes/chat.py: FOUND

Commit verified: 3502d14
