#!/usr/bin/env bash
set -euo pipefail

# Build, push, and deploy the app to Cloud Run.
# Usage:
#   ./scripts/gcp/deploy.sh
#   SKIP_BUILD=1 ./scripts/gcp/deploy.sh   # redeploy existing :latest / TAG image
#
# Reads scripts/gcp/.env.gcp (created by setup.sh). If missing, prompts and saves.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=./common.sh
source "$SCRIPT_DIR/common.sh"

need_gcloud
ensure_gcp_config 0
apply_gcp_defaults

PROJECT="$GCP_PROJECT"
REGION="$GCP_REGION"
REPO="$ARTIFACT_REPO"
SERVICE="$CLOUD_RUN_SERVICE"
INSTANCE="$CLOUD_SQL_INSTANCE"
ADMIN_USER="$BOOTSTRAP_ADMIN_USER"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/app"
TAG="${IMAGE_TAG:-$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)}"

gcloud config set project "$PROJECT"
CONNECTION_NAME="$(gcloud sql instances describe "$INSTANCE" --format='value(connectionName)')"

if [[ "${SKIP_BUILD:-}" != "1" ]]; then
  gcloud builds submit "$ROOT" \
    --tag "${IMAGE}:${TAG}" \
    --project "$PROJECT"
  gcloud container images add-tag "${IMAGE}:${TAG}" "${IMAGE}:latest" --quiet
fi

# Low-traffic Cloud Run: scale to zero when idle; cap instances.
# Override with CLOUD_RUN_MEMORY / CLOUD_RUN_MAX_INSTANCES if needed.
RUN_MEMORY="${CLOUD_RUN_MEMORY:-512Mi}"
RUN_MAX="${CLOUD_RUN_MAX_INSTANCES:-2}"

gcloud run deploy "$SERVICE" \
  --image "${IMAGE}:${TAG}" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --add-cloudsql-instances "$CONNECTION_NAME" \
  --set-env-vars "NODE_ENV=production,DATASETS_DIR=/app/datasets,PUBLIC_DIR=/app/server/public,BOOTSTRAP_ADMIN_USER=${ADMIN_USER}" \
  --set-secrets "DATABASE_URL=rtsw-database-url:latest,JWT_SECRET=rtsw-jwt-secret:latest,BOOTSTRAP_ADMIN_PASSWORD=rtsw-bootstrap-admin-password:latest" \
  --memory "$RUN_MEMORY" \
  --cpu 1 \
  --min-instances 0 \
  --max-instances "$RUN_MAX" \
  --concurrency 80 \
  --cpu-throttling

echo
echo "Deployed:"
gcloud run services describe "$SERVICE" --region="$REGION" --format='value(status.url)'
