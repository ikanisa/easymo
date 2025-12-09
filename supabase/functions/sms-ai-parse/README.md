# sms-ai-parse (OpenAI integration)

Edge Function that calls the OpenAI Responses API to resolve ambiguous or new
mobile money SMS formats. It is invoked automatically by `parse-sms` and can be
called directly by the mobile apps for diagnostics.

## Native app integration

- **Android staff app (`apps/admin`)** – when deterministic parsing fails, the
  `SmsIngest` plugin falls back to invoking this function so operators still see
  reconciled transactions in the in-app inbox.
- **Member mobile app (`apps/client`)** – onboarding flows in
  `apps/client/app/api/onboard` call into reconciliation endpoints that surface
  AI-parsed records so members can verify their balances after linking MoMo
  accounts.

The function returns structured JSON compatible with the Supabase typings in
`@ibimina/supabase-schemas`, which keeps the UI components and backend logic in
sync when new providers roll out.

## Environment

Set the following secrets in `supabase/.env` or the project dashboard:

- `OPENAI_API_KEY` – key with access to the `gpt-4.1-mini` (or configured) model
- `OPENAI_BASE_URL` (optional) – override for regional proxy deployments

## Invocation example

```
curl -X POST "${SUPABASE_URL}/functions/v1/sms-ai-parse" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -d '{
        "rawText": "You have received RWF 15,000 from 250788765432. Ref: FT12345",
        "receivedAt": "2025-02-10T08:21:02Z"
      }'
```

Successful responses mirror the structure returned by `parse-sms` so the native
apps can cache and display results without branching logic.
