# Executive Summary

## Overview

- **Admin panel** is a Next.js 14 "App Router" monorepo app with clear separation of concerns: UI (panel shell + pages), API route handlers, Supabase Postgres for data + Storage for media, and Supabase Edge Functions for compute offloading (OCR/embeddings/WhatsApp router).
- **Navigation and layout** are implemented centrally and expose a wide set of operational tools (Dashboard, Users, Vendors/Bars, Menus/OCR, Orders/Trips, Vouchers/Campaigns, QR/Deep Links, Subscriptions, Wallet, Agents, Logs/Notifications, WhatsApp health).
- **Agents module** is full-stack: admin APIs, UI CRUD, document ingestion (upload/URL/Drive/Web), embeddings + pgvector search via Edge Functions and database RPC, and signed URL previews.

## Frontend

### Framework

- Next.js App Router + React 18 + TypeScript; server components for prefetch + client components for interactions. `admin-app/app/layout.tsx`
- Global providers (Query, Theme, Session, Toasts, Assistant). `admin-app/components/providers/AppProviders.tsx`, `admin-app/components/layout/PanelShell.tsx`

### Layout & Navigation

- Responsive shell with top bar + sidebar; mobile navigation supported. `admin-app/components/layout/PanelShell.tsx`, `admin-app/components/layout/SidebarNav.tsx`
- Navigation groups and items are centralized. `admin-app/components/layout/nav-items.ts`
  - Overview: Dashboard, Users, Insurance
  - Operations: Bars, Menus & OCR, Orders, Trips, Staff Numbers, Stations, Live Calls, Leads, QR & Deep Links, Deep Links
  - Messaging: Vouchers, Campaigns, Templates & Flows, WhatsApp Health, Notifications
  - Platform: Files, Marketplace, Marketplace Settings, Agents, Subscriptions, Driver Subscriptions, Wallet Top-up, Settings, Logs
  - Baskets: Baskets (SACCOs)

### State/Data Fetching

- React Query v5 for client fetching; server-side prefetch with `HydrationBoundary`; shared options in `lib/api/queryClient`. `admin-app/lib/api/queryClient.ts`
- SWR remains in some legacy components; new work converges on React Query.

### Pages Overview (selected)

- Dashboard: KPIs, timeseries, recent order events, webhook errors, admin hub quick links with SSR prefetch. `admin-app/app/(panel)/dashboard/page.tsx`, `admin-app/app/(panel)/dashboard/DashboardClient.tsx`
- Menus & OCR: SSR prefetch of menu versions and OCR jobs, client renders controls. `admin-app/app/(panel)/menus/page.tsx`
- Orders: SSR prefetch of orders and client shell. `admin-app/app/(panel)/orders/page.tsx`
- Agents (list): list of agents with vector stats; create agent. `admin-app/app/(panel)/agents/page.tsx`
- Agents (detail): versions, documents (upload/URL/web/Drive), embeddings, knowledge search, tasks, runs, audit. `admin-app/app/(panel)/agents/[id]/page.tsx`
  - Knowledge coverage banner and toast notifications highlight embedding progress and document lifecycle events.
- Many other feature areas use similar SSR prefetch patterns (files, vouchers, logs, marketplace, etc.).

## Backend (App Routes)

### Pattern

- Next.js route handlers under `app/api/<domain>/...`; focused and single-responsibility style.
- Observability wrapper (Sentry) for consistent error capture. `admin-app/app/api/withObservability.ts`

### Agents Module APIs (selected)

- Persona CRUD: `admin-app/app/api/agents/[id]/route.ts`, `admin-app/app/api/agents/route.ts`
- Versions: `admin-app/app/api/agents/[id]/versions/route.ts`, publish via `.../[versionId]/publish/route.ts`, patch via `.../[versionId]/route.ts`
- Documents:
  - List/Add: `admin-app/app/api/agents/[id]/documents/route.ts`
  - Upload: `admin-app/app/api/agents/[id]/documents/upload/route.ts`
  - URL insert: `admin-app/app/api/agents/[id]/documents/url/route.ts`
  - Embed all: `admin-app/app/api/agents/[id]/documents/embed_all/route.ts`
  - Drive sync: `admin-app/app/api/agents/[id]/documents/drive_sync/route.ts`
  - Web search import: `admin-app/app/api/agents/[id]/documents/web_search/route.ts`
  - Delete document: `admin-app/app/api/agents/[id]/documents/[docId]/route.ts`
  - Per-document embed trigger: `admin-app/app/api/agents/[id]/documents/[docId]/embed/route.ts`
  - Signed URL and preview: `admin-app/app/api/agents/[id]/documents/[docId]/signed/route.ts`, `admin-app/app/api/agents/[id]/documents/[docId]/preview/route.ts`
