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

## Getting Started

1. Install dependencies (see repo `DEV_SETUP.md`).
2. From `admin-app/`, install packages via `pnpm install` (or preferred
   workspace tooling once configured).
3. Start the dev server with `pnpm dev` and visit `http://localhost:3000`.
4. Configure Supabase environment variables through `.env.local` (never commit
   secrets).

### Mock Data

- By default the shell loads descriptive mock datasets (bars, menus, orders,
  vouchers, campaigns, OCR jobs, etc.) so every page renders without Supabase
  credentials.
- Set `NEXT_PUBLIC_USE_MOCKS=false` once real data access helpers are
  implemented; until then the app will gracefully fall back to mocks and log a
  warning in the server console.

### Environment

- Client-side data fetches require `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Server-side reads (and future writes) expect `SUPABASE_SERVICE_ROLE_KEY`. When
  unset, the app falls back to mock datasets automatically.
- Admin API requests require an actor identifier. In development set
  `NEXT_PUBLIC_DEFAULT_ACTOR_ID` (exposed to the browser) and
  `ADMIN_DEFAULT_ACTOR_ID` (server-side) to the UUID of a trusted staff user.
  Reverse proxies in production must inject a valid `x-actor-id` header per
  request; otherwise the middleware returns `401`.
- Mocks are now opt-in. Set `NEXT_PUBLIC_USE_MOCKS=true` if you need the fixture
  dataset without connecting to Supabase.

## PWA & Offline Behaviour

- The app ships a full Web App Manifest (`public/manifest.webmanifest`) with
  icons, shortcuts, and install metadata. Browsers will prompt to install once a
  user visits `/` twice.
- A service worker (`public/sw.js`) precaches the shell, caches runtime GET
  requests with network-first semantics, and posts `SW_ACTIVATED` to the client
  when a new bundle is ready. The UI raises a "Refresh" toast so operators can
  reload on their schedule.
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
