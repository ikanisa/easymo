# Phase 0 – Credential & Configuration Checklist

Maintain this sheet as the source of truth before we move into schema and code
changes. Every value below maps directly to keys in `.env.sample` and to the
system design deliverables.

## 1. Supabase

- `NEXT_PUBLIC_SUPABASE_URL` – project URL from Supabase settings → API.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` – anon key from the same panel (safe for
  client usage).
- `SUPABASE_URL` – identical to the public URL; used server-side.
- `SUPABASE_SERVICE_ROLE_KEY` – service role key (keep secret).
- `SUPABASE_JWT_SECRET` – JWT secret for verifying tokens in webhooks/Edge
  Functions.

## 2. WhatsApp Cloud API / Meta Flows

- `WHATSAPP_API_BASE_URL` – default to `https://graph.facebook.com/v20.0` unless
  Meta upgrades the account.
- `WHATSAPP_BUSINESS_ACCOUNT_ID` – from Business Manager → WhatsApp → Settings.
- `WHATSAPP_PHONE_NUMBER_ID` – found in WhatsApp Manager → Phone numbers.
- `WHATSAPP_SYSTEM_USER_ID` – system user linked to the app (optional but
  recommended for auditing).
- `WHATSAPP_ACCESS_TOKEN` – long-lived token or token exchange output (rotate
  frequently).
- `WHATSAPP_VERIFY_TOKEN` – shared secret used to validate webhook registration
  callbacks.
- `WHATSAPP_APP_SECRET` – App secret needed to validate `X-Hub-Signature-256`
  headers.
- `WHATSAPP_TEMPLATE_NAMESPACE` – template namespace for HSM messages.

### Flow-specific secrets

- `FLOW_DATA_CHANNEL_TOKEN` – shared secret included in Flow data_exchange
  callbacks for lightweight auth.
- `FLOW_ENCRYPTION_PRIVATE_KEY` / `FLOW_ENCRYPTION_PUBLIC_KEY` – optional key
  pair if Flow Encryption is enabled in WhatsApp Manager.

## 3. Notification Templates (Meta)

Confirm the template names exist (or reserve them) in WhatsApp Manager:

- `order_created_vendor`
- `order_pending_vendor`
- `order_paid_customer`
- `order_served_customer`
- `order_cancelled_customer`
- `cart_reminder_customer`

These map to the env defaults `TEMPLATE_*`; update the env values if Meta
approves different names or locales.

## 4. OCR Provider

Current plan: Azure Document Intelligence (replace if you choose another
service).

- `OCR_PROVIDER` – keep as `azure_document_intelligence` for feature flags.
- `OCR_ENDPOINT_URL` – Azure endpoint (e.g.,
  `https://<resource>.cognitiveservices.azure.com/`).
- `OCR_API_KEY` – key for the OCR resource.

## 5. Storage / Media

Supabase storage buckets (create via Supabase dashboard or migrations):

- `MENU_MEDIA_BUCKET` – raw PDF/image uploads from bars.
- `OCR_RESULT_BUCKET` – structured OCR JSON cache (optional but recommended).
- `VOUCHERS_BUCKET` – fuel voucher PNG artifacts (keep private; used for signed
  URLs).

## 6. QR Tokens & Security

- `QR_TOKEN_SECRET` – random string for HMAC signatures inside QR payloads.
- `QR_TOKEN_TTL_SECONDS` – TTL for table tokens (0 keeps them non-expiring;
  adjust later).
- `BRIDGE_SHARED_SECRET` – shared header secret for internal bridge calls
  (voucher issuance, etc.).
- `VOUCHER_SIGNING_SECRET` – secret used to sign fuel voucher codes (HMAC
  SHA-256, base32 output).

## 7. Observability / Monitoring (Optional but prepare now)

- `LOG_LEVEL` – defaults to `info`.
- `SENTRY_DSN` – Sentry project DSN when observability is enabled.

## 8. Internal URLs

- `FLOW_EXCHANGE_BASE_URL` – public URL where the Flow data_exchange endpoint
  will live (e.g., Supabase Edge Function URL).
- `WHATSAPP_WEBHOOK_PUBLIC_URL` – public webhook URL registered in Meta.
- `MEDIA_FETCH_CALLBACK_URL` – optional hook for asynchronous OCR callbacks.

## 9. Test Fixtures (sandbox)

- `TEST_CUSTOMER_WA_ID` – WhatsApp ID you can safely use for manual QA.
- `TEST_VENDOR_WA_ID` – WhatsApp ID for a staging vendor user.

> ✅ **Gate**: Do not proceed to Phase 1 until every required secret above is
> collected and securely stored in your deployment environment (for example,
> Supabase Edge secrets, a managed secrets manager, or your hosting provider’s
> vault). Update `.env.sample` values locally only with non-secret
> placeholders.
