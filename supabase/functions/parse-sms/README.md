# parse-sms (MoMo parser)

Supabase Edge Function that normalises incoming mobile money SMS payloads. It
runs deterministic regex extraction with an OpenAI fallback to deliver
structured transactions to the reconciliation pipeline.

## Native app integration

- **Android staff app (`apps/admin`)** – the `SmsIngest` Capacitor plugin
  (`apps/admin/lib/native/sms-ingest.ts`) forwards freshly received MTN/Airtel
  SMS payloads to this function after signing them with the shared HMAC secret.
- **Member client (`apps/client`)** – background reconciliation jobs surface the
  parsed transactions to members through the `/app/(main)/wallet` routes once
  the function writes into the `app.momo_transactions` tables shared in
  `@ibimina/supabase-schemas`.

Both clients rely on the same Supabase schema typings from the
`@ibimina/supabase-schemas` workspace package, ensuring consistent column names
and enums when reading the reconciled data.

## Request contract

```
POST /functions/v1/parse-sms
Content-Type: application/json
X-Signature: <HMAC signature>
X-Timestamp: <ISO8601>

{
  "rawText": "You have received RWF 25,000 from ...",
  "receivedAt": "2025-02-10T08:20:10Z",
  "vendorMeta": { "provider": "mtn" }
}
```

The request must include the timestamped HMAC headers generated with the shared
secret configured in `HMAC_SHARED_SECRET`.

## Response

Successful responses return the extracted transaction and confidence score:

```
{
  "success": true,
  "transaction": {
    "msisdn": "+250788123456",
    "amount": 25000,
    "txn_id": "ABC123",
    "timestamp": "2025-02-10T08:19:58Z",
    "confidence": 0.97
  }
}
```

The function will fall back to the `sms-ai-parse` Edge Function if regex parsing
fails, allowing the native apps to present actionable feedback to the user.
