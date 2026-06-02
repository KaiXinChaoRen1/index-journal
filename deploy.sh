#!/bin/sh
set -eu

IMAGE_NAME="${IMAGE_NAME:-index-journal:latest}"
CONTAINER_NAME="${CONTAINER_NAME:-index-journal}"
HOST_PORT="${HOST_PORT:-3100}"
CONTAINER_PORT="${CONTAINER_PORT:-3000}"
DATA_DIR="${DATA_DIR:-$(pwd)/data}"
BACKUP_CONTAINER_NAME="${CONTAINER_NAME}-previous"

echo "Index Journal Docker deploy"
echo "image: ${IMAGE_NAME}"
echo "container: ${CONTAINER_NAME}"
echo "host port: ${HOST_PORT}"
echo "container port: ${CONTAINER_PORT}"
echo "data dir: ${DATA_DIR}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required"
  exit 1
fi

mkdir -p "${DATA_DIR}"

echo "Building image..."
docker build -t "${IMAGE_NAME}" .

RESTORE_PREVIOUS=0
if docker ps -a --format '{{.Names}}' | grep -Fxq "${CONTAINER_NAME}"; then
  if docker ps -a --format '{{.Names}}' | grep -Fxq "${BACKUP_CONTAINER_NAME}"; then
    echo "Removing stale backup container..."
    docker rm -f "${BACKUP_CONTAINER_NAME}" >/dev/null
  fi

  echo "Moving existing container aside before replacement..."
  docker stop "${CONTAINER_NAME}" >/dev/null 2>&1 || true
  docker rename "${CONTAINER_NAME}" "${BACKUP_CONTAINER_NAME}"
  RESTORE_PREVIOUS=1
fi

set -- \
  -d \
  --name "${CONTAINER_NAME}" \
  -p "${HOST_PORT}:${CONTAINER_PORT}" \
  -e "DATABASE_URL=file:/data/dev.db" \
  -e "PORT=${CONTAINER_PORT}" \
  -v "${DATA_DIR}:/data" \
  --restart unless-stopped

if [ "${TWELVE_DATA_API_KEY:-}" != "" ]; then
  set -- "$@" -e "TWELVE_DATA_API_KEY=${TWELVE_DATA_API_KEY}"
else
  echo "TWELVE_DATA_API_KEY is not set. The container can start, but sync scripts will fail until you provide it."
fi

echo "Starting container..."
if ! NEW_CONTAINER_ID="$(docker run "$@" "${IMAGE_NAME}")"; then
  echo "New container failed to start."
  if [ "${RESTORE_PREVIOUS}" -eq 1 ]; then
    echo "Restoring previous container..."
    docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
    docker rename "${BACKUP_CONTAINER_NAME}" "${CONTAINER_NAME}"
    docker start "${CONTAINER_NAME}" >/dev/null
  fi
  exit 1
fi

sleep 2
if ! docker ps --format '{{.Names}}' | grep -Fxq "${CONTAINER_NAME}"; then
  echo "New container exited shortly after startup. Recent logs:"
  docker logs --tail 80 "${NEW_CONTAINER_ID}" || true
  if [ "${RESTORE_PREVIOUS}" -eq 1 ]; then
    echo "Restoring previous container..."
    docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
    docker rename "${BACKUP_CONTAINER_NAME}" "${CONTAINER_NAME}"
    docker start "${CONTAINER_NAME}" >/dev/null
  fi
  exit 1
fi

if [ "${RESTORE_PREVIOUS}" -eq 1 ]; then
  echo "Removing previous container backup..."
  docker rm -f "${BACKUP_CONTAINER_NAME}" >/dev/null
fi

echo "Container started. Check logs with:"
echo "docker logs -f ${CONTAINER_NAME}"

echo "Open the app at:"
echo "http://<server-ip>:${HOST_PORT}"

if [ "${TWELVE_DATA_API_KEY:-}" != "" ]; then
  echo "Optional first sync after startup:"
  echo "docker exec ${CONTAINER_NAME} npm run sync:data"
fi
