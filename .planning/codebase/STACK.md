# Technology Stack

**Analysis Date:** 2026-03-22

## Languages

**Primary:**
- Python 3.12 - Backend API, market data, LLM integration, database access
- TypeScript - Frontend application (Next.js, not yet implemented; frontend/ directory is empty)
- JavaScript - Frontend build tooling

**Secondary:**
- SQL - SQLite database schema and queries via plain SQL strings

## Runtime

**Environment:**
- Python 3.12+ (requirement specified in `backend/pyproject.toml`)
- Node.js 20 (for Next.js frontend build; not yet implemented)

**Package Manager:**
- `uv` - Modern Python package manager for backend (used instead of pip)
  - Lockfile: `backend/uv.lock` (present, reproducible dependency lock)
- `npm` or similar for frontend (future)

## Frameworks

**Core:**
- FastAPI 0.115.0+ - High-performance async REST API framework, SSE streaming support
- Uvicorn 0.32.0+ - ASGI server for FastAPI (includes `uvloop` for performance)
- Pydantic - Data validation and structured outputs (as peer dependency of FastAPI)

**Data & Market:**
- NumPy 2.0.0+ - Numerical computing, GBM simulator matrix operations
- Massive 1.0.0+ - Polygon.io REST API client for real market data (optional, activated via env var)
- Python-dotenv - Environment variable loading from `.env` file

**Utilities:**
- Rich 13.0.0+ - Terminal UI and styling (used in `backend/market_data_demo.py` for live dashboard)
- Starlette - Web framework foundation (dependency of FastAPI)

**Testing:**
- pytest 8.3.0+ - Test runner and framework
- pytest-asyncio 0.24.0+ - Async test support (configured with `asyncio_mode = "auto"`)
- pytest-cov 5.0.0+ - Code coverage reporting

**Development & Linting:**
- ruff 0.7.0+ - Fast Python linter and formatter (line-length: 100, targets Python 3.12)

## Key Dependencies

**Critical:**
- FastAPI - Core REST framework; owns routing, request/response handling, SSE support
- Uvicorn - ASGI server; enables async event loop and streaming
- NumPy - Essential for GBM simulator's Cholesky decomposition and correlated random number generation
- Massive - Polygon.io SDK; required only when `MASSIVE_API_KEY` env var is set; falls back to built-in simulator if absent

**Infrastructure:**
- Pydantic - Validation and structured outputs (required for LLM response parsing)
- Python-dotenv - Loads environment variables from `.env` at startup
- Rich - Terminal rendering (demo only; not required for production)
- pytest-asyncio - Async test execution (configured to auto-detect async tests)

## Configuration

**Environment:**
- Configuration via `.env` file at project root (not committed; `.env.example` should be created)
- Key variables:
  - `OPENROUTER_API_KEY` - Required for LLM chat when `LLM_MOCK=false`
  - `MASSIVE_API_KEY` - Optional; enables real market data via Polygon.io. If absent, simulator is used (default)
  - `LLM_MOCK` - Optional (default `false`); when `true`, LLM returns deterministic mock responses without API calls
  - `OPENAI_MODEL` - Optional; LLM model identifier (default: `"gpt-oss-120b"`)
  - `MODEL` - Optional; duplicate of `OPENAI_MODEL` (consolidation candidate)

**Build:**
- `backend/pyproject.toml` - Python project configuration, dependencies, test/lint tool settings
  - Build backend: `hatchling`
  - Packages: `["app"]` (includes `backend/app/` module)
  - Python path: `backend/app/` contains main application code
- `backend/uv.lock` - Locked dependency versions for reproducibility

## Platform Requirements

**Development:**
- Python 3.12+
- `uv` package manager (install globally or use `pipx`)
- Git (for version control)

**Production:**
- Docker (single container deployment)
  - Multi-stage Dockerfile (Node.js → Python base image)
  - Port: 8000 (single port serves frontend + all APIs)
  - Volume mount: `finally-data:/app/db` (SQLite persistence)

**Database:**
- SQLite (local file-based, no server needed)
  - Location: `db/finally.db` (created by backend on startup)
  - Access: `aiosqlite` (async wrapper, not yet added to dependencies but planned)
  - Schema: Created programmatically during FastAPI lifespan startup

**Deployed Container Environment:**
- AWS App Runner, Render, or any Docker-compatible container platform
- Environment variables passed via `--env-file .env`

---

*Stack analysis: 2026-03-22*
