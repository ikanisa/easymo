# Production Readiness Validation & Testing Plan

## Overview
This document outlines the comprehensive testing and validation procedures for all implemented production readiness fixes.

## Test Environment Setup

### Prerequisites
- Supabase project with all migrations applied
- Environment variables configured
- Test user accounts created
- Test data populated

### Environment Variables Checklist
```bash
# WhatsApp
WA_PHONE_ID=your_phone_id
WA_ACCESS_TOKEN=your_access_token

# Payment Providers
MTN_MOMO_API_KEY=your_momo_key
REVOLUT_API_KEY=your_revolut_key

# Google Services
GOOGLE_MAPS_API_KEY=your_maps_key

# SMS Provider
MTN_SMS_API_KEY=your_sms_key
MTN_SMS_API_SECRET=your_sms_secret
MTN_SMS_SENDER_ID=easyMO

# Error Tracking
SENTRY_DSN=your_sentry_dsn
RELEASE_VERSION=1.0.0

# PWA Push
VAPID_PUBLIC_KEY=your_vapid_public
VAPID_PRIVATE_KEY=your_vapid_private
VAPID_SUBJECT=mailto:admin@easymo.rw
```

---

## Phase 1: Payment Notifications

### Test Cases

#### TC1.1: MoMo Payment Success Notification
**Steps:**
1. Create test order via waiter app
2. Initiate MoMo payment
3. Simulate successful payment callback
4. Verify WhatsApp notification sent to customer

**Expected Result:**
- ✅ Notification message includes: amount, currency, order ID
- ✅ Message format: "✅ Payment Successful! Your payment of X RWF..."
- ✅ Event logged: `MOMO_NOTIFICATION_SENT`

**Validation:**
```sql
SELECT * FROM whatsapp_messages 
WHERE direction = 'outbound' 
AND body LIKE '%Payment Successful%'
ORDER BY created_at DESC LIMIT 1;
```

#### TC1.2: MoMo Payment Failure Notification
**Steps:**
1. Create test order
2. Simulate failed payment callback
3. Verify failure notification sent

**Expected Result:**
- ✅ Notification includes failure reason
- ✅ Message format: "❌ Payment Failed..."
- ✅ Event logged: `MOMO_NOTIFICATION_SENT`

#### TC1.3: Revolut Payment Notification
**Steps:**
1. Create test order
2. Simulate Revolut ORDER_COMPLETED event
3. Verify notification sent

**Expected Result:**
- ✅ Similar to MoMo success notification
- ✅ Event logged: `REVOLUT_NOTIFICATION_SENT`

#### TC1.4: Notification Failure Handling
**Steps:**
1. Temporarily disable WhatsApp API
2. Trigger payment callback
3. Verify payment still processes successfully

**Expected Result:**
- ✅ Payment marked as successful
- ✅ Event logged: `MOMO_NOTIFICATION_FAILED` (warning level)
- ✅ Webhook returns 200 OK

---

## Phase 2: AI Agent Tools

### Test Cases

#### TC2.1: Jobs Matching
**Steps:**
1. Create test job posts in database
2. Send WhatsApp message: "Find software jobs in Kigali"
3. Verify matches created

**Expected Result:**
- ✅ Job search executed with correct parameters
- ✅ Match events created in `ai_agent_match_events`
- ✅ Event logged: `JOBS_MATCHES_CREATED`

**Validation:**
```sql
SELECT * FROM ai_agent_match_events 
WHERE match_type = 'job' 
AND user_id = 'test_user_id'
ORDER BY created_at DESC;
```

#### TC2.2: Property Matching
**Steps:**
1. Create test properties
2. Send: "Find 2 bedroom apartment in Kimihurura"
3. Verify matches with distance calculation

**Expected Result:**
- ✅ Properties filtered by bedrooms and location
- ✅ Distance calculated if user location available
- ✅ Match scores assigned
- ✅ Event logged: `PROPERTY_MATCHES_CREATED`

#### TC2.3: Rides Matching
**Steps:**
1. Set driver status to online
2. Create ride request with coordinates
3. Verify driver matches created

**Expected Result:**
- ✅ Nearby drivers found (within 10km)
- ✅ ETA calculated for each driver
- ✅ Drivers sorted by match score
- ✅ Event logged: `DRIVER_MATCHES_CREATED`

#### TC2.4: Insurance Quote Request
**Steps:**
1. Send: "I need insurance quote for my car"
2. Provide vehicle details
3. Verify quote request created

