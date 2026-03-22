#!/bin/bash
CONTAINER_NAME="finally-app"
docker rm -f "$CONTAINER_NAME" 2>/dev/null && echo "Stopped." || echo "Not running."
