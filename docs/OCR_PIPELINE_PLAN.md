# OCR Pipeline & Webhook Integration Plan (Phase 3)

## Objectives
1. Capture WhatsApp inbound events (text, interactive submissions, media) via `/webhooks/whatsapp` Edge Function.
2. Persist webhook payloads and enqueue OCR jobs when vendors upload menu PDFs/images.
3. Process queued OCR jobs using OpenAI Vision (reuse insurance OCR prompt with menu-specific adjustments) to extract categories/items/prices/flags.
4. Persist structured results into Supabase `menus`, `categories`, and `items` tables and update the vendor flow context.

## Existing References
- Insurance OCR implementation (OpenAI Vision prompt and parsing logic) — replicate the technique, but adjust the prompt to emphasise menu hierarchies (categories → items → price → dietary flags).
- Tables: `ocr_jobs`, `menus`, `categories`, `items` (added in Phase 1 schema migration).

## Components

### 1. WhatsApp Webhook Edge Function (`supabase/functions/wa-webhook/index.ts`)
- **Responsibilities**
  - Validate `X-Hub-Signature-256` using `WHATSAPP_APP_SECRET`.
  - Distinguish event types: `messages`, `statuses`, `flows`. Persist raw payload to `webhook_logs`.
  - When media message received from a vendor contact:
    - Download media via Cloud API using `WHATSAPP_ACCESS_TOKEN`.
    - Store original file in `MENU_MEDIA_BUCKET` with metadata (bar_id, uploader WA ID).
    - Insert a record in `ocr_jobs` with status `queued` and source file path.
  - Respond with 200 success to Meta.

- **Secrets**: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `FLOW_DATA_CHANNEL_TOKEN` (for Flow submissions), `FLOW_EXCHANGE_BASE_URL`.

### 2. OCR Worker (`supabase/functions/ocr-processor/index.ts`)
- **Trigger**: Scheduled cron or manual invocation (Supabase scheduled function) that scans `ocr_jobs` with status `queued`.
- **Flow**
  1. Fetch job & download original file from storage.
  2. Call OpenAI Vision `gpt-4.1-mini` (or whichever model used in insurance) with prompt tuned for menu structure (see Prompt Adjustment below).
  3. Parse JSON response into categories/subcategories/items with price/flags.
  4. Upsert into `menus`, `categories`, `items` (create draft menu version per job).
  5. Update `ocr_jobs` with status `succeeded` or `failed`, store `result_path` (optional) and error message.
  6. Optionally send vendor notification (via `notifications`) pointing them to Review flow.

- **Prompt Adjustment**
  - Base on insurance OCR prompt but specify:
    ```
    You are extracting restaurant menu data. Respond with JSON: {
      "categories": [
        {
          "name": string,
          "items": [
            {
              "name": string,
              "description": string | null,
              "price": number (currency minor units),
              "flags": string[] (from {"spicy","hot","gluten_free","veg","vegan","halal"})
            }
          ]
        }
      ],
      "currency": "RWF" | "EUR" | ...
    }
    ```
  - Include heuristics for multiple price columns, combos, add-ons.

### 3. Media Fetch Helper
- Reusable function for `flow-exchange` and webhook to pull WhatsApp media:
  - Input: media ID
  - Steps: GET `/v${VERSION}/${media_id}` to retrieve download URL → fetch binary → store.

### 4. Integration with Flow
- After OCR success, vendor receives template or Flow invocation so `handleOnboardReview` loads new draft.

## Deliverables
1. `supabase/functions/wa-webhook/index.ts` (Edge Function) with validation, logging, job enqueue.
2. `supabase/functions/ocr-processor/index.ts` (scheduled worker) using OpenAI client & prompt.
3. Shared helper module `supabase/functions/_shared/media.ts` (optional) for media download.
4. Update docs: `docs/OCR_PIPELINE_PLAN.md` (this file) and `docs/PHASES.md` with execution steps.
5. Environment additions: `OPENAI_API_KEY`, `OPENAI_BASE_URL` (if needed), `MENU_MEDIA_BUCKET`, `OCR_RESULT_BUCKET` already in `.env.sample`.

## Next Steps
- Implement webhook handler skeleton (Phase 3 Job 3.2).
- Add OCR worker using OpenAI (Phase 3 Job 3.3), referencing insurance prompt.
- Extend notification pipeline (Phase 4) to alert vendors post-OCR.
