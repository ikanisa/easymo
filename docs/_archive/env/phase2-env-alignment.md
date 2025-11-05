# Phase 2 Environment Alignment – Checklist

_Last updated: 2025-10-18_

This note accompanies the Phase 1 tasks. It lists every environment variable and platform setting that must be aligned across local `.env`, Vercel, and Supabase before we begin functional testing.

## 1. Environment Variables

The repository root `.env` now mirrors the structure we expect in Vercel and
documents the live Supabase project (`vacltfdslodqybxojytc`). Every value
prefixed with `CHANGEME_` must be replaced with the actual secret and then
copied to:

- `.env.local` (for local development)  
- Vercel project environment variables  
- Supabase Edge Function secrets (where applicable)

| Variable | Notes / Where Used |
| --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID` | Non-secret; points to `https://vacltfdslodqybxojytc.supabase.co`. |
| `VITE_SUPABASE_ANON_KEY` | Anonymous key exposed to client. |
| `SUPABASE_SERVICE_ROLE_KEY` / `SERVICE_ROLE_KEY` | Service role key. **Never** expose to browsers. Only Vercel functions / Supabase functions. |
| `VITE_ADMIN_TOKEN` / `EASYMO_ADMIN_TOKEN` / `ADMIN_TOKEN` | Shared secret used by admin panel to call edge functions. Must match Supabase function secret `EASYMO_ADMIN_TOKEN`. |
| `ADMIN_ACCESS_CREDENTIALS` | JSON array of operator tokens. Required for admin login. |
| `ADMIN_SESSION_SECRET` | Used to sign the session cookie. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Mirror of the Vite variables for Next.js compatibility. |
| Reminder / notification toggles (`CART_REMINDER_*`, `ORDER_PENDING_REMINDER_*`, `BASKETS_REMINDER_*`, `NOTIFY_*`) | Non-secret; tune according to production requirements. |
| Storage buckets (`MENU_MEDIA_BUCKET`, `KYC_STORAGE_BUCKET`, etc.) | Must exist in Supabase Storage or pages will fail. |
| `DISPATCHER_FUNCTION_URL` | Should resolve to `https://vacltfdslodqybxojytc.supabase.co/functions/v1/campaign-dispatch`. |
| `VITE_ENABLE_AGENT_CHAT`, `ENABLE_AGENT_CHAT` | Feature flag for Marketplace broker/support chat previews. Enable when the agent surfaces should be visible. |
| Integrations (`OPENAI_API_KEY`, `WA_*`, `INSURANCE_OCR_METRICS_*`, `QR_SALT`) | Secrets – provide production versions. |

## 2. Supabase Auth Configuration

Update the Supabase project settings (Dashboard → Authentication → Settings):

| Setting | Value |
| --- | --- |
| **Site URL** | `https://admin.easymo.dev` (matches `supabase/config.toml`) |
| **Redirect URLs** | Add `https://admin.easymo.dev`, preview URLs such as `https://preview-admin.easymo.dev`, and local dev hosts (`http://localhost:5173`, `http://localhost:8080`). |
| **Email OTP / Providers** | Decide whether email magic links or social providers are needed and configure them now. |

> After updating the dashboard, run a complete login flow in production to confirm Supabase redirects back to the admin panel with a valid session cookie.

## 3. Release Pipeline Environment Variables

1. Use the internal secret manager/CI pipeline (`.github/workflows/node.yml`) to list the current variables.  
2. Ensure every key listed in `.env` exists in the shared secret store referencing the official project (`vacltfdslodqybxojytc`).  
3. Set `VITE_ADMIN_TOKEN`, `ADMIN_SESSION_SECRET`, `ADMIN_ACCESS_CREDENTIALS`, `DISPATCHER_FUNCTION_URL`, and the Supabase keys to their production values.  
4. Redeploy the services through the release pipeline after updating secrets to propagate the new configuration.

## 4. Supabase Edge Function Secrets

From the Supabase dashboard (Functions → Secrets) verify the following entries are present and match the `.env` values:

- `EASYMO_ADMIN_TOKEN`  
- `SERVICE_ROLE_KEY` (if used in functions)  
- Any WhatsApp/META tokens (`WA_TOKEN`, `WA_APP_SECRET`, etc.)  
- Reminder/notification configs (batch sizes, cron enables)  
- OpenAI / OCR tokens

## 5. Smoke Tests After Sync

Once the variables are aligned:

1. **Admin login** – Log into `https://admin.easymo.dev/login` using one of the tokens defined in `ADMIN_ACCESS_CREDENTIALS`. Confirm the session cookie is created and persists between pages.  
2. **Edge function call** – From a logged-in browser, hit `/admin-stats` (or use `curl` with the `x-admin-token` header) to confirm HTTP 200.  
3. **Campaign dispatcher** – Trigger a test campaign (or call the function with a dry-run flag) to validate `DISPATCHER_FUNCTION_URL`.  
4. **Reminder toggles** – Temporarily enable/disable cron variables and ensure the functions respect the new settings (requires Phase 3 cron verification).

Document the results in the go-live tracker (`docs/go-live-readiness.md`) before moving to Phase 2.
