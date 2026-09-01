#!/usr/bin/env bash
set -euo pipefail

# Run the idempotent admin + wordbook seed as a one-off Cloud Run job.
# Usage:
#   ./scripts/gcp/seed.sh
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
SERVICE="$CLOUD_RUN_SERVICE"
INSTANCE="$CLOUD_SQL_INSTANCE"
JOB="$CLOUD_RUN_SEED_JOB"
ADMIN_USER="$BOOTSTRAP_ADMIN_USER"
IMAGE="$(gcloud run services describe "$SERVICE" --region="$REGION" --format='value(spec.template.spec.containers[0].image)')"

gcloud config set project "$PROJECT"
CONNECTION_NAME="$(gcloud sql instances describe "$INSTANCE" --format='value(connectionName)')"

if gcloud run jobs describe "$JOB" --region="$REGION" >/dev/null 2>&1; then
  gcloud run jobs update "$JOB" \
    --image "$IMAGE" \
    --region "$REGION" \
    --set-cloudsql-instances "$CONNECTION_NAME" \
    --set-env-vars "NODE_ENV=production,DATASETS_DIR=/app/datasets,BOOTSTRAP_ADMIN_USER=${ADMIN_USER}" \
    --set-secrets "DATABASE_URL=rtsw-database-url:latest,JWT_SECRET=rtsw-jwt-secret:latest,BOOTSTRAP_ADMIN_PASSWORD=rtsw-bootstrap-admin-password:latest" \
    --command node \
    --args dist/seed.js \
    --memory 512Mi \
    --task-timeout 10m
else
  gcloud run jobs create "$JOB" \
    --image "$IMAGE" \
    --region "$REGION" \
    --set-cloudsql-instances "$CONNECTION_NAME" \
    --set-env-vars "NODE_ENV=production,DATASETS_DIR=/app/datasets,BOOTSTRAP_ADMIN_USER=${ADMIN_USER}" \
    --set-secrets "DATABASE_URL=rtsw-database-url:latest,JWT_SECRET=rtsw-jwt-secret:latest,BOOTSTRAP_ADMIN_PASSWORD=rtsw-bootstrap-admin-password:latest" \
    --command node \
    --args dist/seed.js \
    --memory 512Mi \
    --task-timeout 10m
fi

gcloud run jobs execute "$JOB" --region="$REGION" --wait
echo "Seed job finished."
