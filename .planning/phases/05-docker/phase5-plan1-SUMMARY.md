---
phase: 5
plan: 1
subsystem: deployment
tags: [docker, fastapi, nextjs, static-serving, deployment]
dependency_graph:
  requires: [phase4-plan1]
  provides: [single-command-launch, docker-image, static-file-serving]
  affects: [all-components]
tech_stack:
  added: [Dockerfile multi-stage, docker-compose, bash scripts, PowerShell scripts]
  patterns: [multi-stage-docker-build, spa-static-serving, named-volume]
key_files:
  created:
    - Dockerfile
    - .dockerignore
    - docker-compose.yml
    - .env.example
    - scripts/start_mac.sh
    - scripts/stop_mac.sh
    - scripts/start_windows.ps1
    - scripts/stop_windows.ps1
  modified:
    - backend/app/main.py
decisions:
  - "Mount /_next at StaticFiles(directory=static/_next) so Next.js JS/CSS bundle paths resolve correctly"
  - "Catch-all route serves real static files (favicon.ico, etc.) before falling back to index.html"
metrics:
  duration: ~5 min
  completed: 2026-03-22
  tasks_completed: 1
  files_changed: 9
---

# Phase 5 Plan 1: Docker & Deployment Summary

**One-liner:** Multi-stage Dockerfile builds Next.js frontend and serves it via FastAPI with correct `/_next/` asset routing and SPA fallback.

## What Was Built

Single-command deployment via `./scripts/start_mac.sh` or `docker run`. The multi-stage Docker build:

1. Stage 1 (Node 20): runs `npm ci && npm run build`, producing `frontend/out/`
2. Stage 2 (Python 3.12): installs uv, runs `uv sync --frozen --no-dev`, copies `frontend/out/` to `backend/static/`, and starts uvicorn

FastAPI serves the static export with two mount points:
- `/_next` → `StaticFiles(directory=static/_next)` for JS/CSS bundles
- Catch-all `/{full_path:path}` → serves real static files if they exist (favicon.ico, SVGs), else serves `index.html` for SPA routing

## Files Created

| File | Purpose |
|------|---------|
| `Dockerfile` | Multi-stage build: Node frontend + Python backend |
| `.dockerignore` | Excludes .git, node_modules, .venv, .env, out/, .next/ |
| `docker-compose.yml` | Convenience wrapper with named volume `finally-data` |
| `.env.example` | Documents all environment variables |
| `scripts/start_mac.sh` | Builds if needed, starts container, opens browser |
| `scripts/stop_mac.sh` | Stops and removes container |
| `scripts/start_windows.ps1` | Windows PowerShell equivalent of start_mac.sh |
| `scripts/stop_windows.ps1` | Windows PowerShell equivalent of stop_mac.sh |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed static file serving mount path**

- **Found during:** Task 1 (reading backend/app/main.py)
- **Issue:** `main.py` mounted static files at `/assets` but Next.js HTML references `/_next/static/...` paths. The `/assets` mount would never serve JS/CSS bundles, causing a blank page.
- **Fix:** Changed mount to `/_next` pointing at `static/_next/`, and updated catch-all to serve actual static files (favicon.ico etc.) before falling back to `index.html`
- **Files modified:** `backend/app/main.py`
- **Commit:** 562381e

## Canonical Run Commands

```bash
# Build and run (macOS/Linux)
./scripts/start_mac.sh

# Or direct Docker
docker build -t finally .
docker run -v finally-data:/app/db -p 8000:8000 --env-file .env finally

# Stop
./scripts/stop_mac.sh
```

## Self-Check: PASSED

Files verified:
- FOUND: Dockerfile
- FOUND: .dockerignore
- FOUND: docker-compose.yml
- FOUND: .env.example
- FOUND: scripts/start_mac.sh
- FOUND: scripts/stop_mac.sh
- FOUND: scripts/start_windows.ps1
- FOUND: scripts/stop_windows.ps1

Commit verified: 562381e — feat(phase5-plan1): add Docker deployment and start/stop scripts
