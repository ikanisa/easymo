# Mobility Data Map & Retention Guide

This document inventories the personally identifiable information (PII) handled by
mobility-oriented Supabase tables, highlights retention commitments, and documents
cleanup automations that enforce the stated policies.

## Contents

1. [PII Inventory](#pii-inventory)
2. [Access Controls](#access-controls)
3. [Retention & Cleanup](#retention--cleanup)
4. [Service Jobs](#service-jobs)

---

## PII Inventory

### `public.user_favorites`

User shortcuts for home/work pickups.

| Column | Type | PII Classification | Notes |
| --- | --- | --- | --- |
| `id` | UUID | Low | Synthetic identifier |
| `user_id` | UUID (FK → `profiles.id`) | Medium | Links to passenger account |
| `kind` | Text enum | Low | `home`, `work`, `school`, `other` |
| `label` | Text | Medium | Friendly name displayed in UI |
| `address` | Text | Medium | Optional user-provided description |
| `geog` | Geography(Point, 4326) | **High** | Exact home/work coordinates |
| `is_default` | Boolean | Low | Whether shortcut is used by default |
| `created_at` / `updated_at` | Timestamptz | Low | Audit metadata |

**PII considerations**

- Coordinates reveal sensitive location data; never expose raw `geog` in logs.
- Labels are limited to 120 characters to reduce accidental leakage.

### `public.driver_parking`

Driver-designated waiting areas used for dispatch matching.

| Column | Type | PII | Notes |
| --- | --- | --- | --- |
| `id` | UUID | Low | Primary key |
| `driver_id` | UUID | Medium | References driver profile |
| `label` | Text | Low | Human readable label |
| `geog` | Geography(Point, 4326) | **High** | Exact standby location |
| `notes` | Text | Low | Optional description |
| `active` | Boolean | Low | Soft toggle |
| `created_at` / `updated_at` | Timestamptz | Low | Audit trail |

### `public.driver_availability`

Weekly recurrence metadata for when a driver is available.

| Column | Type | PII | Notes |
| --- | --- | --- | --- |
| `id` | UUID | Low | Primary key |
| `driver_id` | UUID | Medium | References driver profile |
| `parking_id` | UUID | Medium | Optional FK → `driver_parking` |
| `days_of_week` | `int[]` | Low | Day numbers (`1`=Mon ... `7`=Sun) |
| `start_time_local` / `end_time_local` | `time` | Low | Local window |
| `timezone` | Text | Low | Defaults to `Africa/Kigali` |
| `active` | Boolean | Low | Soft toggle |
| `created_at` / `updated_at` | Timestamptz | Low | Audit trail |

### `public.recurring_trips`

Recurring ride intents leveraging saved favorites.

| Column | Type | PII | Notes |
| --- | --- | --- | --- |
| `id` | UUID | Low | Primary key |
| `user_id` | UUID | Medium | References passenger profile |
| `origin_favorite_id` / `dest_favorite_id` | UUID | **High** | References user favorites (location) |
| `days_of_week` | `int[]` | Low | Execution pattern |
| `time_local` | `time` | Low | Trigger time |
| `timezone` | Text | Low | Local timezone |
| `radius_km` | Numeric | Low | Matching radius |
| `active` | Boolean | Low | Soft toggle |
| `last_triggered_at` | Timestamptz | Low | Scheduler bookkeeping |
| `created_at` / `updated_at` | Timestamptz | Low | Audit trail |

### `public.deeplink_tokens`

Short-lived authentication surrogates powering WhatsApp deeplinks.

| Column | Type | PII | Notes |
| --- | --- | --- | --- |
| `id` | UUID | Low | Primary key |
| `flow` | Text enum | Low | `insurance_attach`, `basket_open`, `generate_qr` |
| `token` | Text | Medium | Signed opaque string |
| `payload` | JSONB | Low | Flow-specific metadata (nonce injected) |
| `msisdn_e164` | Text | **High** | Optional phone binding |
| `expires_at` / `used_at` | Timestamptz | Low | TTL + consumption state |
| `multi_use` | Boolean | Low | Multi-claim tokens for flows like QR |
| `created_by` | UUID | Medium | Optional actor ID for auditing |
| `resolved_count` | Integer | Low | Usage counter |
| `last_resolved_at` | Timestamptz | Low | Last redemption time |
| `metadata` | JSONB | Low | System annotations |
| `created_at` | Timestamptz | Low | Creation timestamp |

### `public.deeplink_events`

Immutable audit trail referencing `deeplink_tokens`.

| Column | Type | PII | Notes |
| --- | --- | --- | --- |
| `id` | UUID | Low | Primary key |
| `token_id` | UUID | Medium | FK → `deeplink_tokens.id` |
| `event` | Text enum | Low | `issued`, `opened`, `expired`, `denied`, `completed` |
| `actor_msisdn` | Text | **High** | Optional phone captured when resolved |
| `meta` | JSONB | Low | Structured event context |
| `created_at` | Timestamptz | Low | Event timestamp |

### `public.router_logs`

Observability ledger for the WhatsApp router. Sensitive snippets are truncated before insert.

| Column | Type | PII | Notes |
| --- | --- | --- | --- |
| `id` | UUID | Low | Primary key |
| `message_id` | Text | Low | WhatsApp message identifier |
| `text_snippet` | Text | Medium | First 500 chars of inbound text |
| `route_key` | Text | Low | Matched handler key |
| `status_code` | Text | Low | e.g. `routed`, `filtered`, `error` |
| `metadata` | JSONB | Low | Parsed routing context (keyword, latency, etc.) |
| `created_at` | Timestamptz | Low | Insert timestamp |

---

## Access Controls

All tables participate in Supabase row-level security (RLS) with forced enforcement:

- **Owner-only mutations**: `user_favorites`, `driver_parking`, `driver_availability`, and
  `recurring_trips` grant `authenticated` users access only when `auth.uid()` matches the
  owning foreign key. Every table also exposes a `service_role` policy for automation.
- **Service role only**: `deeplink_tokens` and `deeplink_events` are fully managed by the
  backend service. Authenticated callers only receive read access to tokens they created.
- **Operational visibility**: `router_logs` permit `service_role` reads/writes and
  authenticated read-only access for support dashboards.

Policies are codified in `infra/supabase/policies/20260214090500_mobility_rls.sql` and
mirrored into Supabase migrations so that `latest_schema.sql` stays authoritative.

---

## Retention & Cleanup

| Dataset | Default Retention | Cleanup Mechanism |
| --- | --- | --- |
| `user_favorites` | Account lifetime | Hard-deleted when passenger profile is removed. |
| `driver_parking` | Account lifetime | Cleared on driver deletion. |
| `driver_availability` | Account lifetime | Scheduler resets windows when a driver is archived. |
| `recurring_trips` | Account lifetime | Scheduler disables (`active = false`) after 90 days of inactivity; removed on user deletion. |
| `deeplink_tokens` | 14 days | Purged by the `data-retention` edge function (see below). |
| `deeplink_events` | 30 days | Same retention worker cascades delete via FK. |
| `router_logs` | 90 days | `data-retention` function prunes records older than policy window. |

The retention guarantees align with privacy commitments documented in
`DATA_MODEL_DELTA.md` and the public privacy notice.

---

## Service Jobs

| Job | Location | Schedule | Responsibilities |
| --- | --- | --- | --- |
| `data-retention` | `supabase/functions/data-retention` | Hourly | Deletes expired deeplink tokens/events, truncates router logs older than 90 days, and prunes other transient artefacts. |
| `recurring-trips-scheduler` | `supabase/functions/recurring-trips-scheduler` | 5 min | Evaluates active `recurring_trips` rows and creates trip intents; respects `active = false` and updates `last_triggered_at`. |
| `availability-refresh` | `supabase/functions/availability-refresh` | Hourly | Syncs driver status back into `driver_availability` when remote systems change.

Each job runs with the Supabase `service_role` key so RLS bypass policies apply where
required. Logs generated by these jobs are retained in `router_logs` for 90 days,
providing end-to-end traceability for privacy audits.

---

**Questions?** Reach out in `#mobility-platform` or consult the retention runbook in
`ROLLBACK_PLAYBOOK.md` for emergency data takedowns.
