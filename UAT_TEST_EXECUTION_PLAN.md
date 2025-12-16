# UAT Test Execution Plan - WhatsApp Webhooks

## Test Execution Overview

This document provides step-by-step instructions for executing User Acceptance Testing (UAT) for all WhatsApp webhook functions.

## Pre-Test Setup

### 1. Environment Verification
```bash
# Verify all functions are deployed
supabase functions list

# Verify migrations are applied
supabase db push

# Check function health
curl https://<project>.supabase.co/functions/v1/wa-webhook-core
curl https://<project>.supabase.co/functions/v1/wa-webhook-mobility
curl https://<project>.supabase.co/functions/v1/wa-webhook-buy-sell
curl https://<project>.supabase.co/functions/v1/wa-webhook-profile
```

### 2. Test Data Setup
- Create test user profiles
- Add sample businesses
- Add allowed partners to `allowed_partners` table
- Create test trips (for mobility testing)

## Test Execution Steps

### Phase 1: Core Routing Tests

#### Test 1.1: Home Menu Display
**Action**: Send "hi" or "menu" to WhatsApp
**Expected**: Home menu with all services displayed
**Verify**: 
- Menu items load correctly
- All buttons work
- Navigation works

#### Test 1.2: Service Routing
**Actions**:
1. Click "Rides" → Should route to mobility
2. Click "Buy & Sell" → Should route to buy-sell
3. Click "Profile" → Should route to profile
4. Send "insurance" → Should route to insurance

**Expected**: Each service loads correctly
**Verify**: Correct service responds

---

### Phase 2: Mobility Tests

#### Test 2.1: First-Time User Flow
**Steps**:
1. New user sends "ride" or clicks "Rides"
2. System asks: "Are you a driver or passenger?"
3. User clicks "Driver"
4. System asks: "Please share your current location"
5. User shares location via WhatsApp
6. System shows list of passengers (top 10)

**Expected Results**:
- ✅ Role selection prompt appears
- ✅ Role saved to profile (`mobility_role` column)
- ✅ Location prompt appears
- ✅ Location saved to `trips` table
- ✅ List of matches displayed with:
  - Name
  - Reference code
  - Estimated distance/time

**Database Verification**:
```sql
-- Check profile has mobility_role
SELECT id, user_id, mobility_role FROM profiles WHERE phone_number = '<test_phone>';

-- Check trip was created
SELECT id, user_id, role, pickup_lat, pickup_lng, status FROM trips 
WHERE phone = '<test_phone>' ORDER BY created_at DESC LIMIT 1;
```

#### Test 2.2: Returning User Flow
**Steps**:
1. Existing user (with `mobility_role` set) sends "ride"
2. System immediately asks for location (no role selection)
3. User shares location
4. System shows matches

**Expected Results**:
- ✅ No role selection (skipped)
- ✅ Direct to location prompt
- ✅ Matches displayed

#### Test 2.3: No Matches Scenario
**Steps**:
1. User shares location in area with no opposite role users
2. System processes location

**Expected Results**:
- ✅ Location saved
- ✅ Message: "No [drivers/passengers] found nearby. Your location has been saved. Try again later."

#### Test 2.4: Driver Sees Passengers
**Steps**:
1. Create test passenger trips in database
2. Driver shares location
3. System shows passenger list

**Expected Results**:
- ✅ List shows up to 10 passengers
- ✅ Each entry shows name, ref code, distance
- ✅ User can select to contact

#### Test 2.5: Passenger Sees Drivers
**Steps**:
1. Create test driver trips in database
2. Passenger shares location
3. System shows driver list

**Expected Results**:
- ✅ List shows up to 10 drivers
- ✅ Each entry shows name, ref code, distance
- ✅ User can select to contact

---

### Phase 3: Profile Tests

#### Test 3.1: Profile Menu
**Steps**:
1. User clicks "Profile" or sends "profile"
2. System shows profile menu

**Expected Results**:
- ✅ Menu shows:
  - MoMo QR Code
  - Wallet & Tokens
  - Back to Menu

