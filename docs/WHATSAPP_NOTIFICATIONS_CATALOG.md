# WhatsApp Notification Catalog

Comprehensive catalog of WhatsApp notifications across all EasyMO domains. This document serves as the single source of truth for notification templates, triggers, and implementation guidance.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Template Domains](#template-domains)
- [Core Platform Notifications](#core-platform-notifications)
- [Baskets / SACCOs Notifications](#baskets--saccos-notifications)
- [Orders / Dine-in / Marketplace Notifications](#orders--dine-in--marketplace-notifications)
- [Mobility Notifications](#mobility-notifications)
- [OCR Pipeline Notifications](#ocr-pipeline-notifications)
- [QR / Deep Links Notifications](#qr--deep-links-notifications)
- [Wallet / Payments Notifications](#wallet--payments-notifications)
- [Voice / Calls Notifications](#voice--calls-notifications)
- [Campaigns / Broadcasts Notifications](#campaigns--broadcasts-notifications)
- [Admin / Operational Notifications](#admin--operational-notifications)
- [Flow Interactions Notifications](#flow-interactions-notifications)
- [Implementation Guide](#implementation-guide)
- [Compliance & Policy](#compliance--policy)

## Overview

The EasyMO platform uses a WhatsApp-first notification system that delivers structured, template-based messages across all business domains. All notifications are:

- **Queued centrally**: Single `notifications` table
- **Processed asynchronously**: `notification-worker` edge function (cron + HTTP)
- **Policy-compliant**: Quiet hours, opt-out, rate limiting
- **Observable**: Structured logging per ground rules
- **Retryable**: Exponential backoff with configurable limits

## Architecture

### Data Flow

```
Event Trigger → queueNotification() → notifications table → notification-worker → WhatsApp Cloud API
                                              ↓
                                    contact_preferences (opt-out, quiet hours)
                                              ↓
                                    whatsapp_templates (template catalog)
                                              ↓
                                    notification_audit_log (compliance)
```

### Key Tables

- **notifications**: Outbound message queue with status, retries, correlation IDs
- **whatsapp_templates**: Template catalog with Meta template IDs, domains, locales
- **contact_preferences**: User preferences (quiet hours, locale, opt-out status)
- **notification_audit_log**: Compliance and audit trail

### Helper Functions

- `is_opted_out(wa_id)`: Check if contact has opted out
- `is_in_quiet_hours(wa_id, check_time)`: Check if current time is within quiet hours
- `get_contact_locale(wa_id)`: Get preferred locale with fallback
- `get_template_by_key(key, locale)`: Fetch template with locale fallback
- `calculate_next_retry(retry_count)`: Exponential backoff calculation
- `init_contact_preferences(wa_id)`: Initialize preferences for new contact

## Template Domains

| Domain | Description | Template Count |
|--------|-------------|----------------|
| core | Platform-wide notifications | 5 |
| baskets | SACCO/Ikimina lifecycle | 18 |
| orders | Order and marketplace | 13 |
| mobility | Ride matching and trips | 11 |
| ocr | Document processing | 5 |
| qr | QR codes and deep links | 5 |
| wallet | Payments and transactions | 6 |
| voice | Call notifications | 6 |
| campaigns | Broadcast and drips | 3 |
| admin | Operational alerts | 5 |
| flows | WhatsApp Flows | 4 |
| vendor | Driver/vendor management | 5 |

## Core Platform Notifications

### Welcome Message
- **Template Key**: `tmpl_welcome`
- **Template Name**: `welcome_message`
- **Category**: utility
- **Variables**: `name`
- **Trigger**: New contact/lead created, consent recorded
- **Audience**: New user

### OTP Verification
- **Template Key**: `tmpl_verify_code`
- **Template Name**: `verification_code`
- **Category**: authentication
- **Variables**: `code`, `expires_in`
- **Trigger**: Identity verification step for sensitive actions
- **Audience**: User requiring verification

### Quiet Hours Deferral
- **Template Key**: `tmpl_quiet_hours_deferred`
- **Template Name**: `quiet_hours_notice`
- **Category**: utility
- **Variables**: `resume_time`
- **Trigger**: Message deferred due to quiet hours
- **Audience**: User (informational)

### Preferences Updated
- **Template Key**: `tmpl_preferences_updated`
- **Template Name**: `preferences_confirmation`
- **Category**: utility
- **Variables**: `changes`
- **Trigger**: User updates notification preferences
- **Audience**: User

### Service Incident
- **Template Key**: `tmpl_service_incident`
- **Template Name**: `service_incident_alert`
- **Category**: utility
- **Variables**: `severity`, `message`, `eta`
- **Trigger**: System degradation (rare, policy-compliant)
- **Audience**: Affected users

## Baskets / SACCOs Notifications

### Member Lifecycle

#### Invite to Join
- **Template Key**: `tmpl_baskets_invite`
- **Template Name**: `baskets_invite`
- **Variables**: `basket_name`, `invite_code`, `link`
- **Trigger**: Member shares invite or admin creates invite
- **Audience**: Prospective member

#### Invite Accepted
- **Template Key**: `tmpl_baskets_invite_accepted`
- **Template Name**: `baskets_invite_accepted`
- **Variables**: `member_name`, `basket_name`
- **Trigger**: New member accepts invite
- **Audience**: Inviter and committee

#### Membership Approved
- **Template Key**: `tmpl_baskets_member_approved`
- **Template Name**: `baskets_member_approved`
- **Variables**: `basket_name`
- **Trigger**: Committee approves membership
- **Audience**: New member

### Contributions

#### Due in 3 Days
- **Template Key**: `tmpl_baskets_due_in_3`
- **Template Name**: `baskets_contribution_due_soon`
- **Variables**: `basket_name`, `amount`, `due_date`
- **Trigger**: Scheduled job, 3 days before due date
- **Audience**: Member

#### Due Today
- **Template Key**: `tmpl_baskets_due_today`
- **Template Name**: `baskets_contribution_due_today`
- **Variables**: `basket_name`, `amount`
- **Trigger**: Scheduled job, on due date
- **Audience**: Member

#### Overdue
- **Template Key**: `tmpl_baskets_overdue`
- **Template Name**: `baskets_contribution_overdue`
- **Variables**: `basket_name`, `amount`, `days_overdue`
- **Trigger**: Scheduled job, after due date
- **Audience**: Member

#### Payment Received
- **Template Key**: `tmpl_baskets_payment_received`
- **Template Name**: `baskets_payment_confirmed`
- **Variables**: `basket_name`, `amount`, `balance`
- **Trigger**: MoMo payment matched and confirmed
- **Audience**: Member

#### Payment Failed
- **Template Key**: `tmpl_baskets_payment_failed`
- **Template Name**: `baskets_payment_failed`
- **Variables**: `basket_name`, `amount`, `reason`
- **Trigger**: Payment reversal or failure detected
- **Audience**: Member

### Loans

#### Loan Request Submitted
- **Template Key**: `tmpl_baskets_loan_submitted`
- **Template Name**: `baskets_loan_request`
- **Variables**: `basket_name`, `amount`
- **Trigger**: Member submits loan request
- **Audience**: Member (confirmation)

#### Loan Status Update
- **Template Key**: `tmpl_baskets_loan_status`
- **Template Name**: `baskets_loan_status_update`
- **Variables**: `basket_name`, `status`, `amount`
- **Trigger**: Committee approves/rejects loan
- **Audience**: Member

#### Committee Review Prompt
- **Template Key**: `tmpl_baskets_loan_committee`
- **Template Name**: `baskets_committee_review`
- **Variables**: `member_name`, `amount`, `basket_name`
- **Trigger**: Loan request needs committee action
- **Audience**: Committee members

#### Loan Disbursed
- **Template Key**: `tmpl_baskets_loan_disbursed`
- **Template Name**: `baskets_loan_disbursed`
- **Variables**: `amount`, `account`
- **Trigger**: Loan funds transferred
- **Audience**: Member

#### Repayment Due Soon (3 days)
- **Template Key**: `tmpl_baskets_repay_due_in_3`
- **Template Name**: `baskets_repayment_due_soon`
- **Variables**: `amount`, `due_date`
- **Trigger**: Scheduled job
- **Audience**: Member with active loan

#### Repayment Due Today
- **Template Key**: `tmpl_baskets_repay_due_today`
- **Template Name**: `baskets_repayment_due_today`
- **Variables**: `amount`
- **Trigger**: Scheduled job
- **Audience**: Member with active loan

#### Repayment Overdue
- **Template Key**: `tmpl_baskets_repay_overdue`
- **Template Name**: `baskets_repayment_overdue`
- **Variables**: `amount`, `days_overdue`
- **Trigger**: Scheduled job
- **Audience**: Member with overdue loan

### Governance

#### Basket Closure Notice
- **Template Key**: `tmpl_baskets_close_notice`
- **Template Name**: `baskets_closure_notice`
- **Variables**: `basket_name`, `reason`
- **Trigger**: Committee initiates basket closure
- **Audience**: All members

#### Meeting Announcement
- **Template Key**: `tmpl_baskets_meeting_notice`
- **Template Name**: `baskets_meeting_announcement`
- **Variables**: `basket_name`, `date`, `agenda`
- **Trigger**: Committee schedules meeting
- **Audience**: All members

#### Decision Summary
- **Template Key**: `tmpl_baskets_resolution`
- **Template Name**: `baskets_decision_summary`
- **Variables**: `basket_name`, `decision`
- **Trigger**: After meeting or committee vote
- **Audience**: All members

## Orders / Dine-in / Marketplace Notifications

### Vendor Notifications

#### Order Created
- **Template Key**: `tmpl_order_created_vendor`
- **Template Name**: `order_created_vendor`
- **Variables**: `order_code`, `table_label`, `total_formatted`
- **Trigger**: Customer places order
- **Audience**: Vendor/bar owner

#### Order Pending Reminder
- **Template Key**: `tmpl_order_pending_vendor`
- **Template Name**: `order_pending_vendor`
- **Variables**: `order_code`, `age_minutes`
- **Trigger**: Scheduled job for aged pending orders
- **Audience**: Vendor

#### Low Inventory
- **Template Key**: `tmpl_vendor_inventory_low`
- **Template Name**: `vendor_inventory_low`
- **Variables**: `item_name`, `quantity`
- **Trigger**: Inventory drops below threshold
- **Audience**: Vendor

#### Action Required
- **Template Key**: `tmpl_vendor_action_required`
- **Template Name**: `vendor_action_required`
- **Variables**: `action`, `details`
- **Trigger**: Various vendor actions needed
- **Audience**: Vendor

### Customer Notifications

#### Order Paid
- **Template Key**: `tmpl_order_paid_customer`
- **Template Name**: `order_paid_customer`
- **Variables**: `order_code`, `bar_name`
- **Trigger**: Vendor marks order as paid
- **Audience**: Customer

#### Order Served
- **Template Key**: `tmpl_order_served_customer`
- **Template Name**: `order_served_customer`
- **Variables**: `order_code`, `table_label`
- **Trigger**: Vendor marks order as served
- **Audience**: Customer

#### Order Cancelled
- **Template Key**: `tmpl_order_cancelled_customer`
- **Template Name**: `order_cancelled_customer`
- **Variables**: `order_code`, `reason`
- **Trigger**: Vendor or admin cancels order
- **Audience**: Customer

#### Order Accepted
- **Template Key**: `tmpl_order_accepted_vendor`
- **Template Name**: `order_accepted_to_customer`
- **Variables**: `order_code`, `estimated_time`
- **Trigger**: Vendor confirms order
- **Audience**: Customer

#### Order Ready
- **Template Key**: `tmpl_order_ready`
- **Template Name**: `order_ready_pickup`
- **Variables**: `order_code`
- **Trigger**: Vendor marks order ready
- **Audience**: Customer

#### Delivery ETA
- **Template Key**: `tmpl_order_delivery_eta`
- **Template Name**: `order_delivery_eta`
- **Variables**: `order_code`, `eta`, `driver_name`
- **Trigger**: Delivery assigned with ETA
- **Audience**: Customer

#### Refund Processed
- **Template Key**: `tmpl_order_refund_processed`
- **Template Name**: `order_refund_processed`
- **Variables**: `order_code`, `amount`
- **Trigger**: Refund completed
- **Audience**: Customer

#### Receipt Link
- **Template Key**: `tmpl_order_receipt_url`
- **Template Name**: `order_receipt_link`
- **Variables**: `order_code`, `receipt_url`
- **Trigger**: Order completed
- **Audience**: Customer

#### Cart Reminder
- **Template Key**: `tmpl_cart_reminder_customer`
- **Template Name**: `cart_reminder_customer`
- **Variables**: `bar_name`, `items_count`
- **Trigger**: Scheduled job for stale carts
- **Audience**: Customer with abandoned cart

## Mobility Notifications

### Buyer/Customer Notifications

#### Search Initiated
- **Template Key**: `tmpl_search_initiated`
- **Template Name**: `search_initiated`
- **Variables**: none
- **Trigger**: User initiates ride search
- **Audience**: Customer

#### Match Found
- **Template Key**: `tmpl_ride_match_found`
- **Template Name**: `ride_match_found`
- **Variables**: `driver_name`, `vehicle`, `eta`
- **Trigger**: Driver matched to ride request
- **Audience**: Customer

#### No Match
- **Template Key**: `tmpl_ride_no_match`
- **Template Name**: `ride_no_match`
- **Variables**: `tips`
- **Trigger**: No drivers available
- **Audience**: Customer

#### Ride Scheduled
- **Template Key**: `tmpl_ride_scheduled`
- **Template Name**: `ride_scheduled`
- **Variables**: `date`, `time`, `pickup`
- **Trigger**: Future ride scheduled
- **Audience**: Customer

#### Ride Reminder
- **Template Key**: `tmpl_ride_reminder`
- **Template Name**: `ride_reminder`
- **Variables**: `time`, `pickup`
- **Trigger**: T-30 or T-10 minutes before ride
- **Audience**: Customer

#### Driver Arrived
- **Template Key**: `tmpl_driver_arrived`
- **Template Name**: `driver_arrived`
- **Variables**: `driver_name`, `vehicle`
- **Trigger**: Driver reaches pickup location
- **Audience**: Customer

#### Schedule Updated
- **Template Key**: `tmpl_ride_updated`
- **Template Name**: `ride_schedule_updated`
- **Variables**: `old_time`, `new_time`
- **Trigger**: Ride time/date changed
- **Audience**: Customer

#### Ride Cancelled
- **Template Key**: `tmpl_ride_cancelled`
- **Template Name**: `ride_cancelled`
- **Variables**: `cancelled_by`, `reason`
- **Trigger**: Ride cancelled by driver or customer
- **Audience**: Customer or Driver

#### Ride Receipt
- **Template Key**: `tmpl_ride_receipt`
- **Template Name**: `ride_receipt`
- **Variables**: `fare`, `distance`, `duration`
- **Trigger**: Trip completed
- **Audience**: Customer

#### Rate Trip
- **Template Key**: `tmpl_rate_trip`
- **Template Name**: `rate_trip_request`
- **Variables**: `driver_name`, `trip_id`
- **Trigger**: Trip completed
- **Audience**: Customer

### Vendor/Driver Notifications

#### Account Approved
- **Template Key**: `tmpl_vendor_account_approved`
- **Template Name**: `vendor_account_activated`
- **Variables**: none
- **Trigger**: Admin approves driver account
- **Audience**: Driver

#### Ride Request Received
- **Template Key**: `tmpl_ride_request_received`
- **Template Name**: `ride_request_received`
- **Variables**: `pickup`, `destination`
- **Trigger**: New ride request matched
- **Audience**: Driver

#### Ride Request Missed
- **Template Key**: `tmpl_ride_request_missed`
- **Template Name**: `ride_request_missed`
- **Variables**: none
- **Trigger**: Driver didn't respond in time
- **Audience**: Driver

#### Rating Received
- **Template Key**: `tmpl_rating_received`
- **Template Name**: `new_rating_received`
- **Variables**: `rating`, `comment`
- **Trigger**: Customer rates driver
- **Audience**: Driver

#### Weekly Performance
- **Template Key**: `tmpl_weekly_performance`
- **Template Name**: `weekly_performance_report`
- **Variables**: `trips`, `rating`, `acceptance_rate`
- **Trigger**: Scheduled weekly job
- **Audience**: Driver

## OCR Pipeline Notifications

#### Upload Received
- **Template Key**: `tmpl_ocr_upload_received`
- **Template Name**: `ocr_upload_received`
- **Variables**: `document_type`
- **Trigger**: Document uploaded
- **Audience**: User

#### Processing Started
- **Template Key**: `tmpl_ocr_started`
- **Template Name**: `ocr_processing_started`
- **Variables**: `document_type`
- **Trigger**: OCR job started
- **Audience**: User

#### Processing Complete
- **Template Key**: `tmpl_ocr_complete`
- **Template Name**: `ocr_processing_complete`
- **Variables**: `document_type`, `summary`
- **Trigger**: OCR completed successfully
- **Audience**: User

#### Processing Failed
- **Template Key**: `tmpl_ocr_failed_retry`
- **Template Name**: `ocr_failed_retry`
- **Variables**: `document_type`, `retry_link`
- **Trigger**: OCR failed with recoverable error
- **Audience**: User

#### Manual Review Required
- **Template Key**: `tmpl_ocr_manual_review`
- **Template Name**: `ocr_manual_review`
- **Variables**: `document_type`, `reason`
- **Trigger**: OCR needs human review
- **Audience**: User

## QR / Deep Links Notifications

#### QR Created
- **Template Key**: `tmpl_qr_created`
- **Template Name**: `qr_created`
- **Variables**: `purpose`, `qr_link`
- **Trigger**: QR code generated
- **Audience**: User

#### QR Scanned
- **Template Key**: `tmpl_qr_scanned_info`
- **Template Name**: `qr_scanned`
- **Variables**: `scanned_by`
- **Trigger**: QR code scanned (non-consuming)
- **Audience**: QR owner

#### QR Consumed
- **Template Key**: `tmpl_qr_consumed`
- **Template Name**: `qr_consumed`
- **Variables**: `action`
- **Trigger**: QR code redeemed/used
- **Audience**: QR owner

#### QR Invalid
- **Template Key**: `tmpl_qr_invalid`
- **Template Name**: `qr_invalid`
- **Variables**: `reason`
- **Trigger**: Invalid/expired QR scan
- **Audience**: Scanner

#### Deep Link Follow-up
- **Template Key**: `tmpl_deeplink_followup`
- **Template Name**: `deeplink_followup`
- **Variables**: `action`
- **Trigger**: Deep link resolved
- **Audience**: User

## Wallet / Payments Notifications

#### Payment Request
- **Template Key**: `tmpl_payment_request`
- **Template Name**: `payment_request`
- **Variables**: `amount`, `payment_link`
- **Trigger**: Payment request generated
- **Audience**: Payer

#### Payment Received
- **Template Key**: `tmpl_payment_received`
- **Template Name**: `payment_received`
- **Variables**: `amount`, `balance`
- **Trigger**: Payment confirmed
- **Audience**: User

#### Payment Failed
- **Template Key**: `tmpl_payment_failed`
- **Template Name**: `payment_failed`
- **Variables**: `amount`, `reason`
- **Trigger**: Payment failure
- **Audience**: User

#### Refund Processed
- **Template Key**: `tmpl_refund_processed`
- **Template Name**: `refund_processed`
- **Variables**: `amount`, `reason`
- **Trigger**: Refund completed
- **Audience**: User

#### Low Balance
- **Template Key**: `tmpl_wallet_low_balance`
- **Template Name**: `wallet_low_balance`
- **Variables**: `balance`, `topup_link`
- **Trigger**: Balance below threshold
- **Audience**: User

#### Wallet Topped Up
- **Template Key**: `tmpl_wallet_topped_up`
- **Template Name**: `wallet_topped_up`
- **Variables**: `amount`, `new_balance`
- **Trigger**: Top-up successful
- **Audience**: User

#### Statement Ready
- **Template Key**: `tmpl_wallet_statement_ready`
- **Template Name**: `wallet_statement_ready`
- **Variables**: `period`, `statement_link`
- **Trigger**: Monthly statement generated
- **Audience**: User

## Voice / Calls Notifications

#### Missed Call Follow-up
- **Template Key**: `tmpl_call_missed_followup`
- **Template Name**: `call_missed_followup`
- **Variables**: `caller`, `options`
- **Trigger**: Missed call detected
- **Audience**: User

#### Voicemail Transcript
- **Template Key**: `tmpl_call_transcript`
- **Template Name**: `call_transcript`
- **Variables**: `caller`, `transcript`
- **Trigger**: Voicemail transcription complete
- **Audience**: User

#### Call Summary
- **Template Key**: `tmpl_call_summary`
- **Template Name**: `call_summary`
- **Variables**: `duration`, `summary`
- **Trigger**: Call completed
- **Audience**: User

#### Callback Scheduled
- **Template Key**: `tmpl_callback_scheduled`
- **Template Name**: `callback_scheduled`
- **Variables**: `time`, `agent`
- **Trigger**: Callback appointment set
- **Audience**: User

#### Callback Reminder
- **Template Key**: `tmpl_callback_reminder`
- **Template Name**: `callback_reminder`
- **Variables**: `time`
- **Trigger**: Before scheduled callback
- **Audience**: User

#### Call Consent
- **Template Key**: `tmpl_call_consent_confirmed`
- **Template Name**: `call_consent`
- **Variables**: `purpose`
- **Trigger**: User consents to call
- **Audience**: User

## Campaigns / Broadcasts Notifications

#### Campaign Dispatch Receipt
- **Template Key**: `tmpl_campaign_dispatch_receipt`
- **Template Name**: `campaign_dispatch_receipt`
- **Variables**: `campaign_name`, `recipients_count`
- **Trigger**: Campaign sent
- **Audience**: Admin/operator

#### Campaign Dispatch Failed
- **Template Key**: `tmpl_campaign_dispatch_failed`
- **Template Name**: `campaign_dispatch_failed`
- **Variables**: `campaign_name`, `error`
- **Trigger**: Campaign error
- **Audience**: Admin/operator

#### Drip Sequence
- **Template Key**: `tmpl_drip_n`
- **Template Name**: `drip_sequence`
- **Variables**: `sequence_num`, `content`
- **Trigger**: Scheduled drip campaign
- **Audience**: Subscribers

## Admin / Operational Notifications

#### Webhook Error
- **Template Key**: `tmpl_webhook_error_notice`
- **Template Name**: `webhook_error_alert`
- **Variables**: `endpoint`, `error`, `count`
- **Trigger**: Webhook failures detected
- **Audience**: On-call staff

#### Outbox Failure Spike
- **Template Key**: `tmpl_outbox_failure_spike`
- **Template Name**: `outbox_failure_spike`
- **Variables**: `failure_rate`, `period`
- **Trigger**: High failure rate threshold
- **Audience**: On-call staff

#### Template Status Changed
- **Template Key**: `tmpl_template_status_changed`
- **Template Name**: `template_status_changed`
- **Variables**: `template_name`, `old_status`, `new_status`
- **Trigger**: Meta template approval change
- **Audience**: Admin team

#### Quiet Hours Changed
- **Template Key**: `tmpl_quiet_hours_changed`
- **Template Name**: `quiet_hours_changed`
- **Variables**: `old_hours`, `new_hours`
- **Trigger**: Admin updates quiet hours policy
- **Audience**: Admin team

#### Data Anomaly
- **Template Key**: `tmpl_data_anomaly_alert`
- **Template Name**: `data_anomaly_alert`
- **Variables**: `anomaly_type`, `details`
- **Trigger**: Unusual patterns detected
- **Audience**: On-call staff

#### Service Down
- **Template Key**: `tmpl_service_down`
- **Template Name**: `service_down_alert`
- **Variables**: `service_name`, `details`
- **Trigger**: Service health check fails
- **Audience**: On-call staff

## Flow Interactions Notifications

#### Flow Continue Reminder
- **Template Key**: `tmpl_flow_continue`
- **Template Name**: `flow_continue_reminder`
- **Variables**: `flow_name`, `link`
- **Trigger**: Incomplete flow timeout
- **Audience**: User

#### Flow Result
- **Template Key**: `tmpl_flow_result`
- **Template Name**: `flow_result_confirmation`
- **Variables**: `flow_name`, `result`
- **Trigger**: Flow completed
- **Audience**: User

#### Admin Task Assigned
- **Template Key**: `tmpl_admin_task_assigned`
- **Template Name**: `admin_task_assigned`
- **Variables**: `task_type`, `assignee`
- **Trigger**: Flow creates admin task
- **Audience**: Admin

#### Admin Task Closed
- **Template Key**: `tmpl_admin_task_closed`
- **Template Name**: `admin_task_closed`
- **Variables**: `task_type`, `result`
- **Trigger**: Admin completes task
- **Audience**: Admin/requestor

## Implementation Guide

### Queue a Notification

```typescript
import { queueNotification } from "../wa-webhook/notify/sender.ts";

// Queue a simple template notification
await queueNotification({
  to: "+250788123456",
  template: {
    name: "baskets_payment_confirmed",
    language: "en",
    components: [
      {
        type: "body",
        parameters: [
          { type: "text", text: "Amahoro SACCO" },
          { type: "text", text: "5,000 RWF" },
          { type: "text", text: "25,000 RWF" }
        ]
      }
    ]
  }
}, {
  type: "baskets_payment_received",
  domain: "baskets",
  correlation_id: "contrib_123_payment",
  delaySeconds: 0
});
```

### Queue with Quiet Hours Override

```typescript
await queueNotification({
  to: contact.wa_id,
  template: emergencyTemplate
}, {
  type: "emergency_alert",
  domain: "core",
  quiet_hours_override: true,  // Critical incident
  correlation_id: `incident_${incidentId}`
});
```

### Check Notification Status

```typescript
const { data } = await supabase
  .from("notifications")
  .select("status, sent_at, error_message, retry_count")
  .eq("correlation_id", "order_123_created")
  .single();
```

### Initialize Contact Preferences

```typescript
await supabase.rpc("init_contact_preferences", {
  p_wa_id: "+250788123456",
  p_profile_id: userId,
  p_locale: "rw"  // Kinyarwanda
});
```

### Mark Contact as Opted Out

```typescript
await supabase.rpc("mark_opted_out", {
  p_wa_id: "+250788123456",
  p_reason: "user_request"
});
```

## Compliance & Policy

### Meta 2026 Policy Requirements

All templates must be:
- **Purpose-bound**: Categorized correctly (utility/authentication/marketing)
- **Consent-driven**: Users must opt-in for marketing messages
- **Compliant with content policy**: No prohibited content

### Opt-Out Enforcement

- Detect "STOP", "UNSUBSCRIBE", etc. in user messages
- Immediately suppress all non-critical notifications
- Support opt-back-in with explicit consent

### Quiet Hours

- Default: 22:00 - 07:00 local time
- User-configurable per contact
- Override available for critical alerts only (with audit)

### Rate Limiting

- Per-contact: 20 messages per hour
- Per-tenant: Configurable limit
- Backoff on Meta rate limit errors (131047)

### PII Protection

- Mask WhatsApp IDs in logs: `+25078...56`
- Never log sensitive template variables
- Audit all opt-out actions

### Internationalization

- Support locales: `en`, `fr`, `sw`, `rw`
- Fallback chain: requested → `en`
- Store preferred locale in `contact_preferences`

## Monitoring & Observability

### Key Metrics

- `notification_queue_depth`: Current queued notifications
- `notification_worker_processed_total`: Notifications processed per run
- `notification_worker_failures_total`: Worker failures
- `notification_filtered_optout`: Blocked due to opt-out
- `notification_filtered_quiet_hours`: Deferred to quiet hours
- `notification_filtered_rate_limit`: Blocked by rate limit

### Structured Events

- `NOTIFY_QUEUE`: Notification queued
- `NOTIFY_SEND_OK`: Notification sent successfully
- `NOTIFY_SEND_FAIL`: Notification failed
- `NOTIFY_BLOCKED_OPTOUT`: Blocked (opted out)
- `NOTIFY_DEFERRED_QUIET_HOURS`: Deferred (quiet hours)
- `NOTIFY_WORKER_START`: Worker run started
- `NOTIFY_WORKER_DONE`: Worker run completed

### Alerts

- High failure rate (>20%)
- Queue depth exceeds threshold (>1000)
- Worker not running for >5 minutes
- Meta rate limit hit repeatedly

## Meta Template Management

### Template Approval Workflow

1. Create template in Meta Business Manager
2. Submit for approval (24-48h review)
3. Once approved, add to `whatsapp_templates` table
4. Set `approval_status = 'approved'`, `is_active = true`
5. Update `meta_template_id` with Meta's ID

### Template Sync

Periodically sync Meta template status:

```typescript
// Future: admin endpoint to sync template approval status
POST /api/admin/templates/sync
```

### Sandbox Testing

Use test numbers defined in env:

```bash
TEST_CUSTOMER_WA_ID=+250788999001
TEST_VENDOR_WA_ID=+250788999002
```

Send test notifications through admin UI or API.

## Troubleshooting

### Notification Stuck in Queue

Check:
1. `next_attempt_at` - may be scheduled for future
2. `retry_count` vs `MAX_RETRIES` - may have exceeded retries
3. Opt-out status - use `is_opted_out(wa_id)`
4. Quiet hours - use `is_in_quiet_hours(wa_id)`

### High Failure Rate

Check:
1. WhatsApp API credentials valid
2. Template approved in Meta
3. Meta error codes in `notification_audit_log`
4. Rate limits not exceeded

### Notifications Not Sending

Check:
1. `notification-worker` cron enabled: `NOTIFICATION_WORKER_CRON_ENABLED=true`
2. Worker running: Check logs for `NOTIFY_WORKER_START`
3. Network connectivity to Meta API
4. RLS policies allow service role access

## References

- [WHATSAPP_FLOWS.md](./WHATSAPP_FLOWS.md) - Baskets flows and intents
- [NOTIFICATION_PIPELINE_PLAN.md](./NOTIFICATION_PIPELINE_PLAN.md) - Architecture
- [GROUND_RULES.md](./GROUND_RULES.md) - Observability requirements
- [admin-app/lib/server/whatsapp.ts](../admin-app/lib/server/whatsapp.ts) - Admin sender
- [supabase/functions/notification-worker](../supabase/functions/notification-worker/) - Worker implementation
