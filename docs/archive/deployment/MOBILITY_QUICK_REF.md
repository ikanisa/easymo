# Mobility Webhook Quick Reference

## 🚀 Quick Commands

```bash
# Deploy function
supabase functions deploy wa-webhook-mobility

# View logs (real-time)
supabase functions logs wa-webhook-mobility --tail

# View logs (specific time range)
supabase functions logs wa-webhook-mobility --since 1h

# Push database migrations
supabase db push

# Verify deployment
./verify-mobility-deployment.sh

# Check function status
supabase functions list | grep mobility
```

## 🔍 Monitoring Queries

```sql
-- Check recent trips
SELECT id, status, payment_status, created_at 
FROM mobility_matches 
ORDER BY created_at DESC 
LIMIT 10;

-- Check pending driver verifications
SELECT user_id, license_number, status, created_at 
FROM driver_licenses 
WHERE status = 'pending' 
ORDER BY created_at DESC;

-- Check insurance certificates
SELECT user_id, vehicle_plate, policy_number, status, policy_expiry 
FROM driver_insurance_certificates 
WHERE status = 'pending' 
ORDER BY created_at DESC;

-- Check payment status
SELECT trip_id, amount_rwf, status, created_at 
FROM trip_payment_requests 
WHERE status = 'pending' 
ORDER BY created_at DESC;

-- Active drivers
SELECT p.phone_number, p.display_name, ds.vehicle_type, ds.last_seen_at
FROM driver_status ds
JOIN profiles p ON p.user_id = ds.user_id
WHERE ds.is_online = true
ORDER BY ds.last_seen_at DESC;

-- Today's metrics
SELECT 
  COUNT(*) FILTER (WHERE status = 'completed') as completed_trips,
  COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_trips,
  COUNT(*) FILTER (WHERE payment_status = 'paid') as paid_trips,
  SUM(payment_amount) FILTER (WHERE payment_status = 'paid') as total_revenue
FROM mobility_matches
WHERE created_at >= CURRENT_DATE;
```

## 🛠️ Manual Operations

### Approve Driver License
```sql
UPDATE driver_licenses 
SET status = 'approved', validated_at = now(), is_validated = true
WHERE id = '<license_id>';
```

### Approve Insurance Certificate
```sql
UPDATE driver_insurance_certificates 
SET status = 'approved', validated_at = now(), is_validated = true
WHERE id = '<insurance_id>';
```

### Manually Confirm Payment
```sql
UPDATE trip_payment_requests 
SET status = 'paid', confirmed_at = now()
WHERE id = '<payment_id>';

UPDATE mobility_matches 
SET payment_status = 'paid', payment_confirmed_at = now()
WHERE id = (SELECT trip_id FROM trip_payment_requests WHERE id = '<payment_id>');
```

### Check Driver Verification Status
```sql
SELECT get_driver_verification_status('<user_id>');
```

## 🐛 Troubleshooting

### OCR Not Working
```bash
# Check if OCR keys are set
supabase secrets list | grep -E "(OPENAI|GEMINI)"

# Add keys if missing
supabase secrets set OPENAI_API_KEY="sk-proj-..."
supabase secrets set GEMINI_API_KEY="AIzaSy..."

# Redeploy function
supabase functions deploy wa-webhook-mobility
```

### Payment Not Confirming
```sql
-- Check payment status
SELECT * FROM trip_payment_requests WHERE trip_id = '<trip_id>';

-- Manually approve
UPDATE trip_payment_requests SET status = 'paid', confirmed_at = now() WHERE trip_id = '<trip_id>';
```

### Driver Can't Go Online
```sql
-- Check if driver has valid insurance
SELECT is_driver_insurance_valid('<user_id>');

-- Check if driver has valid license
SELECT is_driver_license_valid('<user_id>');

-- Get full verification status
SELECT get_driver_verification_status('<user_id>');
```

## 📊 Key Metrics to Monitor

1. **Trip Volume**
   - Completed trips per day
   - Cancelled trips percentage
   - Average trip duration

2. **Payment Success Rate**
   - Paid vs skipped
   - Refund requests
   - Payment confirmation time

3. **Driver Verification**
   - Pending approvals
   - Approval rate
   - Average verification time

4. **OCR Performance**
   - Success rate
   - Failed extractions
   - Provider usage (OpenAI vs Gemini)

## 🔐 Security Checks

```sql
-- Check for expired licenses in use
SELECT COUNT(*) FROM driver_licenses 
WHERE status = 'approved' AND expiry_date < CURRENT_DATE;

-- Check for expired insurance in use
SELECT COUNT(*) FROM driver_insurance_certificates 
WHERE status = 'approved' AND policy_expiry < CURRENT_DATE;

-- Check for duplicate vehicle plates
SELECT vehicle_plate, COUNT(*) 
FROM driver_insurance_certificates 
WHERE status = 'approved' 
GROUP BY vehicle_plate 
HAVING COUNT(*) > 1;
```

## 📞 Support Scripts

### Reset User State
```sql
UPDATE wa_user_state 
SET state = 'home', state_data = NULL 
WHERE user_id = '<user_id>';
```

### Cancel Stuck Trip
```sql
UPDATE mobility_matches 
SET status = 'cancelled' 
WHERE id = '<trip_id>' AND status IN ('pending', 'accepted');
```

### Clear Old Intent Cache
```sql
DELETE FROM mobility_intent_cache 
WHERE expires_at < now();
```

## 🎯 Testing Flows

### Test Driver Verification
1. Upload driver license image via WhatsApp
2. Check logs: `supabase functions logs wa-webhook-mobility --tail`
3. Verify OCR extraction: `SELECT * FROM driver_licenses ORDER BY created_at DESC LIMIT 1;`
4. Approve: `UPDATE driver_licenses SET status = 'approved' WHERE id = '<id>';`

### Test MOMO Payment
1. Complete a trip
2. Receive payment prompt
3. Confirm payment via USSD
4. Send "PAID" confirmation
5. Check: `SELECT * FROM trip_payment_requests ORDER BY created_at DESC LIMIT 1;`

### Test Trip Lifecycle
1. Passenger searches for drivers
2. Select driver
3. Driver accepts
4. Trip starts
5. Trip completes
6. Payment confirmed
7. Ratings exchanged

## 📝 Common Issues

| Issue | Solution |
|-------|----------|
| OCR fails | Check image quality, ensure OPENAI_API_KEY or GEMINI_API_KEY is set |
| Payment not confirming | Check momo_transactions table, manually approve if needed |
| Driver can't go online | Verify insurance/license validity |
| No nearby drivers found | Check if drivers are online in driver_status table |
| State stuck | Reset via `UPDATE wa_user_state SET state = 'home'` |

## 🔄 Deployment Checklist

- [ ] Database migrations pushed (`supabase db push`)
- [ ] Function deployed (`supabase functions deploy wa-webhook-mobility`)
- [ ] OCR secrets configured (`OPENAI_API_KEY`, `GEMINI_API_KEY`)
- [ ] WA_VERIFY_TOKEN set
- [ ] Verification script passes (`./verify-mobility-deployment.sh`)
- [ ] Logs monitored for errors
- [ ] Test flows validated
- [ ] Admin dashboard ready (for approvals)

---

**Last Updated**: November 25, 2025  
**Version**: 251  
**Status**: Production Ready (75%)