#### Test 3.2: QR Code Generation
**Steps**:
1. User clicks "MoMo QR Code"
2. System shows QR code options
3. User enters phone number
4. System generates QR code

**Expected Results**:
- ✅ QR code menu displays
- ✅ QR code generated successfully
- ✅ Phone number validated

#### Test 3.3: Wallet Balance Display
**Steps**:
1. User clicks "Wallet & Tokens"
2. System shows wallet menu

**Expected Results**:
- ✅ Balance displayed (e.g., "Your balance: *50 TOK*")
- ✅ Options shown:
  - Earn Tokens
  - Transfer to Partner
  - Back

**Database Verification**:
```sql
-- Check wallet balance
SELECT profile_id, tokens FROM wallet_accounts 
WHERE profile_id = (SELECT id FROM profiles WHERE user_id = '<user_id>');
```

#### Test 3.4: Earn Tokens Flow
**Steps**:
1. User clicks "Earn Tokens"
2. System shows share easyMO link with referral code
3. User shares link with contact
4. Contact signs up using referral code
5. User receives tokens

**Expected Results**:
- ✅ Share link displayed
- ✅ Referral code included (format: REF:XXXXX)
- ✅ Instructions clear
- ✅ Tokens credited when contact signs up

**Database Verification**:
```sql
-- Check referral attribution
SELECT * FROM referral_attributions 
WHERE referrer_user_id = '<user_id>' ORDER BY created_at DESC;

-- Check wallet transaction
SELECT * FROM wallet_transactions 
WHERE profile_id = '<profile_id>' AND direction = 'credit' 
ORDER BY occurred_at DESC;
```

#### Test 3.5: Transfer to Partner
**Steps**:
1. User clicks "Transfer to Partner"
2. System shows list of allowed partners
3. User selects partner
4. User enters amount (e.g., "10")
5. System processes transfer

**Expected Results**:
- ✅ Partner list displays (only active partners)
- ✅ Transfer successful
- ✅ Balance updated
- ✅ Transaction recorded
- ✅ Confirmation message sent

**Database Verification**:
```sql
-- Check transfer transaction
SELECT * FROM wallet_transactions 
WHERE profile_id = '<profile_id>' 
  AND direction = 'debit' 
  AND description LIKE '%Transfer to%'
ORDER BY occurred_at DESC;

-- Check updated balance
SELECT tokens FROM wallet_accounts WHERE profile_id = '<profile_id>';
```

#### Test 3.6: Transfer Validations
**Test Cases**:

**Case 1: Insufficient Balance**
- User has 5 TOK
- User tries to transfer 10 TOK
- **Expected**: Error message "Insufficient balance. You have *5 TOK*. Please enter a smaller amount."

**Case 2: Zero Balance**
- User has 0 TOK
- User clicks "Transfer to Partner"
- **Expected**: Message "You don't have any tokens to transfer. Earn tokens by sharing easyMO with your contacts."

**Case 3: Invalid Amount**
- User enters "abc" as amount
- **Expected**: Error message "Please send a valid number (e.g., 10, 50, 100)."

**Case 4: No Partners Available**
- No active partners in database
- User clicks "Transfer to Partner"
- **Expected**: Message "No partners available for transfers at this time. Please check back later."

---

### Phase 4: Buy & Sell Tests

#### Test 4.1: AI Agent Welcome
**Steps**:
1. User sends "buy" or clicks "Buy & Sell"
2. AI agent responds

**Expected Results**:
- ✅ Welcome message appears
- ✅ AI introduces itself
- ✅ User can start conversation

#### Test 4.2: Business Search
**Steps**:
1. User asks: "Find me a restaurant"
2. AI searches and responds
3. User shares location
4. AI finds nearby businesses

**Expected Results**:
- ✅ AI understands natural language
- ✅ Business search works
- ✅ Location-based search works
- ✅ Results displayed clearly

#### Test 4.3: Vendor Response
**Steps**:
1. User sends inquiry about business
2. Vendor responds with "HAVE_IT" or "NO_STOCK"
3. System processes vendor response