- Search (pgvector): `admin-app/app/api/agents/[id]/search/route.ts`
- Vector stats: `admin-app/app/api/agents/[id]/vectors/stats/route.ts`
- Tasks/Runs/Audit live under `/api/agents/[id]/tasks`, `/runs`, `/audit`

### Other Domain APIs

- Insurance ingestion + OCR enqueue: `admin-app/app/api/insurance/ingest_media/route.ts`, `admin-app/app/api/insurance/ocr/enqueue/route.ts`
- Wallet transfers/top-ups; subscriptions; marketplace settings; vouchers; WhatsApp outbound; etc. (described in OpenAPI)

## Database & Storage

### Schema & Core Tables (selected)

- Agent personas/versions/documents/tasks/runs/deployments. `supabase/migrations/20251207094500_agent_management.sql`
- Embedding JSON cache table. `supabase/migrations/20251207104000_agent_embeddings.sql`
- Vector store (pgvector 1536 dims) + RPCs.
  - `supabase/migrations/20251207111000_pgvector_agent_vectors.sql`
  - RPC updates: `supabase/migrations/20251207112500_update_agent_doc_search_vec.sql`, `supabase/migrations/20251207113000_replace_agent_doc_search_vec.sql`
- Vector summary function. `supabase/migrations/20251207114500_agent_vectors_summary.sql`
- RLS: admin manage policies via `is_admin()` fallback to `service_role` (secure server-only usage).

### Storage Buckets

- Existing: `insurance-docs`, `kyc-documents`, `menu-source-files`, `ocr-json-cache`, `vouchers`. `supabase/migrations/20251018143000_storage_bucket_setup.sql`
- New: `agent-docs` (private). `supabase/migrations/20251207120000_agent_docs_storage.sql`

### Types and SDK Integration

- Generated types bound in `src/integrations/supabase/types.ts`.
- Admin app runtime config demands service-role keys for server handlers. `admin-app/lib/runtime-config.ts`

## Supabase Edge Functions

### Agent Knowledge

- `agent-doc-embed`: fetches text (storage or URL), chunks text, embeds with OpenAI, upserts JSON chunks + vectors; transactionally updates `embedding_status`. `supabase/functions/agent-doc-embed/index.ts`
- `agent-doc-search`: embeds query, calls RPC `agent_doc_search_vec`, returns scored content + source metadata. `supabase/functions/agent-doc-search/index.ts`

### Other Functions (highlights)

- WhatsApp router and flows (rich, multi-domain). `supabase/functions/wa-webhook/...`
- OCR processor and admin settings/stats/users. `supabase/functions/ocr-processor/...`, `supabase/functions/admin-settings/...`

## Configuration

### Env & Runtime

- Supabase: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (or `SERVICE_URL`/`SERVICE_ROLE_KEY` fallback), `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY`. `admin-app/lib/runtime-config.ts`
- Embeddings/search/drive env added to `.env.example`:
  - `EMBEDDING_MODEL`, `OPENAI_API_KEY`, `SEARCH_API_PROVIDER`, `BING_SEARCH_API_KEY`/`SERPAPI_KEY`, `GOOGLE_DRIVE_*`, `AGENT_DOCS_BUCKET`. `.env.example`
- Admin panel toggles and labels: `NEXT_PUBLIC_DEFAULT_ACTOR_ID`, `NEXT_PUBLIC_ENVIRONMENT_LABEL`, `NEXT_PUBLIC_USE_MOCKS`.

### OpenAPI

- Public spec centralizes endpoints across domains; includes Agents knowledge docs/search/stats. `admin-app/public/openapi.yaml`

## Data Flows (selected)

### Document Embedding

