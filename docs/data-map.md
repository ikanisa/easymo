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
| `id` | UUID | Low | Record identifier | Permanent |
| `user_id` | UUID | Low | Profile reference | Account lifetime |
| `label` | Text | **Medium** | Location name (Home, Work) | Account lifetime |
| `location` | Geography | **High** | GPS coordinates | Account lifetime |
| `created_at` | Timestamp | Low | Creation time | Permanent |

**Access**:
- RLS: `user_id = auth.uid()`
- Admin: Read-only via service role
- Purpose: Ride booking shortcuts

**Privacy Notes**:
- Locations reveal home/work addresses
- Masked in logs (show only label, not coordinates)

---

### Driver Parking Locations

**Table**: `driver_parking`

| Field | Type | PII Level | Purpose | Retention |
|-------|------|-----------|---------|-----------|
| `id` | UUID | Low | Record identifier | Permanent |
| `driver_id` | UUID | Low | Profile reference | Account lifetime |
| `location` | Geography | **High** | Current parking spot | 90 days |
| `notes` | Text | Low | Optional description | 90 days |
| `created_at` | Timestamp | Low | Creation time | Permanent |
| `expires_at` | Timestamp | Low | TTL | N/A |

**Access**:
- RLS: `driver_id = auth.uid()`
- Admin: Read-only for matching
- Purpose: Driver-passenger matching

**Retention**:
- Auto-expire after 90 days
- Deleted on driver request
- Purged on account deletion

---

### Driver Availability

**Table**: `driver_availability`

| Field | Type | PII Level | Purpose | Retention |
|-------|------|-----------|---------|-----------|
| `id` | UUID | Low | Record identifier | Permanent |
| `driver_id` | UUID | Low | Profile reference | Account lifetime |
| `available_from` | Timestamp | Low | Schedule start | 180 days |
| `available_to` | Timestamp | Low | Schedule end | 180 days |
| `recurrence` | JSONB | Low | Repeat pattern | 180 days |
| `created_at` | Timestamp | Low | Creation time | Permanent |

**Access**:
- RLS: `driver_id = auth.uid()`
- Admin: Read-only for scheduling
- Purpose: Recurring availability patterns

**Retention**:
- Kept for 180 days after last recurrence
- Deleted on driver request

---

### Recurring Trips

**Table**: `recurring_trips`

| Field | Type | PII Level | Purpose | Retention |
|-------|------|-----------|---------|-----------|
| `id` | UUID | Low | Record identifier | Permanent |
| `user_id` | UUID | Low | Profile reference | Account lifetime |
| `origin` | Geography | **High** | Pickup location | Account lifetime |
| `destination` | Geography | **High** | Dropoff location | Account lifetime |
| `schedule` | JSONB | Low | Recurrence pattern | Account lifetime |
| `is_active` | Boolean | Low | Enabled status | N/A |
| `created_at` | Timestamp | Low | Creation time | Permanent |

**Access**:
- RLS: `user_id = auth.uid()`
- Admin: Read-only for matching
- Purpose: Scheduled ride requests

**Privacy Notes**:
- Origin/destination may reveal home/work
- Masked in logs (city/region only)

---

### Deeplink Tokens

**Table**: `deeplink_tokens`

| Field | Type | PII Level | Purpose | Retention |
|-------|------|-----------|---------|-----------|
| `id` | UUID | Low | Record identifier | 14 days |
| `token` | Text | Low | Short code | 14 days |
| `flow_type` | Enum | Low | Target flow | 14 days |
| `msisdn` | Phone | **High** | Optional binding | 14 days |
| `expires_at` | Timestamp | Low | TTL | N/A |
| `created_at` | Timestamp | Low | Creation time | 14 days |
| `resolved_count` | Integer | Low | Usage count | 14 days |
| `last_resolved_at` | Timestamp | Low | Last use | 14 days |

**Access**:
- No public SELECT policy
- Service role only (issue/resolve operations)
- Purpose: Deep-link flows (insurance, basket, etc.)

**Retention**:
- Hard delete after 14 days
- Purged by `data-retention` cron job

---

### Router Logs

**Table**: `router_logs`

| Field | Type | PII Level | Purpose | Retention |
|-------|------|-----------|---------|-----------|
| `id` | UUID | Low | Record identifier | 90 days |
| `message_id` | Text | Low | WhatsApp message ID | 90 days |
| `text_snippet` | Text | **Medium** | Truncated message (500 chars) | 90 days |
| `route_key` | Text | Low | Matched route | 90 days |
| `status_code` | Text | Low | Processing status | 90 days |
| `metadata` | JSONB | Low | Context data | 90 days |
| `created_at` | Timestamp | Low | Log time | 90 days |

**Access**:
- Service role: Full read/write
- Authenticated: Read-only (for debugging)
- Purpose: Routing audit and analytics

**Privacy**:
- Text snippet truncated to 500 chars
- Never log full messages with sensitive data
- Masked MSISDN in metadata (show last 4 digits only)

**Retention**:
- Auto-delete after 90 days
- Purged by `data-retention` cron job

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
