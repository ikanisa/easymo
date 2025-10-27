#!/usr/bin/env bash
set -euo pipefail

# Automates Supabase logical backups, snapshot verification, storage bucket
# sync, and staging restore. The workflow mirrors the DR objectives captured in
# audits/production_readiness/DR_BACKUP_PLAN.md.

log() {
  local message="$1"
  local timestamp
  timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  echo "[${timestamp}] ${message}" | tee -a "${LOG_FILE}"
}

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required environment variable: ${name}" >&2
    exit 1
  fi
}

cleanup() {
  local status=$?
  if [[ $status -ne 0 ]]; then
    log "Backup pipeline failed with status ${status}."
  else
    log "Backup pipeline completed successfully."
  fi
}

trap cleanup EXIT

TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
BACKUP_ROOT=${BACKUP_ROOT:-"backups/${TIMESTAMP}"}
LOG_FILE="${BACKUP_ROOT}/backup.log"
DB_DUMP_FILE="${BACKUP_ROOT}/supabase-${TIMESTAMP}.sql"
SNAPSHOT_MANIFEST="${BACKUP_ROOT}/snapshots.json"
STORAGE_ROOT="${BACKUP_ROOT}/storage"
VERIFY_TABLES=${VERIFY_TABLES:-"vouchers,voucher_events,insurance_documents"}
STORAGE_BUCKETS=${STORAGE_BUCKETS:-"voucher-png,voucher-qr,insurance-docs"}
AWS_BACKUP_PATH_PREFIX=${AWS_BACKUP_PATH_PREFIX:-"supabase/${TIMESTAMP}"}

mkdir -p "${BACKUP_ROOT}" "${STORAGE_ROOT}"
touch "${LOG_FILE}"

log "Starting Supabase backup workflow (output directory: ${BACKUP_ROOT})."

# Required environment variables for the workflow.
require_env SUPABASE_ACCESS_TOKEN
require_env PROD_SUPABASE_PROJECT_REF
require_env PROD_DATABASE_URL
require_env STAGING_SUPABASE_PROJECT_REF
require_env STAGING_DATABASE_URL
require_env AWS_BACKUP_BUCKET

if ! command -v supabase >/dev/null 2>&1; then
  log "Supabase CLI is required but was not found in PATH."
  exit 1
fi

if ! command -v aws >/dev/null 2>&1; then
  log "AWS CLI is required but was not found in PATH."
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  log "jq is required but was not found in PATH."
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  log "psql is required but was not found in PATH."
  exit 1
fi

log "Authenticating Supabase CLI session for scripted commands."
supabase login --token "${SUPABASE_ACCESS_TOKEN}" >/dev/null 2>&1
log "Supabase CLI authentication refreshed."

log "Dumping production database via supabase db dump."
PGPASSWORD="${PGPASSWORD:-}" supabase db dump \
  --project-ref "${PROD_SUPABASE_PROJECT_REF}" \
  --schema public \
  --file "${DB_DUMP_FILE}" >>"${LOG_FILE}" 2>&1

if [[ ! -s "${DB_DUMP_FILE}" ]]; then
  log "Database dump file is empty; aborting."
  exit 1
fi

log "Database dump captured at ${DB_DUMP_FILE}. Calculating checksum."
sha256sum "${DB_DUMP_FILE}" | tee "${DB_DUMP_FILE}.sha256" >>"${LOG_FILE}"

log "Requesting Supabase backup snapshots for verification."
HTTP_STATUS=$(curl -sS -w "%{http_code}" -o "${SNAPSHOT_MANIFEST}" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  "https://api.supabase.com/v1/projects/${PROD_SUPABASE_PROJECT_REF}/backups")

if [[ "${HTTP_STATUS}" != "200" ]]; then
  log "Failed to fetch snapshot manifest (status ${HTTP_STATUS})."
else
  SNAPSHOT_COUNT=$(jq 'length' "${SNAPSHOT_MANIFEST}")
  log "Snapshot manifest saved (${SNAPSHOT_COUNT} entries)."
fi

log "Syncing storage buckets (${STORAGE_BUCKETS}) to S3."
IFS=',' read -ra BUCKET_LIST <<< "${STORAGE_BUCKETS}"
for bucket in "${BUCKET_LIST[@]}"; do
  local_dir="${STORAGE_ROOT}/${bucket}"
  mkdir -p "${local_dir}"
  log "Downloading bucket '${bucket}' contents."
  supabase storage download \
    --project-ref "${PROD_SUPABASE_PROJECT_REF}" \
    --bucket "${bucket}" \
    --path "" \
    --download-to "${local_dir}" >>"${LOG_FILE}" 2>&1

  log "Syncing bucket '${bucket}' to s3://${AWS_BACKUP_BUCKET}/${AWS_BACKUP_PATH_PREFIX}/storage/${bucket}/"
  aws s3 sync "${local_dir}/" \
    "s3://${AWS_BACKUP_BUCKET}/${AWS_BACKUP_PATH_PREFIX}/storage/${bucket}/" \
    --delete >>"${LOG_FILE}" 2>&1

done

log "Uploading logical dump to S3."
aws s3 cp "${DB_DUMP_FILE}" "s3://${AWS_BACKUP_BUCKET}/${AWS_BACKUP_PATH_PREFIX}/db.sql" >>"${LOG_FILE}" 2>&1
aws s3 cp "${DB_DUMP_FILE}.sha256" "s3://${AWS_BACKUP_BUCKET}/${AWS_BACKUP_PATH_PREFIX}/db.sql.sha256" >>"${LOG_FILE}" 2>&1

log "Restoring dump into staging environment (${STAGING_SUPABASE_PROJECT_REF})."
psql "${STAGING_DATABASE_URL}" -v ON_ERROR_STOP=1 <<'SQL' >>"${LOG_FILE}" 2>&1
DO $$
BEGIN
  EXECUTE 'DROP SCHEMA IF EXISTS public CASCADE;';
  EXECUTE 'CREATE SCHEMA public AUTHORIZATION postgres;';
  EXECUTE 'GRANT ALL ON SCHEMA public TO postgres;';
  EXECUTE 'GRANT ALL ON SCHEMA public TO public;';
END
$$;
SQL

psql "${STAGING_DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${DB_DUMP_FILE}" >>"${LOG_FILE}" 2>&1

log "Staging restore completed; running row-count comparison for key tables."
IFS=',' read -ra TABLE_LIST <<< "${VERIFY_TABLES}"
for table in "${TABLE_LIST[@]}"; do
  prod_count=$(psql "${PROD_DATABASE_URL}" -tAc "SELECT COUNT(*) FROM ${table}" || echo "error")
  staging_count=$(psql "${STAGING_DATABASE_URL}" -tAc "SELECT COUNT(*) FROM ${table}" || echo "error")
  log "Table ${table}: prod=${prod_count} staging=${staging_count}"
  echo "${table},${prod_count},${staging_count}" >>"${BACKUP_ROOT}/rowcount.csv"
done

log "Backup artifacts stored under ${BACKUP_ROOT} and synchronized to S3 path ${AWS_BACKUP_BUCKET}/${AWS_BACKUP_PATH_PREFIX}."
