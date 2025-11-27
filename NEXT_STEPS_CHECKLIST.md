# 📋 NEXT STEPS CHECKLIST

**After Deployment on November 27, 2025**

---

## ✅ COMPLETED STEPS

- [x] Fixed wallet transfer RPC function bug
- [x] Deployed wa-webhook-profile (v82)
- [x] Enhanced mobility with remote pricing
- [x] Deployed wa-webhook-mobility (v266)
- [x] Applied mobility pricing migration
- [x] Committed all code changes
- [x] Pushed to GitHub
- [x] Created comprehensive documentation
- [x] Monitored initial logs

---

## 🔄 IMMEDIATE ACTIONS (Next 1-2 Hours)

### 1. Test Wallet Transfer
**Priority:** 🔴 CRITICAL

**Steps:**
1. Identify two test users with tokens
2. Send transfer from User A to User B
3. Verify success message
4. Check balances updated
5. Confirm notification received

**Command to monitor:**
```bash
supabase functions logs wa-webhook-profile --tail | grep WALLET_TRANSFER
```

**Expected in logs:**
```json
{"event":"WALLET_TRANSFER_SUCCESS","sender":"...","recipient":"...","amount":3000}
```

**If fails:** Check logs for `WALLET_TRANSFER_FAILED` with error details

---

### 2. Verify Mobility Pricing
**Priority:** 🟡 MEDIUM

**Steps:**
1. Request ride estimate via WhatsApp
2. Note the pricing shown
3. Verify calculation matches expected

**Optional - Configure custom pricing:**
```sql
UPDATE app_config 
SET mobility_pricing = '{
  "moto": {"baseFare": 1500, "perKm": 500}
}'::jsonb;
```

---

### 3. Check Database Consistency
**Priority:** 🟡 MEDIUM

**Queries to run:**
```sql
-- Verify recent transfers
SELECT COUNT(*) FROM wallet_transfers 
WHERE created_at > NOW() - INTERVAL '1 hour';

-- Check app_config has new column
SELECT mobility_pricing FROM app_config LIMIT 1;

-- Verify wallet balances match entries
SELECT 
  wa.profile_id,
  wa.tokens as account_balance,
  COALESCE(SUM(we.amount_tokens), 0) as ledger_balance
FROM wallet_accounts wa
LEFT JOIN wallet_entries we ON wa.profile_id = we.profile_id
GROUP BY wa.profile_id, wa.tokens
HAVING wa.tokens != COALESCE(SUM(we.amount_tokens), 0)
LIMIT 5;
```

---

## 📊 MONITORING (Next 24 Hours)

### Continuous Checks

**Every 2 Hours:**
- [ ] Check function logs for errors
- [ ] Verify transfer success rate
- [ ] Monitor notification delivery

**Commands:**
```bash
# Check for any errors
supabase functions logs wa-webhook-profile --tail | grep -i error

# Watch for transfer events
supabase functions logs wa-webhook-profile --tail | grep WALLET_TRANSFER

# Monitor overall function health
supabase functions list
```

---

### Metrics to Track

**Wallet Transfers:**
- [ ] Success rate (target: >95%)
- [ ] Average response time
- [ ] Notification delivery rate
- [ ] Error types and frequency

**Mobility:**
- [ ] Pricing calculation accuracy
- [ ] Remote config load success
- [ ] Trip creation rate
- [ ] Payment success rate

---

## 🧪 TESTING SCENARIOS

### Wallet Transfer Tests

**Test 1: Happy Path** ✅
- Sender: 10,000 tokens
- Amount: 3,000 tokens
- Expected: Success

**Test 2: Insufficient Balance**
- Sender: 2,500 tokens
- Amount: 5,000 tokens
- Expected: Error message shown

**Test 3: Below Minimum**
- Sender: 1,500 tokens
- Amount: Any
- Expected: Blocked with clear message

**Test 4: Invalid Recipient**
- Recipient: Non-existent number
- Expected: "Recipient not found"

**Test 5: Idempotency**
- Same transfer twice
- Expected: Only one recorded

---

### Mobility Tests

**Test 1: Default Pricing**
- No custom config
- Expected: Uses hardcoded pricing

**Test 2: Custom Pricing**
- After setting mobility_pricing
- Expected: Uses database config

**Test 3: Cache Behavior**
- Config change
- Wait 6 minutes
- Expected: New pricing loaded

---

## 🚨 ALERT CONDITIONS

**Set up monitoring for:**

### Critical Alerts
- [ ] Wallet transfer success rate < 90%
- [ ] Any `WALLET_TRANSFER_FAILED` events with DB errors
- [ ] Function deployment failures
- [ ] Migration rollback needed

### Warning Alerts
- [ ] Notification delivery failures
- [ ] Slow response times (>2s)
- [ ] Unusual transfer patterns
- [ ] Pricing config load failures

---

## 📝 REPORTING

### End of Day Report (24 hours)

**Metrics to collect:**
```sql
-- Transfer stats
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as transfers,
  SUM(amount_tokens) as total_tokens
FROM wallet_transfers
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY 1
ORDER BY 1;

-- Success rate
SELECT 
  status,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as percentage
FROM wallet_transfers
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status;
```

**Questions to answer:**
- How many transfers occurred?
- What was the success rate?
- Were all notifications delivered?
- Any errors encountered?
- Any performance issues?

---

## 🎯 SUCCESS CRITERIA

**After 24 hours, we should have:**

- [ ] ≥5 successful test transfers
- [ ] 100% success rate (or known issues documented)
- [ ] All notifications delivered
- [ ] No critical errors in logs
- [ ] Mobility pricing working as expected
- [ ] Database consistency verified

---

## 📞 ESCALATION

**If critical issues found:**

1. **Immediate:** Stop testing
2. **Check logs:** Identify root cause
3. **Consider rollback** if affecting users
4. **Document issue** with logs and steps
5. **Fix and redeploy** or rollback

**Rollback commands in:** `POST_DEPLOYMENT_STATUS.md`

---

## ✅ COMPLETION CHECKLIST

**Before marking deployment as fully complete:**

- [ ] All wallet transfer tests passed
- [ ] All mobility tests passed
- [ ] 24-hour monitoring complete
- [ ] Success metrics met
- [ ] No outstanding errors
- [ ] Documentation updated with results
- [ ] Team notified of completion

---

**Current Status:** 🟢 Deployed - Awaiting Production Validation

**Last Updated:** 2025-11-27 09:57 UTC