**Expected Results**:
- ✅ Vendor response handled correctly
- ✅ User notified appropriately

---

### Phase 5: Error Handling Tests

#### Test 5.1: Invalid Signature
**Action**: Send request with invalid signature
**Expected**: Request rejected (in production) or logged as warning (in development)

#### Test 5.2: Missing Required Fields
**Action**: Send malformed payload
**Expected**: User-friendly error message

#### Test 5.3: Database Errors
**Action**: Simulate database connection error
**Expected**: System error logged, user sees generic error message

#### Test 5.4: Invalid Phone Numbers
**Action**: Send message with invalid phone format
**Expected**: Graceful handling, minimal profile created if possible

---

### Phase 6: Idempotency Tests

#### Test 6.1: Duplicate Message
**Steps**:
1. Send message with message_id "ABC123"
2. Send same message again with same message_id
3. Verify second message is ignored

**Expected Results**:
- ✅ First message processed
- ✅ Second message blocked
- ✅ Log shows "DUPLICATE_BLOCKED"

**Database Verification**:
```sql
-- Check wa_events table
SELECT * FROM wa_events 
WHERE message_id = 'ABC123' 
ORDER BY created_at DESC;
```

---

### Phase 7: Performance Tests

#### Test 7.1: Response Time
**Action**: Send 10 messages and measure response times
**Expected**: All responses < 2 seconds

#### Test 7.2: Concurrent Users
**Action**: Simulate 20 concurrent users
**Expected**: No degradation, all requests handled

---

## Test Results Template

### Test Execution Log

| Test ID | Test Name | Status | Notes | Tester | Date |
|---------|-----------|--------|-------|--------|------|
| TC-001 | Core Routing | ⏳ | | | |
| TC-002 | Mobility First Time | ⏳ | | | |
| TC-003 | Mobility Returning | ⏳ | | | |
| TC-004 | Mobility No Matches | ⏳ | | | |
| TC-005 | Profile QR Code | ⏳ | | | |
| TC-006 | Wallet Balance | ⏳ | | | |
| TC-007 | Earn Tokens | ⏳ | | | |
| TC-008 | Transfer to Partner | ⏳ | | | |
| TC-009 | Transfer Validations | ⏳ | | | |
| TC-010 | Buy & Sell AI | ⏳ | | | |
| TC-011 | Error Handling | ⏳ | | | |
| TC-012 | Idempotency | ⏳ | | | |
| TC-013 | Rate Limiting | ⏳ | | | |
| TC-014 | Signature Verification | ⏳ | | | |
| TC-015 | Database Operations | ⏳ | | | |

## Go-Live Criteria

### Must Pass (Blockers):
- [ ] All core routing tests pass
- [ ] All mobility tests pass
- [ ] All profile tests pass
- [ ] All buy-sell tests pass
- [ ] Error handling works correctly
- [ ] Idempotency works correctly
- [ ] No critical errors in logs

### Should Pass (Important):
- [ ] Performance tests pass
- [ ] All validations work
- [ ] User experience is smooth

### Nice to Have:
- [ ] All edge cases handled
- [ ] Comprehensive logging
- [ ] Monitoring alerts configured

## Post-Test Actions

1. **Document Issues**: Log all issues found during testing
2. **Prioritize Fixes**: Categorize issues (P0, P1, P2)
3. **Fix Issues**: Address all P0 and P1 issues
4. **Re-test**: Re-run failed tests after fixes
5. **Sign-off**: Get approval for go-live

## Test Data Cleanup

After testing, clean up test data:
```sql
-- Remove test trips
DELETE FROM trips WHERE phone LIKE '%test%';

-- Reset test user roles (optional)
UPDATE profiles SET mobility_role = NULL WHERE phone_number LIKE '%test%';

-- Reset test wallet balances (optional)
UPDATE wallet_accounts SET tokens = 0 WHERE profile_id IN (
  SELECT id FROM profiles WHERE phone_number LIKE '%test%'
);
```

