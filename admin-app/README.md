# Admin Panel

This package hosts the easyMO / Kwigira Admin Panel (Next.js). Work here must
remain additive-only.

## Guardrails

- Review `ADD_ONLY_RULES.md` before making changes.
- CI enforces forbidden path rules via `.github/workflows/additive-guard.yml`.
- Sensitive paths require approval from CODEOWNERS (`.github/CODEOWNERS`).

## Current Status

- App Router layout implements top navigation, grouped left nav, and mock-backed
  read views for every planned surface (Dashboard, Users, Insurance, Bars, Menus
  & OCR, Orders, Staff Numbers, QR & Deep Links, Stations, Vouchers, Campaigns,
  Templates & Flows, WhatsApp Health, Notifications, Files, Settings, Logs).
- Shared UI components (virtualized `DataTable`, KPI cards, Section cards,
  empty/loading states, toast notifications) power the current previews while we
  wire real APIs.
- Dashboard, Users, Vouchers, Campaigns, Orders, and other pages render
  structured mock data with filtering so stakeholders can review scope before
  server routes land.
- API integrations will call Supabase Edge Functions strictly via HTTP bridges
  once implemented.
- Voice, leads, and marketplace surfaces are wired to Phase 4/5 services. The
  Live Calls page consumes `/api/live-calls`, Leads persists updates through
  Agent-Core, and Marketplace aggregates ranking/intents/purchases from the new
  microservices.

## Getting Started

1. Install dependencies (see repo `DEV_SETUP.md`).
2. From `admin-app/`, install packages via `pnpm install` (or preferred
   workspace tooling once configured).
3. Start the dev server with `pnpm dev` and visit `http://localhost:3000`.
4. Configure Supabase environment variables through `.env.local` (never commit
   secrets).

### Mock Data

- Mocks are opt-in. Set `NEXT_PUBLIC_USE_MOCKS=true` only when you need the
  fixture dataset without connecting to Supabase.
- When mocks are disabled (default), the runtime expects
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and the
  server-side credentials to be present. Missing values now throw during
  requests so misconfiguration is detected early.

### Environment

The admin panel assumes every deployment targets the Supabase project
`lhbowpbcpwoiparwnwgt`. Keep the following variables aligned across
`.env.local`, your hosting provider, and Supabase Edge Functions:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` / `VITE_SUPABASE_URL` | Should equal `https://lhbowpbcpwoiparwnwgt.supabase.co`. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY` | Browser-safe anonymous key for client fetches. |
| `SUPABASE_SERVICE_ROLE_KEY` / `VITE_SUPABASE_SERVICE_ROLE_KEY` | Service-role key used exclusively on the server. Never expose to browsers. |
| `VITE_ADMIN_TOKEN` / `ADMIN_TOKEN` / `EASYMO_ADMIN_TOKEN` | Shared secret used to call Supabase edge functions (`x-api-key` / `x-admin-token`). Store the same value in Supabase function secrets. |
| `ADMIN_SESSION_SECRET` | Minimum 16 characters; signs the HttpOnly session cookie. |
| `ADMIN_ACCESS_CREDENTIALS` | JSON array of operator tokens (`[{"actorId":"...","token":"...","label":"Ops"}]`). |
| `DISPATCHER_FUNCTION_URL` | Defaults to `https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/campaign-dispatch`. |
| `AGENT_CORE_INTERNAL_TOKEN` | Shared token for internal calls to Agent-Core (matches `AGENT_INTERNAL_TOKEN` in the service). |
| `AGENT_CORE_URL` | Base URL for Agent-Core (defaults to `http://localhost:4000`). |
| `VOICE_BRIDGE_API_URL` | Base URL for Voice Bridge analytics (`http://localhost:4100`). |
| `WALLET_SERVICE_URL` | Wallet service base URL for marketplace purchases (`http://localhost:4400`). |
| `MARKETPLACE_RANKING_URL` / `MARKETPLACE_VENDOR_URL` / `MARKETPLACE_BUYER_URL` | Base URLs for Phase 5 marketplace services. |

Operators visit `/login`, paste an operator token from
`ADMIN_ACCESS_CREDENTIALS`, and receive a secure session cookie. Subsequent API
requests include the actor id automatically and can forward the shared
`VITE_ADMIN_TOKEN` when edge functions are invoked.

Mocks remain opt-in. Set `NEXT_PUBLIC_USE_MOCKS=true` only when you need the
fixture dataset without Supabase connectivity.

#### Production login verification

1. Deploy the latest branch and ensure the variables above are present in
   your hosting provider's secret manager.
2. Visit `https://admin.easymo.dev/login`, submit a valid operator token, and
   confirm you are redirected to `/dashboard`.
3. Open DevTools → Application → Cookies and verify `admin_session` is set for
   the production domain (HttpOnly, Secure, SameSite=Lax).
4. Navigate across a handful of pages; the session cookie should persist and the
   top-right avatar should display the operator label initials.
5. Sign out from the top bar and ensure the cookie is cleared and the app
   returns to `/login`.

## PWA & Offline Behaviour

- The app ships a full Web App Manifest (`public/manifest.webmanifest`) with
  icons, shortcuts, and install metadata. Browsers will prompt to install once a
  user visits `/` twice.
- A service worker (`public/sw.js`) precaches the shell, serves an offline
  fallback, caches runtime GET requests with network-first semantics, and posts
  `SW_ACTIVATED` to the client when a new bundle is ready. Operators see a
  "Refresh" toast so they can reload on their schedule.
- POST mutations are queued when offline and replayed automatically via
  Background Sync once connectivity returns. Toasts surface queued, retried, or
  dropped requests; you can manually flush the queue with
  `navigator.serviceWorker.controller?.postMessage({ type: 'SW_FLUSH_QUEUE' })`.
- When `navigator.onLine` reports offline, an overlay banner appears and write
  buttons are disabled globally. Lists remain readable from cache, but actions
  resume only after connectivity returns.

## Resources

- Fixture plan: `DATA_FIXTURES_PLAN.md`
- QA checklist: `QA_MATRIX.md`
- UX guidelines: `UX_POLISH_BRIEF.md`
- API docs: `admin-app/docs/API.md`
- Degraded states: `admin-app/docs/DEGRADED_STATES.md`
- Operator runbook: `admin-app/docs/OPERATOR_GUIDE.md`
