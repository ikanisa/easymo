# Supabase Backup & Restore Plan

## Objective

Define a repeatable process for safeguarding Postgres data and storage assets,
and for restoring service within the Recovery Time Objective (RTO) agreed in the
production readiness audit.

## Backups

- **Postgres Automated Backups:**
  - Supabase retains daily snapshots (verify retention in project settings).
  - Schedule weekly manual snapshots before major deployments; label snapshots
    with release tag.
- **Logical Exports:**
  - Nightly `pg_dump` (schema + data) stored in encrypted S3 bucket
    `s3://easymo-backups/YYYY/MM/DD/`.
  - Use `PGPASSWORD=$SERVICE_ROLE supabase db dump` with KMS-managed encryption.
- **Storage Buckets:**
  - Weekly export via `supabase storage list` + `aws s3 sync` to cold storage.
  - Insurance documents (`docs/`) require 30-day retention; vouchers/QR buckets
    90-day retention.

## Restore Procedure

1. **Trigger:** Incident commander declares DR due to data corruption or
   extended outage.
2. **Snapshot Selection:**
   - Choose latest healthy snapshot (check Supabase status + monitoring logs).
   - For logical dumps, select the backup prior to incident timestamp.
3. **Restore Steps:**
   - Provision new Supabase project (staging) for test restore.
   - Run `supabase db restore --project-ref <ref> --backup-id <snapshot>`.
   - Re-encrypt and sync storage buckets from cold storage.
   - Execute smoke tests: voucher issuance, campaign creation, station redeem.
4. **Cutover:**
   - If restore validated, promote environment (update DNS/env vars) or request
     Supabase support to restore snapshot into production project.
   - Communicate downtime window to stakeholders.

## Validation Schedule

- **Quarterly Dry Run:**
  - Restore latest snapshot into staging.
  - Capture duration, issues, data loss delta.
  - Log results in Ops wiki and update `SYSTEM_CHECKLIST.md`.
- **Post-Deployment Spot Check:**
  - After major schema change, confirm backup success and ability to list
    snapshots.

## Roles & Responsibilities

- **Data Platform Lead:** Owns backup automation scripts and S3 access.
- **On-call Engineer:** Executes restore during incident; follows runbook.
- **Support Manager:** Communicates with stakeholders/customer support.

## Tooling

- Supabase CLI (`supabase db dump/restore`).
- AWS CLI for storage sync.
- KMS for secret management.

## Automation

- `scripts/supabase-backup-restore.sh` orchestrates the logical dump, snapshot
  verification, storage bucket sync, and staging restore.
  - Requires `SUPABASE_ACCESS_TOKEN`, project refs for production and staging,
    Postgres connection strings, and an `AWS_BACKUP_BUCKET` destination.
  - Outputs timestamped artifacts under `backups/<UTC timestamp>/` including
    the SQL dump, checksum, snapshot manifest, row-count comparison CSV, and a
    consolidated `backup.log`.
  - Uploads the dump and bucket exports to
    `s3://$AWS_BACKUP_BUCKET/supabase/<timestamp>/` and records row deltas for
    `vouchers`, `voucher_events`, and `insurance_documents` as part of the dry
    run evidence.

## Metrics

- RPO (Recovery Point Objective): ≤ 15 minutes using logical dump + WAL shipping
  (future enhancement).
- RTO (Recovery Time Objective): ≤ 2 hours validated via dry run.

## Follow-Up Actions

- Automate verification job to compare row counts between production and
  restored snapshot post-test.
- Document encryption keys rotation schedule.
