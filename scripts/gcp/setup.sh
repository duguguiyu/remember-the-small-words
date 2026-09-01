#!/usr/bin/env bash
set -euo pipefail

# One-time GCP resources for Josh 背单词.
# Usage:
#   ./scripts/gcp/setup.sh
#   ./scripts/gcp/setup.sh --reconfigure   # ask again and rewrite local config
#
# First run guides you through project/admin settings and saves them to
# scripts/gcp/.env.gcp (gitignored). Later runs reuse that file.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=./common.sh
source "$SCRIPT_DIR/common.sh"

RECONFIGURE=0
for arg in "$@"; do
  case "$arg" in
    --reconfigure|-r) RECONFIGURE=1 ;;
    -h|--help)
      echo "Usage: $0 [--reconfigure]"
      exit 0
      ;;
  esac
done

need_gcloud
ensure_gcp_config "$RECONFIGURE"
apply_gcp_defaults

PROJECT="$GCP_PROJECT"
REGION="$GCP_REGION"
INSTANCE="$CLOUD_SQL_INSTANCE"
DB_NAME="$CLOUD_SQL_DB"
DB_USER="$CLOUD_SQL_USER"
REPO="$ARTIFACT_REPO"
SERVICE="$CLOUD_RUN_SERVICE"
ADMIN_USER="$BOOTSTRAP_ADMIN_USER"

if [[ -z "${DB_PASSWORD:-}" ]]; then
  DB_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)"
fi
if [[ -z "${JWT_SECRET:-}" ]]; then
  JWT_SECRET="$(openssl rand -hex 32)"
fi
export DB_PASSWORD JWT_SECRET
save_gcp_config_file

gcloud config set project "$PROJECT"
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  sql-component.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com

if ! gcloud artifacts repositories describe "$REPO" --location="$REGION" >/dev/null 2>&1; then
  gcloud artifacts repositories create "$REPO" \
    --repository-format=docker \
    --location="$REGION" \
    --description="Josh vocabulary app images"
fi

if ! gcloud sql instances describe "$INSTANCE" >/dev/null 2>&1; then
  echo "Creating Cloud SQL instance (this can take several minutes)..."
  # Low-traffic cost defaults:
  # - ENTERPRISE + db-f1-micro = cheapest shared-core (~a few USD/mo + storage)
  # - POSTGRES_16 alone defaults to ENTERPRISE_PLUS (rejects db-f1-micro)
  # - zonal + 10GB disk + no auto-grow + 1 backup
  # Override with CLOUD_SQL_TIER / CLOUD_SQL_STORAGE_GB if needed.
  SQL_TIER="${CLOUD_SQL_TIER:-db-f1-micro}"
  SQL_STORAGE_GB="${CLOUD_SQL_STORAGE_GB:-10}"
  gcloud sql instances create "$INSTANCE" \
    --database-version=POSTGRES_16 \
    --edition=ENTERPRISE \
    --tier="$SQL_TIER" \
    --region="$REGION" \
    --storage-size="${SQL_STORAGE_GB}GB" \
    --no-storage-auto-increase \
    --availability-type=zonal \
    --backup-start-time=03:00 \
    --retained-backups-count=1
fi

if ! gcloud sql databases describe "$DB_NAME" --instance="$INSTANCE" >/dev/null 2>&1; then
  gcloud sql databases create "$DB_NAME" --instance="$INSTANCE"
fi

if ! gcloud sql users list --instance="$INSTANCE" --format='value(name)' | grep -qx "$DB_USER"; then
  gcloud sql users create "$DB_USER" --instance="$INSTANCE" --password="$DB_PASSWORD"
else
  gcloud sql users set-password "$DB_USER" --instance="$INSTANCE" --password="$DB_PASSWORD"
fi

CONNECTION_NAME="$(gcloud sql instances describe "$INSTANCE" --format='value(connectionName)')"
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost/${DB_NAME}?host=/cloudsql/${CONNECTION_NAME}"

upsert_secret() {
  local name="$1"
  local value="$2"
  if gcloud secrets describe "$name" >/dev/null 2>&1; then
    printf '%s' "$value" | gcloud secrets versions add "$name" --data-file=-
  else
    printf '%s' "$value" | gcloud secrets create "$name" --data-file=-
  fi
}

upsert_secret rtsw-database-url "$DATABASE_URL"
upsert_secret rtsw-jwt-secret "$JWT_SECRET"
upsert_secret rtsw-bootstrap-admin-password "$BOOTSTRAP_ADMIN_PASSWORD"

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
for secret in rtsw-database-url rtsw-jwt-secret rtsw-bootstrap-admin-password; do
  gcloud secrets add-iam-policy-binding "$secret" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/secretmanager.secretAccessor" >/dev/null
done

# Allow Cloud Run / Jobs to open Cloud SQL sockets.
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/cloudsql.client" \
  --quiet >/dev/null

if ! gcloud run services describe "$SERVICE" --region="$REGION" >/dev/null 2>&1; then
  echo "Cloud Run service will be created on first deploy."
fi

echo
echo "Setup complete."
echo "  project:     $PROJECT"
echo "  region:      $REGION"
echo "  sql:         $CONNECTION_NAME"
echo "  image repo:  ${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/app"
echo "  config:      $GCP_CONFIG_FILE"
echo
echo "Next:"
echo "  ./scripts/gcp/deploy.sh"
echo "  ./scripts/gcp/seed.sh"
