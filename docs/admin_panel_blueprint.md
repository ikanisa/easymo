# easyMO / Kwigira -- Admin Panel: Full-Stack Implementation Blueprint
#
# Version: 1.0
# Owner: Project Lead (You)
# Runner: Codex (Autonomous)
# Mode: Additive-Only • Guarded Execution • No destructive changes
# Date: YYYY-MM-DD
#
## Non-Negotiables
- **Additive only:** Never delete, rename, or overwrite existing files, tables, functions, or behaviors. Add new assets only.
- **Forbidden paths:**
  - `supabase/functions/wa-webhook/**`
  - `supabase/functions/**` (all existing Edge Functions are read-only)
  - `supabase/migrations/**` (add new migration files only)
- **Integration rules:**
  - Call existing Edge Functions strictly via HTTP; never edit their code.
  - If an Edge Function is unavailable, surface "not configured" in the UI instead of creating or modifying code.
- **QR integrity:** Never re-encode or resample QR bitmaps; render at native pixel ratio in any voucher composition.
- **Regions policies:** Rwanda and Malta only; WhatsApp outbound respects quiet hours, throttles, and opt-out.
- **Privacy & security defaults:** Minimize PII, mask MSISDN in station/external views, keep service-role keys server-side, ensure writes are idempotent, transactional, and audit-logged when audit tables exist.

## Goal
Deliver a world-class, modern, mobile-first, gradient-forward Admin PWA with intelligent AI-assisted operations covering UX, frontend, backend (Supabase DB + RLS), Edge Function bridges (HTTP only), policies (quiet hours, throttles, opt-out), observability, and production readiness without touching forbidden paths.

## Stack
### Frontend
- Next.js (App Router), React, TypeScript
- Styling: Tailwind CSS, CSS variables, shadcn/ui, Radix primitives
- Motion: Framer Motion (SSR-safe), honors reduced motion
- Charts: Recharts or Visx with accessible palettes
- State & data: TanStack Query cache layer, Zod schemas, react-hook-form
- PWA: Service Worker, Web App Manifest, offline cache, background sync, install prompts
- Theming: Light/Dark, dynamic gradients, glass panels
- Accessibility: WAI-ARIA semantics, focus management, keyboard navigation, high-contrast mode

### Backend
- Supabase (Postgres, Auth, Storage, Edge Functions)
- Additive migrations only (new files) for tables, indexes, enums
- Supabase Auth roles: admin, ops, station, viewer
- Storage buckets: `vouchers/`, `qr/`, `campaign-media/`, `docs/`
- Edge Functions: HTTP bridge calls only; never modify code

### Integrations
- WhatsApp via Meta Business Cloud API with pre-approved templates
- Payments: Rwanda MoMo USSD/QR, Malta Revolut link held in settings

### AI Agent
- Provider-agnostic assistant for summaries, anomaly hints, audience suggestions, template copy, send-time optimization, guardrail checks, natural-language ops plans
- Guardrails: read-most, operator confirmation for writes, respects RBAC, produces explainable audited suggestions

## Personas & Roles
- **admin:** full admin, settings, campaigns, insurance_review, vouchers, stations, files, logs
- **ops:** campaigns, vouchers, insurance_review, stations, logs, limited_settings
- **station:** redeem voucher (scoped), own history view
- **viewer:** read-only dashboards and lists
- Notes: RLS enforces least privilege; UI gates mirror backend RBAC

## UX Design Language
- **Visual style:** modern gradients, vibrant accessible palette, glass layers with soft blur/noise, rounded geometry with 8pt baseline
- **Patterns:** mobile-first cards, progressive disclosure drawers, sticky action bars on small screens, consistent empty/loading/error components, contextual tooltips and "Why disabled?" microcopy
- **Motion:** page transitions (fade+slide, 180-240ms easeOut), component stagger (30-50ms), optimistic feedback with toasts
- **Accessibility:** 4.5:1 contrast, visible focus rings, correct tab order, focus traps in modals, screen reader labels, polite live updates

## PWA Requirements
- Installable with manifest and service worker
- Offline support: cached static shell, network-first with fallback for critical data, write queues for non-critical sends
- Background sync: retry media previews and delivery receipt refreshes
- Update flow: service worker prompts "Refresh to update"
- Performance budgets: LCP <= 2.5s mobile, TTI <= 3.5s, JS budget <= 200KB gzip, image budget optimized (lossless for QR)

