# Phase 6 Smoke Checklist

Use this runbook after staging or production deploys to validate the realtime,
marketplace, and OCR surfaces introduced in Phase 4/5.

## 1. Database & Schema

1. Apply Supabase migrations:
   ```bash
   supabase db push --project-ref lhbowpbcpwoiparwnwgt
   ```
2. Seed/refresh fixtures if required (safe to re-run thanks to `ON CONFLICT` guards):
   ```bash
   PGPASSWORD=<db-password> psql "postgresql://postgres@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres" \
     -v ON_ERROR_STOP=1 \
     -f supabase/seed/fixtures/admin_panel_core.sql
   PGPASSWORD=<db-password> psql "postgresql://postgres@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres" \
     -v ON_ERROR_STOP=1 \
     -f supabase/seed/fixtures/admin_panel_marketing.sql
   ```
3. Run Agent-Core Prisma migrations (Kafka/Postgres stack online):
   ```bash
   pnpm --filter @easymo/db prisma:migrate:deploy
   pnpm --filter @easymo/db seed
   ```

## 2. Edge Functions

Deploy the realtime and OCR functions with verification disabled (they guard
themselves via admin tokens):

```bash
supabase functions deploy flow-exchange --project-ref lhbowpbcpwoiparwnwgt --no-verify-jwt
supabase functions deploy wa-webhook --project-ref lhbowpbcpwoiparwnwgt --no-verify-jwt
supabase functions deploy ocr-processor --project-ref lhbowpbcpwoiparwnwgt --no-verify-jwt
```

Confirm the functions are live:
```bash
supabase functions list --project-ref lhbowpbcpwoiparwnwgt
```

## 3. Notification Templates

Validate the reminder and marketplace templates against the sandbox numbers:

```bash
ADMIN_TOKEN=<admin-token> \
curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${ADMIN_TOKEN}" \
  "https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/order-pending-reminder" \
  -d '{"dryRun":true,"msisdn":"+250780000000"}'
```

Expect HTTP 200 with a payload echoing the sandbox MSISDN. Repeat for
`cart-reminder` and `notification-worker` if template coverage changes.

## 4. OCR Worker

Trigger the OCR processor once to ensure queue → extraction → publish succeeds:

```bash
supabase functions invoke ocr-processor \
  --project-ref lhbowpbcpwoiparwnwgt \
  --no-verify-jwt
```

The response should be `Job processed`. If you see `No jobs`, enqueue a test job:

1. Upload a sample menu PDF/PNG via **Admin Panel → Files → Upload Menu** (ensure `MENU_MEDIA_BUCKET` is configured).
2. Confirm the upload appears as `Queued` in the Files table (this inserts an `ocr_jobs` row).
3. Re-run the invoke command and verify the admin panel reflects the processed menu.

## 5. Synthetic Checks & Dashboards

1. Run the GitHub Action `Synthetic Admin Checks` manually (Actions tab) and wait
   for a green run.
2. Load Grafana dashboards in `dashboards/phase4/*.json` and confirm the Kafka
   topic panels show data (`voice.contact.events`, `broker.outbound`, wallet
   ledger metrics).
3. Check the metrics collector receives `notifications.*`, `ocr.*`, and
   `marketplace.*` streams when you exercise the flows above.

Document every failure in `docs/go-live-readiness.md` along with remediation
notes before approving the deployment.
