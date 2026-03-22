#!/bin/bash
set -e

IMAGE_NAME="finally"
CONTAINER_NAME="finally-app"
DATA_VOLUME="finally-data"
PORT=8000

# Build if needed or --build flag passed
if [[ "$1" == "--build" ]] || ! docker image inspect "$IMAGE_NAME" &>/dev/null; then
    echo "Building Docker image..."
    docker build -t "$IMAGE_NAME" .
fi

# Stop existing container if running
docker rm -f "$CONTAINER_NAME" 2>/dev/null || true

# Create .env if missing
if [[ ! -f .env ]]; then
    cp .env.example .env
    echo "Created .env from .env.example -- edit it to add API keys"
fi

echo "Starting FinAlly..."
docker run -d \
    --name "$CONTAINER_NAME" \
    -v "$DATA_VOLUME:/app/db" \
    -p "$PORT:8000" \
    --env-file .env \
    "$IMAGE_NAME"

echo "FinAlly is running at http://localhost:$PORT"

# Open browser on macOS
if command -v open &>/dev/null; then
    sleep 2
    open "http://localhost:$PORT"
fi
