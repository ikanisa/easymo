# OCR Spec — ibimina-ocr (Skeleton)

## Purpose
- Parse National ID images via OpenAI Vision.

## Function Interface (`supabase/functions/ibimina-ocr`)

### Request

```
POST /functions/v1/ibimina-ocr
Headers:
  Content-Type: application/json
  X-API-Key: <IBIMINA_OCR_API_KEY> (optional guard; required when set)

Body:
{
  "userId": "<uuid>",
  "ikiminaId": "<uuid>"?,
  "metadata": {...}?,
  "frontImage": {
    "base64": "<base64-without-prefix>",
    "mimeType": "image/jpeg",
    "filename": "front.jpg"?
  },
  "backImage": {
    "base64": "...",
    "mimeType": "image/jpeg",
    "filename": "back.jpg"?
  }?
}
```

- Images must be base64 strings (`data:` prefixes accepted). Max size 8 MB each.
- `ikiminaId` is optional metadata stored with the parsed payload.

### Response

```
200 OK
{
  "ok": true,
  "documentId": "<kyc_documents.id>",
  "status": "pending",
  "parsed": {
    "full_name": "...",
    "id_number": "...",
    "date_of_birth": "YYYY-MM-DD"?,
    "place_of_issue": "..."?,
    "expiry_date": "YYYY-MM-DD"?,
    "confidence": 0.92?,
    "field_confidence": { "id_number": 0.96, ... }?
  },
  "frontUrl": "https://...signed...",
  "backUrl": "https://...signed..."?
}
```

Errors return `{ ok: false, error: "..." }` with appropriate HTTP codes.

### Storage
- Raw binaries saved to `KYC_STORAGE_BUCKET` (default `kyc-documents`).
- Signed URLs (TTL `KYC_SIGNED_URL_TTL_SECONDS`, default 7 days) are returned to the caller; the database stores storage paths.
- `kyc_documents.parsed_json` captures extracted fields, confidences, metadata, asset paths, and a truncated copy of the model response.

### OpenAI Prompting
- Uses `OPENAI_VISION_MODEL` (`gpt-4o-mini` by default) via the Responses API with a JSON schema enforcing:
  `full_name`, `id_number`, `date_of_birth`, `place_of_issue`, `expiry_date`, `confidence`, `field_confidence`.
- Model confidence values are clamped to `[0,1]`. Low-confidence cases remain `pending` for manual review.

## Admin Review
- KYC reviewers fetch documents via `/api/baskets/kyc` which now signs storage paths per request.
- Approve/reject actions continue to flow through `/api/baskets/kyc/{id}`.

## Audit & Retention
- `parsed_json` contains `created_at`, model metadata, and asset paths for traceability.
- Source images stored in `kyc-documents` remain private; signed URLs are short-lived.
