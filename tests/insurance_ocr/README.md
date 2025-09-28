# Insurance OCR Acceptance Checks

The payloads in this folder can be replayed with `deno task wa:test` (or a raw
`curl` POST) against the deployed `wa-webhook` endpoint. Each payload mimics a
WhatsApp webhook delivery while the chat state is `ins_wait_doc`.

## 1. Happy path (image)

```
curl -X POST \
  -H "Content-Type: application/json" \
  -d @payload.image.json \
  https://<project-ref>.functions.supabase.co/wa-webhook
```

Expected:

- Storage upload under `insurance/<lead_id>/…` (see `notifications` →
  `file_path`).
- `insurance_leads.status = 'ocr_ok'`, `raw_ocr` & `extracted` populated.
- Logs: `INS_MEDIA_FETCH_OK`, `INS_UPLOAD_OK`, `INS_OCR_OK`,
  `INS_LEAD_UPDATE_OK`, `INS_ADMIN_NOTIFY_OK`.
- User receives the structured summary text.
- Each admin in `app_config.insurance_admin_numbers` receives the alert text.

## 2. Happy path (PDF)

Same command with `payload.pdf.json`. Expect identical behaviour; ensure the
extracted JSON contains VIN, policy number, expiry.

## 3. Low quality / unreadable image

Use `payload.bad.json` (blurry photo). Expect:

- `insurance_leads.status = 'ocr_error'` for the new lead.
- Logs include `INS_OCR_FAIL` and `INS_LEAD_UPDATE_OK` (status `ocr_error`).
- User receives the polite error message.
- No admin alerts are sent (`INS_ADMIN_NOTIFY_OK` with `count = 0`).

## 4. Missing `OPENAI_API_KEY`

Unset the secret locally (`deno run --allow-env --allow-net …`) or via the
Supabase dashboard and resend `payload.image.json`. Expect an immediate user
error message, lead status `ocr_error`, and `INS_OCR_FAIL` noting the missing
key.

## 5. Admin mark reviewed (manual UI)

In the Admin app, open the Insurance leads list, select the new lead, and click
“Mark reviewed”. The row should move to `status = 'reviewed'`.

> See also: `docs/OCR_PIPELINE_PLAN.md` for a deeper checklist.
