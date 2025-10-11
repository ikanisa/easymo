# Data Model Map

## Core Tables

### `users`

- **Columns:** `id`, `msisdn`, `display_name`, `roles`, `status`, `last_seen_at`
  (`admin-app/lib/data-provider.ts:54-103`).
- **Usage:** Admin lists, voucher issuance lookup, policy opt-out cross-check.
- **Notes:** `roles` drives admin/station/user permissions.

### `vouchers`

- **Columns:** `id`, `user_id`, `station_scope`, `campaign_id`, `amount`,
  `currency`, `code5`, `status`, `issued_at`, `redeemed_at`, `expires_at`,
  `metadata`.
- **State Machine:** `issued → sent → redeemed`; `issued → expired`;
  `issued|sent → void`. Transitions recorded via `voucher_events`
  (`DATA_MODEL_DELTA.md:52-123`).
- **Constraints:** `code5` unique; status enum.

### `voucher_events`

- **Columns:** `voucher_id`, `event_type`, `actor_id`, `station_id`, `context`,
  `created_at`.
- **Purpose:** Immutable audit trail for voucher lifecycle; referenced by Admin
  dashboard (`admin-app/lib/data-provider.ts:567-582`).
- **State Machine Alignment:** Mirrors voucher transitions; includes
  `policy_blocked` for quiet hour/opt-out events.

### `campaigns`

- **Columns:** `id`, `name`, `type`, `template_id`, `status`, `created_by`,
  `started_at`, `finished_at`, `metadata`.
- **State Machine:** `draft → running → paused → running → done`
  (`DATA_MODEL_DELTA.md:83-107`).
- **Usage:** Campaign wizard, dispatcher triggers
  (`admin-app/app/api/campaigns/route.ts:1-170`).

### `campaign_targets`

- **Columns:** `campaign_id`, `msisdn`, `status`, `personalized_vars`,
  `error_code`, `message_id`, `last_update_at`.
- **State Machine:**
  `queued → queued_throttled → queued → sent → delivered|read`;
  `queued → failed|opted_out`.
- **Notes:** Drives per-recipient progress & throttle logic.

### `insurance_quotes`

- **Columns:** `id`, `user_id`, `uploaded_docs`, `premium`, `insurer`, `status`,
  `reviewer_comment`, `approved_at`.
- **State Machine:** `pending → approved`; `pending → needs_changes → pending`
  (`DATA_MODEL_DELTA.md:107-120`).
- **Usage:** Admin insurance drawer (approve/request change).

### `stations`

- **Columns:** `id`, `name`, `engencode`, `owner_contact`, `status`, `location`,
  `updated_at`.
- **State Machine:** `active ↔ inactive`.
- **Usage:** QR generator, station directory sync, Station PWA scope.

### `settings`

- **Columns:** `key`, `value (JSONB)` storing quiet hours, throttles, opt-out
  list, template metadata (`admin-app/app/api/settings/route.ts:1-120`).
- **Usage:** Policy engine (`admin-app/lib/server/policy.ts`).

### `audit_log`

- **Columns:** `id`, `actor_id`, `action`, `target_table`, `target_id`, `diff`,
  `created_at`.
- **Usage:** Admin audit surfaces (`admin-app/app/api/logs/route.ts:1-80`).

## Relational Links

- `vouchers.user_id` → `users.id` (MSISDN owner).
- `vouchers.station_scope` → `stations.id` (restricted redemption locations).
- `voucher_events.voucher_id` → `vouchers.id` (one-to-many).
- `campaign_targets.campaign_id` → `campaigns.id`.
- `campaigns.template_id` ties to template metadata stored in `settings` or
  Supabase storage.
- `insurance_quotes.user_id` → `users.id`.
- `audit_log.target_table` enumerates across vouchers, campaigns, insurance,
  settings, stations.

## State Diagrams

```
VOUCHER: issued -> sent -> redeemed
       \-> expired
       issued|sent -> void
```

```
CAMPAIGN: draft -> running -> paused -> running -> done
```

```
CAMPAIGN_TARGET: queued -> sent -> delivered|read
                   |-> failed
                   |-> opted_out
                   queued -> queued_throttled -> queued
```

```
INSURANCE_QUOTE: pending -> approved
                  pending -> needs_changes -> pending
```

## Validation Notes

- Voucher issuance enforces 5-digit unique codes and writes `voucher_events` on
  each state change (`admin-app/app/api/vouchers/generate/route.ts`,
  `admin-app/app/api/vouchers/send/route.ts`).
- Policy engine references `settings` keys `quiet_hours.rw`,
  `send_throttle.whatsapp.per_minute`, `opt_out.list`
  (`admin-app/lib/server/policy.ts`).
- Station directory integration relies on `stations.status` and `engencode`
  uniqueness for Engen mapping.