1. UI posts upload/URL/Drive/Web → Next.js API inserts `agent_documents` (status pending) → embed trigger:
   - Single doc: `POST /documents/[docId]/embed`
   - All: `POST /documents/embed_all`
2. Edge Function `agent-doc-embed`:
   - Fetch text → chunk → OpenAI embeddings → upsert `agent_document_embeddings` + `agent_document_vectors` → status ready

### Semantic Search

1. UI posts search query → Next.js API invokes `agent-doc-search`.
2. Edge Function embeds query → RPC `agent_doc_search_vec` → returns content, score, document metadata → UI renders with Preview link (signed if storage-backed).

## Testing & CI

- Vitest configured; route tests for WA webhook and OCR exist. `tests/edge/wa_webhook_router.test.ts`, `supabase/functions/ocr-processor/index.test.ts`
- Deno tests for functions listed in root `package.json` scripts; local Supabase functions serve supported (when local stack running).

## Implemented Pages & Subpages (from navigation)

- **Overview**: Dashboard (KPIs + Admin Hub, timeseries, order events, webhook errors with SSR prefetch); Users; Insurance (HITL/OCR).
- **Operations**: Bars (vendors), Menus & OCR (versions + OCR queue), Orders, Trips, Staff Numbers, Stations, Live Calls, Leads, QR & Deep Links, Deep Links.
- **Messaging**: Vouchers, Campaigns, Templates & Flows, WhatsApp Health, Notifications.
- **Platform**: Files (Storage browser), Marketplace + Settings, Agents (list/detail), Subscriptions, Driver Subscriptions, Wallet Top-up, Settings, Logs.
- **Baskets**: SACCOs (branches, contributions, loans, etc.).

## Strengths

- Clean App Router usage with SSR prefetch + client hydration.
- Centralized navigation + consistent panel shell and providers.
- Practical API layering; Supabase admin client confined to server route handlers.
- Clear, additive migrations with RLS and idempotency; vector search via pgvector (1536 dims) and usable RPCs.
- Agent knowledge end-to-end flow implemented and documented; signed URL previews.

## Gaps & Outstanding

### Environment & Deployment

- Functions deploy requires privileges (403 observed); ensure Supabase CLI login and project role permissions.
- Populate embedding/search/drive keys; missing keys degrade some flows (Drive listing, web search).
- Consider per-function import maps as recommended by Supabase CLI notice.

### UX & Consistency

- Sentry "Critical dependency" build warnings (dynamic import) persist; benign but noisy.
- Some legacy SWR remains; ongoing convergence on React Query is positive—continue migrating.
- Agents detail now uses React Query hooks for documents/versions/stats, but persona GET still separate—optionally add combined API for fewer round trips.
- Add toasts or status banners for long-running embed workflows and add periodic polling for `embedding_status` transitions.

### Security & Policies

- RLS policies are `service_role`-based for admin operations; validate `is_admin()` is present in base schema for production.
- Rate limiting for web imports/Drive sync (API-level caps and per-actor logging) is advisable.
- Ensure per-tenant scoping where multi-tenant is expected (some endpoints accept `tenantId`; ensure consistent filtering).

### Docs & OpenAPI

- OpenAPI now covers agents knowledge endpoints; consider adding marketplace/driver-subscriptions/logs specs for completeness.
- Add an "Operations Runbook" for functions deployment, required environments, and smoke tests (cURL doc added for knowledge end-to-end).

### Observability

- Sentry wired; consider structured logs for key admin actions (embed triggers, deletions) and metrics counters for document pipeline throughput/latency.

## Recommended Next Steps

- Provision secrets and deploy Edge Functions; run the end-to-end smoke tests in `docs/testing/agent-knowledge-e2e.md`.
- Migrate remaining SWR to React Query; add optimistic UI/toasts for embeds/imports with lightweight polling for `embedding_status`.
- Resolve Sentry import warnings (static imports/config in `next.config` or `sentry.client/server` files).
- Expand OpenAPI to cover all active admin APIs (Files/Logs/Marketplace/Subscriptions).
- Harden Drive/Web import paths (dedupe URLs by checksum, add per-agent caps).
- Add a combined "Agent Details" API returning persona + versions + docs + vector stats to reduce waterfall fetches.
