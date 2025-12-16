# UAT Execution Guide

**Date:** 2025-12-16  
**Purpose:** Step-by-step guide for executing User Acceptance Tests

---

## Prerequisites

1. **Test Environment Setup:**
   - Staging/test Supabase instance configured
   - WhatsApp Business API credentials configured
   - Test phone numbers available
   - Database migrations applied

2. **Test Data:**
   - Test user profiles created
   - Test businesses seeded
   - Test locations available
   - Test drivers/passengers available

3. **Tools:**
   - WhatsApp Business account
   - Test phone numbers
   - Screenshot tool for documentation
   - Test results tracking spreadsheet

---

## Test Execution Process

### Step 1: Pre-Test Checklist

- [ ] Verify all services are deployed
- [ ] Check database connectivity
- [ ] Verify WhatsApp API credentials
- [ ] Confirm test data is seeded
- [ ] Enable structured logging
- [ ] Open metrics dashboard

### Step 2: Execute Test Cases

Follow the test cases in `UAT_TEST_CASES.md` in order:

1. **Mobility Service Tests** (UAT-MOB-001 to UAT-MOB-005)
2. **Buy & Sell Service Tests** (UAT-BS-001 to UAT-BS-005)
3. **Profile Service Tests** (UAT-PROF-001 to UAT-PROF-004)
4. **Core Router Tests** (UAT-CORE-001 to UAT-CORE-002)
5. **Cross-Service Tests** (UAT-CROSS-001 to UAT-CROSS-002)

### Step 3: Document Results

For each test case:
- [ ] Record pass/fail status
- [ ] Take screenshots of WhatsApp conversations
- [ ] Note any unexpected behavior
- [ ] Document performance metrics
- [ ] Record error messages (if any)

### Step 4: Post-Test Review

- [ ] Review all test results
- [ ] Document any failures
- [ ] Create bug reports for issues found
- [ ] Update test cases if needed
- [ ] Clean up test data

---

## Quick Test Execution Commands

### Test Mobility Service
1. Send "rides" to WhatsApp number
2. Follow menu prompts
3. Verify responses match expected results

### Test Buy & Sell Service
1. Send "buy" to WhatsApp number
2. Verify welcome message appears (P2-002 fix)
3. Send product request
4. Verify AI agent processes request

### Test Profile Service
1. Send "profile" to WhatsApp number
2. Navigate through menu options
3. Verify confirmations appear (P2-008 fix)

---

## Key Features to Verify

### P2 Fixes to Verify

1. **P2-001:** Text message intent recognition
   - Try: "I need a driver", "find me a taxi", "schedule a ride"
   - Expected: Correct handler invoked

2. **P2-002:** i18n welcome messages
   - Try: Send "buy" in different languages
   - Expected: Welcome message in user's language

3. **P2-005:** Metrics recording
   - Check: Metrics dashboard
   - Expected: Metrics recorded for all operations

4. **P2-008:** Confirmation messages
   - Try: Save location, go online, update business
   - Expected: Confirmation messages appear

5. **P2-009:** Progress indicators
   - Try: Search for drivers/passengers
   - Expected: Progress indicator shown

---

## Test Results Template

```
Test Case: UAT-MOB-001
Status: ✅ PASS / ❌ FAIL
Date: 2025-12-16
Tester: [Name]
Notes: [Any observations]
Screenshots: [Links]
Metrics: [Response times, etc.]
```

---

## Common Issues and Solutions

### Issue: No response from WhatsApp
- **Solution:** Check API credentials, verify webhook is configured

### Issue: Wrong language displayed
- **Solution:** Check user's language preference in database

### Issue: Missing confirmation messages
- **Solution:** Verify P2-008 fixes are deployed

### Issue: Slow response times
- **Solution:** Check cache hit rates, database performance

---

## Success Criteria

- ✅ All critical test cases pass (UAT-MOB-001, UAT-BS-001, UAT-PROF-001, UAT-CORE-001)
- ✅ 95% of requests complete within 5 seconds
- ✅ 99% success rate for all operations
- ✅ All confirmation messages appear (P2-008 fix)
- ✅ All metrics recorded (P2-005 fix)

---

**Document Version:** 1.0  
**Last Updated:** 2025-12-16