## Data Model Additions
- Tables (add via new migrations only):
  - `users` (existing)
  - `stations`: id, name, engencode, owner_contact, location_point, status, created_at with indexes on name, engencode, location
  - `vouchers`: id, user_id, amount, currency, station_scope, code5 (unique), qr_url, png_url, status, issued_at, redeemed_at, expires_at, created_by, campaign_id, metadata jsonb with relevant indexes
  - `voucher_events`: id, voucher_id, event_type, actor_id, station_id, context jsonb, created_at with indexes
  - `campaigns`: id, name, type, template_id, status, created_by, started_at, finished_at, metadata jsonb with status index
  - `campaign_targets`: id, campaign_id, msisdn, user_id?, personalized_vars jsonb, status, error_code?, message_id?, last_update_at with indexes
  - `insurance_quotes`: id, user_id, uploaded_docs[], premium, insurer, status, created_at, approved_at, reviewer_comment with indexes
  - `settings`: key (PK), value jsonb
  - `audit_log`: id, actor_id, action, target_table, target_id, diff jsonb, created_at
- State machines:
  - Voucher: issued -> sent -> redeemed | expired | void
  - Campaign: draft -> running -> paused -> running -> done
  - Campaign target: queued -> sent -> delivered/read | failed
- RLS narratives:
  - Admin: full read/write
  - Ops: read/write campaigns, vouchers, quotes; read stations; limited settings
  - Station: read own stations, redeem via server RPC enforcing single-use
  - Viewer: read-only safe views with masked PII

## Policy Engine
- Evaluation order: opt_out_check -> quiet_hours_check -> throttle_check
- Outcomes: allow (proceed) or block (OPT_OUT, QUIET_HOURS, THROTTLED)
- Settings keys: quiet_hours {start,end,timezone?}, throttle {max_per_minute,burst?}, opt_out_list [msisdn]
- UI feedback: show human-readable reason for blocks
- Auditability: log each decision with inputs and result

## Edge Function Bridges (HTTP only)
- **EF_VOUCHER_PNG:** returns signed PNG URL; degraded UI shows guidance when unavailable
- **EF_WABA_SEND_MEDIA:** sends media via WhatsApp templates; degraded UI disables send with cause
- **EF_CAMPAIGN_DISPATCHER:** start/pause/stop campaigns; degraded UI disables controls with explanation
- Reminder: never create or modify files under `supabase/functions/**` during this work

## Next.js Admin API Routes (server-only)
- `/api/vouchers/preview`: bridge to EF_VOUCHER_PNG, return NOT_CONFIGURED when missing, log request
- `/api/vouchers/generate`: create vouchers transactionally, support idempotency, write audit log
- `/api/vouchers/send`: enforce policy engine, call EF_WABA_SEND_MEDIA on allow, update status/events, emit errors
- `/api/campaigns`: create/update drafts with additive fields and audit log
- `/api/campaigns/import-targets`: validate CSV, upsert targets, dedupe by msisdn
- `/api/campaigns/start|pause|stop`: bridge to EF_CAMPAIGN_DISPATCHER, handle degraded state
- `/api/campaigns/[id]/targets`: paginated server read with filtering
- `/api/insurance/approve`: update status, approved_at, optional voucher enqueue, audit log
- `/api/insurance/request-changes`: update status, reviewer comment, audit log
- `/api/dashboard/kpis`: aggregate timeseries and counters
- `/api/logs`: merge audit_log and voucher_events with filters
- `/api/files/signed-url`: short-TTL signed URL for allowlisted buckets
- `/api/settings`: read/write quiet hours, throttles, templates, Revolut link, feature flags

## Storage Buckets
- Allowlist: `vouchers/`, `qr/`, `campaign-media/`, `docs/`
- Governance: configurable retention, signed URLs with short TTL, optional integrity checks

## UI Pages
- `/dashboard`: KPIs, issued vs redeemed chart, integrations status strip, quick links, AI insights
- `/users`: search by msisdn/name/id, DataTable with filters & CSV, row drawer with profile/vouchers/quotes and RBAC quick actions
- `/insurance`: list by status, review drawer (thumbnails, extracted fields), approve/request changes actions with audit trail
- `/vouchers`: filters (status, date, campaign, station), generate modal (single/batch), preview modal (bridge or degraded), row actions (resend, void/expire)
- `/campaigns`: list view, create wizard, detail counters, targets DataTable, dispatcher controls with degraded UX
- `/stations`: CRUD with geospatial fields, detail anomalies
- `/files`: bucket browser with image preview and signed URL copy
- `/settings`: quiet hours, throttles, opt-out, template catalog, Revolut link, feature flags
- `/logs`: unified stream over audit_log and voucher_events with filters and JSON drawer
- `/integrations-status`: probe dashboard for Edge Function availability