**Expected Result:**
- ✅ Record inserted in `insurance_quote_requests`
- ✅ Status set to "pending"
- ✅ Event logged: `INSURANCE_QUOTE_CREATED`

---

## Phase 3: Notification System

### Test Cases

#### TC3.1: SMS Notification
**Steps:**
1. Trigger notification with channel: "sms"
2. Provide valid Rwanda phone number
3. Verify SMS sent

**Expected Result:**
- ✅ Phone number validated and normalized
- ✅ SMS sent via MTN provider
- ✅ Event logged: `SMS_SENT`
- ✅ Message ID returned

#### TC3.2: SMS Retry Logic
**Steps:**
1. Simulate MTN API failure
2. Verify retry attempts (max 3)
3. Check exponential backoff

**Expected Result:**
- ✅ 3 retry attempts made
- ✅ Delays: 1s, 2s, 4s
- ✅ Final error logged if all fail

#### TC3.3: Invalid Phone Number
**Steps:**
1. Send SMS to invalid number
2. Verify validation error

**Expected Result:**
- ✅ Error returned immediately
- ✅ No retry attempts
- ✅ Clear error message

---

## Phase 4: Wallet Cashout

### Test Cases

#### TC4.1: Admin Notification on Cashout
**Steps:**
1. User requests cashout
2. Verify admin WhatsApp notification sent
3. Check database notification created

**Expected Result:**
- ✅ WhatsApp sent to all admins with `receive_cashout_notifications = true`
- ✅ Message includes: reference, amount, mobile money number
- ✅ Database notification created in `admin_notifications`
- ✅ Event logged: `WALLET_CASHOUT_ADMIN_NOTIFIED`

**Validation:**
```sql
SELECT * FROM admin_notifications 
WHERE type = 'cashout_request' 
AND read = false
ORDER BY created_at DESC;
```

#### TC4.2: Admin Processing Cashout
**Steps:**
1. Admin calls `process_wallet_cashout` function
2. Provide status: "completed"
3. Verify cashout updated

**Expected Result:**
- ✅ Status updated to "completed"
- ✅ `admin_processed_by` set to admin ID
- ✅ `admin_processed_at` timestamp set
- ✅ Admin notes saved

#### TC4.3: Notification Failure Handling
**Steps:**
1. Remove all admin phone numbers
2. Request cashout
3. Verify fallback to database

**Expected Result:**
- ✅ Cashout still created successfully
- ✅ Database notification created
- ✅ Warning logged: "No admins configured"

---

## Phase 5: Error Tracking

### Test Cases

#### TC5.1: Error Capture
**Steps:**
1. Trigger intentional error in webhook
2. Check Sentry dashboard
3. Verify error context

**Expected Result:**
- ✅ Error appears in Sentry within 1 minute
- ✅ Includes: user ID, correlation ID, stack trace
- ✅ Breadcrumbs captured
- ✅ Environment correctly tagged

#### TC5.2: Performance Monitoring
**Steps:**
1. Execute slow operation (>1s)
2. Check logs for warning
3. Verify breadcrumb added

**Expected Result:**
- ✅ Event logged: `SLOW_OPERATION`
- ✅ Duration included in log
- ✅ Breadcrumb contains operation details

#### TC5.3: Alert Notifications
**Steps:**
1. Trigger 5+ errors in 5 minutes
2. Verify Slack/email alert sent
3. Check alert includes error details

**Expected Result:**
- ✅ Alert sent to configured channels
- ✅ Includes error rate and affected endpoints
- ✅ Link to Sentry issue

---

## Phase 6: Enhanced ETA

### Test Cases

#### TC6.1: Google Maps API ETA
**Steps:**
1. Request ride with valid coordinates
2. Verify Google Maps API called
3. Check ETA accuracy

**Expected Result:**
- ✅ API called with correct parameters
- ✅ Traffic data included
- ✅ Event logged: `ETA_CALCULATED_MAPS_API`
- ✅ Result cached for 15 minutes

#### TC6.2: ETA Caching
**Steps:**
1. Calculate ETA for same route twice
2. Verify second call uses cache
3. Check cache expiry after 15 minutes

**Expected Result:**
- ✅ First call hits API
- ✅ Second call returns cached result
- ✅ `cached: true` in response
- ✅ Cache expires after TTL

