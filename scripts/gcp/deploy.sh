#!/usr/bin/env bash
set -euo pipefail

# Build, push, and deploy the app to Cloud Run.
# Usage:
#   export GCP_PROJECT=your-project
#   ./scripts/gcp/deploy.sh
# Optional: SKIP_BUILD=1 to only redeploy the existing :latest image.

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PROJECT="${GCP_PROJECT:?Set GCP_PROJECT}"
REGION="${GCP_REGION:-asia-east1}"
REPO="${ARTIFACT_REPO:-rtsw}"
SERVICE="${CLOUD_RUN_SERVICE:-rtsw}"
INSTANCE="${CLOUD_SQL_INSTANCE:-rtsw-pg}"
ADMIN_USER="${BOOTSTRAP_ADMIN_USER:-admin}"
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

gcloud run deploy "$SERVICE" \
  --image "${IMAGE}:${TAG}" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --add-cloudsql-instances "$CONNECTION_NAME" \
  --set-env-vars "NODE_ENV=production,PORT=8080,DATASETS_DIR=/app/datasets,PUBLIC_DIR=/app/server/public,BOOTSTRAP_ADMIN_USER=${ADMIN_USER}" \
  --set-secrets "DATABASE_URL=rtsw-database-url:latest,JWT_SECRET=rtsw-jwt-secret:latest,BOOTSTRAP_ADMIN_PASSWORD=rtsw-bootstrap-admin-password:latest" \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 3

echo
echo "Deployed:"
gcloud run services describe "$SERVICE" --region="$REGION" --format='value(status.url)'
