#!/usr/bin/env bash
set -euo pipefail

# One-time GCP resources for Josh 背单词.
# Usage:
#   export GCP_PROJECT=your-project
#   export GCP_REGION=asia-east1
#   ./scripts/gcp/setup.sh

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PROJECT="${GCP_PROJECT:?Set GCP_PROJECT}"
REGION="${GCP_REGION:-asia-east1}"
INSTANCE="${CLOUD_SQL_INSTANCE:-rtsw-pg}"
DB_NAME="${CLOUD_SQL_DB:-rtsw}"
DB_USER="${CLOUD_SQL_USER:-rtsw}"
REPO="${ARTIFACT_REPO:-rtsw}"
SERVICE="${CLOUD_RUN_SERVICE:-rtsw}"
ADMIN_USER="${BOOTSTRAP_ADMIN_USER:-admin}"

if [[ -z "${BOOTSTRAP_ADMIN_PASSWORD:-}" ]]; then
  echo "Set BOOTSTRAP_ADMIN_PASSWORD before running setup." >&2
  exit 1
fi

if [[ -z "${DB_PASSWORD:-}" ]]; then
  DB_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)"
fi
if [[ -z "${JWT_SECRET:-}" ]]; then
  JWT_SECRET="$(openssl rand -hex 32)"
fi

gcloud config set project "$PROJECT"
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
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
  gcloud sql instances create "$INSTANCE" \
    --database-version=POSTGRES_16 \
    --tier=db-f1-micro \
    --region="$REGION" \
    --storage-size=10GB \
    --availability-type=zonal
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

if ! gcloud run services describe "$SERVICE" --region="$REGION" >/dev/null 2>&1; then
  echo "Cloud Run service will be created on first deploy."
fi

echo
echo "Setup complete."
echo "  project:     $PROJECT"
echo "  region:      $REGION"
echo "  sql:         $CONNECTION_NAME"
echo "  image repo:  ${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/app"
echo
echo "Next:"
echo "  GCP_PROJECT=$PROJECT GCP_REGION=$REGION BOOTSTRAP_ADMIN_USER=$ADMIN_USER ./scripts/gcp/deploy.sh"
echo "  Then seed wordbooks: ./scripts/gcp/seed.sh"
echo
echo "Save DB_PASSWORD if you need to connect later (also stored in Secret Manager as rtsw-database-url)."
