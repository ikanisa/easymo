# OCR Processor Validation Guide

This note collects the manual checks we cannot run from the CLI and should be
handled in staging/production before relying on the updated OCR worker.

## 1. Environment configuration

- Set the following Supabase Edge function environment variables (values below
  are safe defaults; adjust as needed):
  - `OCR_MAX_ATTEMPTS=3`
  - `OCR_QUEUE_SCAN_LIMIT=5`
  - `OCR_MAX_MENU_CATEGORIES=50`
  - `OCR_MAX_MENU_ITEMS=500`
- Ensure existing variables are still present: `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `MENU_MEDIA_BUCKET`, `OCR_RESULT_BUCKET`,
  `OPENAI_API_KEY`, `OPENAI_VISION_MODEL`, `OPENAI_BASE_URL`.

## 2. Smoke test in staging

1. Upload a **supported image** (PNG/JPEG) to the `MENU_MEDIA_BUCKET`.
2. Queue a job from SQL:

   ```sql
   insert into ocr_jobs (bar_id, source_file_id)
   values ('<bar-id>', '<path/in/menu-source-files>');
   ```

3. Trigger the edge function (replace URL with staging endpoint):

   ```bash
  curl -X POST "https://<project>.supabase.co/functions/v1/ocr-processor" \
     -H "Authorization: Bearer ${SUPABASE_ANON_KEY}"
   ```

4. Confirm results:
   - `select * from ocr_jobs where id = '<job-id>';` should show
     `status = 'succeeded'` with `menu_id`, `result_path` populated.
   - Check `storage.objects` for `ocr-json-cache/results/<job-id>.json`.
   - Review WhatsApp notification logs (if enabled) or Supabase logs for
     `ocr.notify_menu_ready_*` messages.

## 3. Failure-path regression

Run the same steps with intentionally problematic files:

- **Non-image asset** (e.g., PDF): expect job to fail with
  `Unsupported content
  type`. The `ocr_jobs` row should be marked `failed` and
  `attempts` should grow until `OCR_MAX_ATTEMPTS` trips.
- **Oversized output**: feed an image that will generate >50 categories or
  > 500 items (tweak env limits if you need a lower bar). Confirm the job fails
  > with `category limit` or `item limit` message.
- **Duplicate-heavy menu**: verify the succeeded job contains deduped categories
  and items by inspecting the `menus`, `categories`, and `items` tables.

## 4. Monitoring checklist

- Dashboards/alerts should track:
  - `ocr_jobs` rows stuck in `processing` > 5 minutes.
  - Growth in `attempts` approaching `OCR_MAX_ATTEMPTS`.
  - Error strings beginning with the validation messages above.
- Storage usage in `menu-source-files` and `ocr-json-cache` should be trended to
  catch large payload growth early.

Keep this doc updated as limits or flow behavior change.
