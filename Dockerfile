# Stage 1: Build Next.js frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ ./
RUN npm run build
# Output: /app/frontend/out/

# Stage 2: Python backend serving everything
FROM python:3.12-slim AS backend

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Copy backend uv project
COPY backend/ ./backend/

# Install Python dependencies from lockfile (no dev extras)
WORKDIR /app/backend
RUN uv sync --frozen --no-dev

# Copy frontend build output so FastAPI can serve it
COPY --from=frontend-builder /app/frontend/out/ ./static/

# Create db directory for SQLite volume mount
RUN mkdir -p /app/db

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
