# Data Map & Privacy Documentation

## Overview

This document maps all Personally Identifiable Information (PII) and sensitive data stored in the easyMO platform, along with retention policies, access controls, and privacy safeguards.

## Table of Contents

1. [PII Data Inventory](#pii-data-inventory)
2. [Retention Policies](#retention-policies)
3. [Access Controls](#access-controls)
4. [Data Masking & Anonymization](#data-masking--anonymization)
5. [User Rights (GDPR-lite)](#user-rights-gdpr-lite)
6. [Compliance Checklist](#compliance-checklist)

---

## PII Data Inventory

### User Profiles

**Table**: `profiles`

| Field | Type | PII Level | Purpose | Retention |
|-------|------|-----------|---------|-----------|
| `id` | UUID | Low | User identifier | Permanent |
| `msisdn` | Phone | **High** | User contact | Account lifetime |
| `name` | Text | **High** | User identification | Account lifetime |
| `email` | Email | **High** | Optional contact | Account lifetime |
| `locale` | Text | Low | UI language preference | Account lifetime |
| `role` | Enum | Low | Access level | Account lifetime |
| `vehicle_plate` | Text | **Medium** | Driver identification | Account lifetime |
| `created_at` | Timestamp | Low | Account creation | Permanent |
| `updated_at` | Timestamp | Low | Last update | Permanent |

**Access**:
- RLS: Users can only access own profile
- Admin: Full read access via service role
- API: Authenticated endpoint with rate limiting

---

### User Favorites

**Table**: `user_favorites`

| Field | Type | PII Level | Purpose | Retention |
|-------|------|-----------|---------|-----------|
| `id` | UUID | Low | Record identifier | Account lifetime |
| `user_id` | UUID | Low | Profile reference | Account lifetime |
| `kind` | Enum (`home`,`work`,`school`,`other`) | Low | Classification | Account lifetime |
| `label` | Text | **Medium** | Friendly name ("Home", "School") | Account lifetime |
| `address` | Text | **Medium** | Optional formatted address | Account lifetime |
| `geog` | Geography(Point, 4326) | **High** | Exact latitude/longitude | Account lifetime |
| `is_default` | Boolean | Low | Preferred favorite per kind | Account lifetime |
| `created_at` | Timestamp | Low | Creation time | Permanent |
| `updated_at` | Timestamp | Low | Audit trail | Permanent |

**Access**:
- RLS: authenticated users can `SELECT/INSERT/UPDATE/DELETE` where `user_id = auth.uid()`.
- Service role: unrestricted for support automations.
- Helper indexes: `user_id`, `(user_id, kind)`, GIST on `geog`, unique default per kind.

**Privacy Notes**:
- Coordinates expose sensitive addresses; UI and logs must redact to neighbourhood granularity.
- Retained until passenger account deletion. Cleaned automatically by `supabase/functions/data-retention`.

---

### Driver Parking Locations

**Table**: `driver_parking`

| Field | Type | PII Level | Purpose | Retention |
|-------|------|-----------|---------|-----------|
| `id` | UUID | Low | Record identifier | Account lifetime |
| `driver_id` | UUID | Low | Driver profile reference | Account lifetime |
| `label` | Text | **Medium** | Parking nickname | Account lifetime |
| `geog` | Geography(Point, 4326) | **High** | Standing spot coordinates | 90 days rolling |
| `active` | Boolean | Low | Availability toggle | Account lifetime |
| `created_at` | Timestamp | Low | Creation time | Permanent |
| `updated_at` | Timestamp | Low | Last modification | Permanent |

**Access**:
- RLS: `driver_id = auth.uid()` for authenticated writes/reads.
- Service role: full access to orchestrate dispatch.
- Spatial queries accelerated via GIST index on `geog`.

**Retention**:
- `data-retention` cron archives inactive rows older than 90 days and purges upon account deletion.
- Drivers may deactivate instead of delete to keep historical accuracy.

---

### Driver Availability

**Table**: `driver_availability`

| Field | Type | PII Level | Purpose | Retention |
|-------|------|-----------|---------|-----------|
| `id` | UUID | Low | Record identifier | Account lifetime |
| `driver_id` | UUID | Low | Driver profile reference | Account lifetime |
| `parking_id` | UUID | Low | Optional link to parking spot | Account lifetime |
| `days_of_week` | smallint[] | Low | Recurring weekday mask (0=Sun) | Account lifetime |
| `start_time_local` | Time | Low | Local start time | Account lifetime |
| `end_time_local` | Time | Low | Local end time | Account lifetime |
| `timezone` | Text | Low | Olson timezone identifier | Account lifetime |
| `active` | Boolean | Low | Toggle availability | Account lifetime |
| `created_at` | Timestamp | Low | Creation time | Permanent |
| `updated_at` | Timestamp | Low | Last modification | Permanent |

**Access**:
- RLS: `driver_id = auth.uid()` for CRUD operations.
- Service role: unrestricted to power scheduling automation.
- Indices on `(driver_id)`, `(driver_id, active)`, and GIN on `days_of_week` for planner queries.

**Retention**:
- Managed via the same `data-retention` function when driver accounts are closed.
- Drivers can toggle `active` instead of deletion to preserve scheduling history.

---

### Recurring Trips

**Table**: `recurring_trips`

| Field | Type | PII Level | Purpose | Retention |
|-------|------|-----------|---------|-----------|
| `id` | UUID | Low | Record identifier | Account lifetime |
| `user_id` | UUID | Low | Passenger profile reference | Account lifetime |
| `origin_favorite_id` | UUID | **Medium** | Link to saved origin | Account lifetime |
| `dest_favorite_id` | UUID | **Medium** | Link to saved destination | Account lifetime |
| `days_of_week` | smallint[] | Low | Recurring weekday mask | Account lifetime |
| `time_local` | Time | Low | Departure time | Account lifetime |
| `timezone` | Text | Low | Olson timezone identifier | Account lifetime |
| `radius_km` | Numeric | Low | Matching radius | Account lifetime |
| `active` | Boolean | Low | Toggle schedule | Account lifetime |
| `last_triggered_at` | Timestamp | Low | Last automation run | 12 months |
| `created_at` | Timestamp | Low | Creation time | Permanent |
| `updated_at` | Timestamp | Low | Last modification | Permanent |

**Access**:
- RLS: passengers limited to their own schedules via `user_id = auth.uid()`.
- Service role: unlimited for scheduler job.
- GIN index on `days_of_week` + `(user_id, active)` accelerate matching queries.

**Privacy Notes**:
- Location linkage via favorites inherits the same safeguards—UI only surfaces labels.
- Cleaned when favorites are deleted or on account closure.

---

### Deeplink Tokens

**Table**: `deeplink_tokens`

| Field | Type | PII Level | Purpose | Retention |
|-------|------|-----------|---------|-----------|
| `id` | UUID | Low | Record identifier | 14 days |
| `token` | Text | Low | Short-lived code | 14 days |
| `flow` | Text | Low | Target flow namespace | 14 days |
| `msisdn` | Phone | **High** | Optional binding to passenger | 14 days |
| `max_uses` | Integer | Low | Safety limit | 14 days |
| `remaining_uses` | Integer | Low | Remaining redemptions | 14 days |
| `expires_at` | Timestamp | Low | Hard TTL | 14 days |
| `metadata` | JSONB | Low | Additional context | 14 days |
| `created_by` | UUID | Low | Creator profile | 14 days |
| `created_at` | Timestamp | Low | Creation time | 14 days |
| `updated_at` | Timestamp | Low | Audit trail | 14 days |

**Access**:
- RLS restricts authenticated users to rows where `created_by = auth.uid()`.
- Service role can issue/revoke tokens system-wide.
- Helper view `my_deeplink_events` exposes event history scoped to the owner.

**Retention & Cleanup**:
- `data-retention` cron job deletes expired tokens and associated `deeplink_events` nightly.
- TTL defaults to 7–14 days depending on flow, enforced by application when inserting.

---

### Router Logs

**Table**: `router_logs`

| Field | Type | PII Level | Purpose | Retention |
|-------|------|-----------|---------|-----------|
| `id` | UUID | Low | Record identifier | 90 days |
| `tenant_id` | UUID | **Medium** | Scoped profile/account | 90 days |
| `message_id` | Text | Low | WhatsApp message ID | 90 days |
| `text_snippet` | Text | **Medium** | Sanitised 500-char snippet | 90 days |
| `route_key` | Text | Low | Matched router branch | 90 days |
| `status_code` | Text | Low | Processing status | 90 days |
| `metadata` | JSONB | Low | Diagnostic payload | 90 days |
| `created_at` | Timestamp | Low | Log time | 90 days |
| `expires_at` | Timestamp | Low | Automatic purge date | 90 days |

**Access**:
- RLS: authenticated users may read where `tenant_id = auth.uid()`.
- Service role: read/write for ingestion and analytics.
- Indices on `(tenant_id, message_id)` and `(tenant_id, created_at)` for timeline queries.

**Privacy**:
- Snippets truncated and PII masked at source (MSISDN hashed except last four digits).
- `metadata` must exclude raw payloads; only derived aggregates permitted.

**Retention & Cleanup**:
- `expires_at` pre-computes a 90-day deletion horizon.
- `data-retention` function prunes expired rows nightly to control storage.

---

### WhatsApp Messages

**Table**: `wa_messages` (if stored)

| Field | Type | PII Level | Purpose | Retention |
|-------|------|-----------|---------|-----------|
| `id` | UUID | Low | Record identifier | 30 days |
| `message_id` | Text | Low | WhatsApp message ID | 30 days |
| `from_msisdn` | Phone | **High** | Sender | 30 days |
| `to_msisdn` | Phone | **High** | Recipient | 30 days |
| `message_type` | Enum | Low | Type (text, image, etc.) | 30 days |
| `content` | JSONB | **High** | Message payload | 30 days |
| `created_at` | Timestamp | Low | Sent/received time | 30 days |

**Access**:
- Service role only
- Purpose: Conversation history, compliance

**Retention**:
- Delete after 30 days
- Export on user request
- Purged by `data-retention` cron job

---

## Retention Policies

### Automatic Deletion

Implemented via `supabase/functions/data-retention/index.ts`:

```typescript
// Cron job runs daily at 02:00 UTC
// Deletes expired records based on TTL

await supabase.from("deeplink_tokens")
  .delete()
  .lt("expires_at", new Date().toISOString());

await supabase.from("router_logs")
  .delete()
  .lt("created_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

await supabase.from("wa_messages")
  .delete()
  .lt("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
```

### Retention Schedule

| Data Type | Retention Period | Deletion Method |
|-----------|------------------|-----------------|
| Deeplink tokens | 14 days | Auto-delete by cron |
| Router logs | 90 days | Auto-delete by cron |
| WA messages | 30 days | Auto-delete by cron |
| Driver parking | 90 days | Auto-expire field |
| Driver availability | 180 days | Manual cleanup |
| User favorites | Account lifetime | On account deletion |
| Recurring trips | Account lifetime | On account deletion |
| User profiles | Account lifetime + 1 year | Manual deletion |

---

## Access Controls

### Role-Based Access

| Role | Access Level | Tables |
|------|--------------|--------|
| `anon` | None | None |
| `authenticated` | Own data only | profiles, user_favorites, driver_parking, driver_availability, recurring_trips |
| `service_role` | Full access | All tables |
| `admin` | Read-only (via service role) | All tables via Admin Panel |

### API Endpoints

| Endpoint | Auth Required | Rate Limit | Purpose |
|----------|---------------|------------|---------|
| `/wa-router` | Signature verification | None | WhatsApp webhook |
| `/deeplink-resolver` | None | 10/min per IP | Deep-link resolution |
| `/admin-*` | Admin token | 100/min | Admin operations |
| `/flow-exchange` | Session token | 20/min | Flow execution |

---

## Data Masking & Anonymization

### Log Masking

All logs mask PII using the following rules:

```typescript
function maskMSISDN(msisdn: string): string {
  // Show only last 4 digits: +250788123456 → ****3456
  return msisdn.slice(0, -4).replace(/./g, "*") + msisdn.slice(-4);
}

function maskLocation(geog: { lat: number; lon: number }): string {
  // Show only city/region, not exact coordinates
  return `~${Math.floor(geog.lat)}, ${Math.floor(geog.lon)}`;
}

function maskToken(token: string): string {
  // Show only first/last 2 chars: ABC123XYZ → AB****YZ
  return token.slice(0, 2) + "****" + token.slice(-2);
}
```

### Anonymization

For analytics and testing:

```sql
-- Anonymize user data for analytics export
SELECT
  id,
  'user_' || substring(md5(msisdn), 1, 8) AS anon_id,
  'anon_' || id AS anon_name,
  NULL AS msisdn,
  locale,
  created_at
FROM profiles;
```

---

## User Rights (GDPR-lite)

### Right to Access

Users can request their data via:
1. **Admin Panel**: Self-service export (future)
2. **API Endpoint**: `/api/data-export?user_id={id}`
3. **Support Email**: Manual export by admin

**Export Format**: JSON with all user data.

### Right to Deletion

Users can request account deletion:
1. **In-App**: Settings → Delete Account
2. **WhatsApp**: Send "DELETE MY ACCOUNT"
3. **Support Email**: Manual deletion by admin

**Deletion Process**:
- Soft delete: Mark `deleted_at` timestamp
- Grace period: 30 days (allow undo)
- Hard delete: Purge all data after grace period

**Cascade Delete**:
```sql
-- On user deletion, cascade to related tables
DELETE FROM user_favorites WHERE user_id = :user_id;
DELETE FROM recurring_trips WHERE user_id = :user_id;
DELETE FROM driver_parking WHERE driver_id = :user_id;
DELETE FROM driver_availability WHERE driver_id = :user_id;
-- Finally delete profile
DELETE FROM profiles WHERE id = :user_id;
```

### Right to Rectification

Users can update their data via:
1. **In-App**: Profile settings
2. **WhatsApp**: Send "UPDATE MY {field}"
3. **Admin Panel**: Admin can update on behalf

---

## Compliance Checklist

### Pre-Launch

- [x] PII inventory documented
- [x] Retention policies defined
- [x] RLS policies enabled on all tables
- [x] Logs mask sensitive data
- [ ] Data export endpoint implemented
- [ ] Account deletion flow implemented
- [ ] Privacy policy published

### Ongoing

- [ ] Quarterly data audit
- [ ] Annual privacy policy review
- [ ] Retention policy enforcement monitoring
- [ ] User access request handling (SLA: 7 days)
- [ ] Deletion request handling (SLA: 30 days)

### Regulatory

- [ ] Rwanda Data Protection Law compliance
- [ ] GDPR compliance (if applicable)
- [ ] Consent collection for data processing
- [ ] Third-party data processor agreements (Meta, Twilio, OpenAI)

---

## References

- [Rwanda Data Protection Law](https://risa.rw/data-protection/)
- [GDPR Guidelines](https://gdpr.eu/)
- [WhatsApp Business Data Policies](https://www.whatsapp.com/legal/business-policy)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/platform/security)

---

**Last Updated**: 2025-10-28  
**Owner**: easyMO Privacy & Compliance Team  
**Review Cycle**: Quarterly