## Core Components
- `DataTable`: virtualized rows, sticky header, mobile card mode, server/query state, selection, CSV export
- `KpiCard`: numeric formatting, delta indicators, reduced-motion fallback
- `TimeSeriesChart`: accessible colors, hover crosshair, range picker
- `CsvUpload`: dropzone, schema preview, column mapping, error buckets
- `TemplatePicker`: select template, bind variables, validate missing vars
- `VoucherCardPreview`: 1080x1920 (720x1280 fallback) gradient/glass design, QR placeholder aligned, expiry/instructions/brand
- `VoucherPreviewModal`: calls `/api/vouchers/preview`, shows PNG or degraded message
- `ConfirmDialog`, `EmptyState`, `ErrorState`, `LoadingState`: unified visuals with i18n

## AI Ops Assistant
- Capabilities: summarize logs, suggest audiences/send windows, generate WhatsApp copy variants, explain policy blocks, flag anomalies
- Interaction: chat-style panel on dashboard & campaigns, explain-before-act with operator approval
- Restrictions: no direct DB writes without confirmation, suggestions logged as `ai_suggestion` with inputs/outputs
- Observability: show confidence, cite data sources without raw PII

## Observability & Quality
- Logs: structured JSON (event, actor_id, request_id, entity, state_from/to, decision, latency_ms)
- Metrics: voucher funnel, campaign throughput, Edge Function latencies, policy block rates
- Alerts: Edge Function failure rate, zero redemptions 24h, campaign stalls, log error spikes
- QA matrices: smoke tests per page/flow (happy, degraded, blocked)
- Accessibility checks: focus order, tab traps, screen-reader labels, reduced motion
- Performance validation: profile initial route, large lists, preview modal, campaigns polling

## Degraded Modes
- Edge Function missing: voucher preview shows "not configured" with guidance; send disabled with tooltip; campaign controls disabled with explanation
- Network slow: skeletal loading states, cancel/retry affordances
- Offline: banner, cached read-only data, block writes with reasons

## Security & Privacy
- RBAC enforced via UI + RLS; station role redeems through server route
- Secrets remain server-side; short TTL signed URLs
- PII masking for MSISDN in logs and non-essential views
- Uploads: content-type allowlist for insurance docs; leverage platform virus scan
- Idempotency: accept `Idempotency-Key` on admin writes and return prior result on conflict

## Acceptance Criteria
- Forbidden paths untouched
- All listed pages implemented with required UX states and RBAC
- Admin API routes validate inputs, enforce policy engine, log decisions
- Voucher preview/send operate with bridges when available, degrade gracefully otherwise
- Campaign lifecycle (draft -> import targets -> dispatcher control) functional
- Insurance approvals/request-changes persist and audit
- Stations CRUD, Files previews, Settings persistence, Logs filters live
- PWA installable with offline fallback and update prompt
- Accessibility basics pass; motion obeys reduced-motion
- AI agent offers suggestions without auto-writes and logs activity

## Deliverables
- Documentation: Admin README (run, env, RBAC, PWA, policies); Admin API reference; Integrations status & degraded behavior guide; UX writing guide; operations runbooks
- Artifacts: design tokens and gradient palette; iconography/illustration guidelines; manifest and service worker config docs
- Test plans: QA matrices, performance budget validation, accessibility checklist

## Execution Phases
1. **Foundation:** Admin shell, navigation, theming, motion primitives, state management, typed data layer, DataTable, KPI, charts
2. **Core Lists & Drawers:** Users, Vouchers, Insurance lists plus drawers with loading/empty/error patterns
3. **Voucher & Campaigns:** Voucher preview bridge UX, generate UI, template management; campaign wizard, targets table, dispatcher controls
4. **Ops Surfaces:** Stations CRUD, Files browser, Settings, Logs, Integrations status, policy engine enforcement
5. **Writes & Idempotency:** Safe admin writes, voucher_events, audit logging
6. **AI Assistant:** Assistant panel UX, suggestion flows, audit trail
7. **PWA & Polish:** Manifest, service worker, install prompts, offline fallbacks, accessibility and performance tuning
8. **Release Readiness:** Documentation, runbooks, QA matrices, degraded mode validation

## Verification Narrative
- Confirm no forbidden paths are modified
- Validate each page on mobile and desktop for motion, gradients, glass, contrast
- Simulate Edge Function presence/absence for preview/send/dispatcher
- Trigger policy blocks and observe UI messaging
- Create draft campaign, import targets, list targets
- Approve insurance quote and inspect audit trail
- Install PWA, test offline reads, observe update prompt
- Use AI assistant to summarize events and propose campaign; ensure no writes without approval

## Fail-Fast Policy
- If a change touches forbidden paths, stop and report "Policy-Blocked" with alternatives
- If an Edge Function is unavailable, surface "not configured" instead of modifying code
- If schema gaps exist, propose new additive migrations via documentation; never revise existing ones

## Glossary
- **EF:** Edge Function
- **DLR:** Delivery Receipt
- **RLS:** Row-Level Security
- **PWA:** Progressive Web App
- **HITL:** Human-in-the-loop
- **WABA:** WhatsApp Business API