#### TC6.3: Fallback to Haversine
**Steps:**
1. Disable Google Maps API key
2. Request ETA calculation
3. Verify fallback works

**Expected Result:**
- ✅ Haversine formula used
- ✅ Event logged: `MAPS_API_FALLBACK`
- ✅ Reasonable ETA returned
- ✅ Event logged: `ETA_CALCULATED_HAVERSINE`

---

## Integration Tests

### IT1: End-to-End Payment Flow
**Scenario:** User orders food, pays via MoMo, receives confirmation

**Steps:**
1. Create order via WhatsApp
2. Initiate MoMo payment
3. Simulate payment callback
4. Verify all notifications sent
5. Check error tracking

**Expected Result:**
- ✅ Order created
- ✅ Payment processed
- ✅ User notified via WhatsApp
- ✅ No errors in Sentry
- ✅ All events logged

### IT2: End-to-End Cashout Flow
**Scenario:** User requests cashout, admin processes it

**Steps:**
1. User initiates cashout via WhatsApp
2. Verify admin notified
3. Admin processes via admin panel
4. User receives confirmation

**Expected Result:**
- ✅ Tokens deducted immediately
- ✅ Admin receives WhatsApp + database notification
- ✅ Admin can mark as processed
- ✅ All events tracked in Sentry

### IT3: End-to-End Ride Matching
**Scenario:** Passenger requests ride, driver accepts

**Steps:**
1. Passenger sends ride request
2. System finds nearby drivers
3. Driver accepts
4. Real-time ETA updates

**Expected Result:**
- ✅ Drivers matched with accurate ETA
- ✅ Google Maps API used
- ✅ Match events created
- ✅ Notifications sent

---

## Performance Tests

### PT1: Webhook Response Time
**Target:** P95 < 500ms

**Test:**
```bash
# Load test with 100 concurrent requests
ab -n 1000 -c 100 -H "Authorization: Bearer TOKEN" \
  https://YOUR_PROJECT.supabase.co/functions/v1/momo-webhook
```

**Expected Result:**
- ✅ P50 < 200ms
- ✅ P95 < 500ms
- ✅ P99 < 1000ms
- ✅ 0% error rate

### PT2: Database Query Performance
**Test:**
```sql
EXPLAIN ANALYZE
SELECT * FROM ai_agent_match_events
WHERE user_id = 'test_user'
AND match_type = 'job'
ORDER BY match_score DESC
LIMIT 10;
```

**Expected Result:**
- ✅ Query time < 50ms
- ✅ Index used
- ✅ No sequential scans

---

## Security Tests

### ST1: Webhook Signature Verification
**Test:**
1. Send webhook with invalid signature
2. Verify rejection

**Expected Result:**
- ✅ Returns 401 Unauthorized
- ✅ Event logged: `MOMO_WEBHOOK_INVALID_SIGNATURE`

### ST2: RLS Policies
**Test:**
1. Attempt to access another user's data
2. Verify blocked by RLS

**Expected Result:**
- ✅ Query returns empty result
- ✅ No error thrown
- ✅ RLS policy enforced

---

## Monitoring & Alerts

### Metrics to Monitor
1. **Error Rate**: < 1%
2. **Response Time**: P95 < 500ms
3. **Notification Delivery**: > 99%
4. **API Success Rate**: > 99.5%
5. **Database Connection Pool**: < 80% utilization

### Alert Thresholds
- **Critical**: Error rate > 5% for 5 minutes
- **Warning**: Response time P95 > 1s for 10 minutes
- **Info**: Slow query detected (> 1s)

---

## Sign-Off Checklist

- [ ] All test cases passed
- [ ] Integration tests successful
- [ ] Performance benchmarks met
- [ ] Security tests passed
- [ ] Monitoring configured
- [ ] Alerts tested
- [ ] Documentation complete
- [ ] Stakeholder approval

---

## Rollback Plan

If critical issues found:

1. **Immediate**: Disable feature flag
2. **Short-term**: Revert to previous deployment
3. **Long-term**: Fix issues, re-test, re-deploy

**Rollback Commands:**
```bash
# Revert database migration
supabase db reset --db-url YOUR_DB_URL

# Revert function deployment
git revert HEAD
supabase functions deploy --no-verify-jwt
```

---

## Support Contacts

- **Technical Lead**: tech@easymo.rw
- **DevOps**: devops@easymo.rw
- **On-Call**: +250 XXX XXX XXX
