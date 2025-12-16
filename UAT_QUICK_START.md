# UAT Quick Start Guide

## 🚀 Quick Start (5 Minutes)

### Step 1: Verify System Health
```bash
# Check all webhooks are responding
./scripts/check_webhook_health.sh
```

**Expected**: All webhooks show ✓ OK

### Step 2: Start Log Monitoring
```bash
# In a separate terminal, monitor logs
./scripts/monitor_logs.sh
```

**Keep this running** during all tests to catch errors.

### Step 3: Prepare Test Data
```sql
-- Run in Supabase SQL Editor
-- Add test partners for wallet transfer testing
INSERT INTO allowed_partners (partner_name, partner_phone, partner_type, is_active, description)
VALUES 
  ('Test Business', '+250788123456', 'business', true, 'Test partner for UAT'),
  ('Test Service', '+250788654321', 'service', true, 'Test service partner');
```

### Step 4: Execute Critical Tests

#### Test 1: Home Menu (2 minutes)
1. Open WhatsApp
2. Send "hi" to your WhatsApp Business number
3. **Expected**: Home menu appears with all services

#### Test 2: Mobility Flow (5 minutes)
1. Click "Rides" or send "ride"
2. **Expected**: System asks "Are you a driver or passenger?"
3. Click "Driver"
4. **Expected**: System asks for location
5. Share your location
6. **Expected**: List of passengers appears (or "No matches" message)

#### Test 3: Profile & Wallet (5 minutes)
1. Click "Profile"
2. **Expected**: Profile menu with QR Code and Wallet options
3. Click "Wallet & Tokens"
4. **Expected**: Balance displayed, options shown
5. Click "Earn Tokens"
6. **Expected**: Share link with referral code appears

#### Test 4: Buy & Sell (3 minutes)
1. Click "Buy & Sell" or send "buy"
2. **Expected**: AI agent welcomes you
3. Send "find me a restaurant"
4. **Expected**: AI responds with search results

### Step 5: Check Results
- Review logs for any errors
- Check `UAT_TEST_RESULTS.md` for documented results
- Verify database has correct data

## 📋 Full Test Plan

For comprehensive testing, follow:
- **UAT_TEST_EXECUTION_PLAN.md** - Detailed test cases
- **UAT_TEST_RESULTS.md** - Document your results

## 🔍 Monitoring

### During Tests
- Watch the log monitoring terminal
- Look for [ERROR] or [WARN] messages
- Note any unexpected behavior

### After Tests
- Review all logs
- Check database state
- Document any issues

## ✅ Success Criteria

Tests are successful if:
- ✅ All critical tests pass
- ✅ No errors in logs
- ✅ User experience is smooth
- ✅ Data is saved correctly

## 🐛 If Issues Found

1. **Document** in `UAT_TEST_RESULTS.md`
2. **Prioritize** (P0, P1, P2, P3)
3. **Fix** critical issues
4. **Re-test** after fixes

## 📞 Support

- **Documentation**: See `WEBHOOK_COMPREHENSIVE_REVIEW.md`
- **Test Plan**: See `UAT_TEST_EXECUTION_PLAN.md`
- **Go-Live**: See `GO_LIVE_CHECKLIST.md`

