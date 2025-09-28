# OCR Processor Deployment Checklist

Use this checklist when promoting the updated OCR edge function.

## Pre-deploy

- [ ] Confirm all CI/unit tests pass locally (`deno test --allow-env supabase/functions/ocr-processor/index.test.ts`).
- [ ] Review git diff; ensure only expected files are staged.
- [ ] Update environment variables per `docs/ocr_processor_validation.md`.
- [ ] Notify stakeholders (menu ops, support) of the deployment window.

## Deployment

- [ ] Deploy the function (`supabase functions deploy ocr-processor --project <id>` or via CI).
- [ ] Capture deployment output/logs for traceability.
- [ ] Warm the function once (invoke the HTTP endpoint) to populate logs.

## Post-deploy smoke

- [ ] Run the staging validation playbook (success, unsupported file, oversized payload).
- [ ] Verify `ocr_jobs` table shows expected status transitions.
- [ ] Confirm WhatsApp notification (or fallback logging) fires for the success path.
- [ ] Check Supabase storage for the JSON cache artefact.

## Monitoring

- [ ] Add/confirm alerts for:
  - jobs stuck `processing` > 5 minutes,
  - jobs hitting `OCR_MAX_ATTEMPTS`,
  - repeated `category limit` / `item limit` / `Unsupported content type` errors.
- [ ] Trend storage bucket usage post-deploy.

## Rollback readiness

- [ ] Keep the previous function build artefact available.
- [ ] Document manual rollback command in the on-call channel.
- [ ] Retain the validation results for the release ticket.

Tick each item before marking the release done.
