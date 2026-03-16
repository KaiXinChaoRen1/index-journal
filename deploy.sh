#!/bin/sh
set -eu

IMAGE_NAME="${IMAGE_NAME:-index-journal:latest}"
CONTAINER_NAME="${CONTAINER_NAME:-index-journal}"
PORT="${PORT:-3000}"
DATA_DIR="${DATA_DIR:-$(pwd)/data}"

echo "Index Journal Docker deploy"
echo "image: ${IMAGE_NAME}"
echo "container: ${CONTAINER_NAME}"
echo "port: ${PORT}"
echo "data dir: ${DATA_DIR}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required"
  exit 1
fi

mkdir -p "${DATA_DIR}"

echo "Building image..."
docker build -t "${IMAGE_NAME}" .

if docker ps -a --format '{{.Names}}' | grep -Fxq "${CONTAINER_NAME}"; then
  echo "Replacing existing container..."
  docker rm -f "${CONTAINER_NAME}" >/dev/null
fi

set -- \
  -d \
  --name "${CONTAINER_NAME}" \
  -p "${PORT}:3000" \
  -e "DATABASE_URL=file:/data/dev.db" \
  -v "${DATA_DIR}:/data" \
  --restart unless-stopped

if [ "${TWELVE_DATA_API_KEY:-}" != "" ]; then
  set -- "$@" -e "TWELVE_DATA_API_KEY=${TWELVE_DATA_API_KEY}"
else
  echo "TWELVE_DATA_API_KEY is not set. The container can start, but sync scripts will fail until you provide it."
fi

echo "Starting container..."
docker run "$@" "${IMAGE_NAME}"

echo "Container started. Check logs with:"
echo "docker logs -f ${CONTAINER_NAME}"

echo "Open the app at:"
echo "http://<server-ip>:${PORT}"

if [ "${TWELVE_DATA_API_KEY:-}" != "" ]; then
  echo "Optional first sync after startup:"
  echo "docker exec ${CONTAINER_NAME} npm run sync:data"
fi
