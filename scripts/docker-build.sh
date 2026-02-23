#!/usr/bin/env bash
# scripts/docker-build.sh
# Builds, tags and optionally pushes the Docker image.
# Usage: ./scripts/docker-build.sh [tag] [--push] [--distroless]
#   tag          – Image tag (default: git short SHA or "latest")
#   --push       – Push to registry after build
#   --distroless – Build the distroless variant instead
set -euo pipefail

PUSH=false
DISTROLESS=false
TAG="${1:-}"
shift || true

for arg in "$@"; do
  case "${arg}" in
    --push)        PUSH=true ;;
    --distroless)  DISTROLESS=true ;;
  esac
done

# Resolve tag: arg > git SHA > "latest"
if [[ -z "${TAG}" ]]; then
  if command -v git &>/dev/null && git rev-parse --short HEAD &>/dev/null 2>&1; then
    TAG="$(git rev-parse --short HEAD)"
  else
    TAG="latest"
  fi
fi

GIT_COMMIT="$(git rev-parse HEAD 2>/dev/null || echo 'unknown')"
BUILD_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
REGISTRY="${REGISTRY:-ghcr.io/marcusprado02}"
IMAGE_NAME="ts-commons"

if [[ "${DISTROLESS}" == "true" ]]; then
  DOCKERFILE="Dockerfile.distroless"
  FULL_TAG="${REGISTRY}/${IMAGE_NAME}:${TAG}-distroless"
else
  DOCKERFILE="Dockerfile"
  FULL_TAG="${REGISTRY}/${IMAGE_NAME}:${TAG}"
fi

echo "═══════════════════════════════════════════"
echo " Docker Build"
echo " Image      : ${FULL_TAG}"
echo " Dockerfile : ${DOCKERFILE}"
echo " Git commit : ${GIT_COMMIT}"
echo " Build date : ${BUILD_DATE}"
echo "═══════════════════════════════════════════"

docker build \
  --file "${DOCKERFILE}" \
  --tag "${FULL_TAG}" \
  --tag "${REGISTRY}/${IMAGE_NAME}:latest" \
  --build-arg "GIT_COMMIT=${GIT_COMMIT}" \
  --build-arg "BUILD_DATE=${BUILD_DATE}" \
  --build-arg "IMAGE_TAG=${TAG}" \
  --cache-from "type=registry,ref=${REGISTRY}/${IMAGE_NAME}:latest" \
  --label "org.opencontainers.image.created=${BUILD_DATE}" \
  --label "org.opencontainers.image.revision=${GIT_COMMIT}" \
  --label "org.opencontainers.image.version=${TAG}" \
  .

echo ""
echo "✔ Build successful: ${FULL_TAG}"

# Print image size
docker image inspect "${FULL_TAG}" \
  --format '  Size: {{.Size | printf "%.0f"}} bytes ({{.Size | printf "%.2f" | echo}} ≈ MB)' \
  2>/dev/null || true

if [[ "${PUSH}" == "true" ]]; then
  echo ""
  echo "▶ Pushing ${FULL_TAG}..."
  docker push "${FULL_TAG}"
  docker push "${REGISTRY}/${IMAGE_NAME}:latest"
  echo "✔ Push complete"
fi
