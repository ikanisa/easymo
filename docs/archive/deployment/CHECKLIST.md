# wa-webhook Deployment Checklist

## Pre-Deployment ✅

- [x] Code review complete
- [x] All workflows verified
- [x] Bug fixes applied
- [x] Documentation created
- [x] CI/CD guard updated

## Deployment Steps

### 1. Merge PR
```bash
git checkout main
git pull origin main
```

### 2. Deploy Functions
```bash
supabase functions deploy wa-webhook
supabase functions deploy wa-webhook-mobility
supabase functions deploy wa-webhook-wallet
supabase functions deploy wa-webhook-core
```

### 3. Verify Database
```bash
# Check insurance contacts
supabase db query "SELECT * FROM insurance_admin_contacts WHERE is_active = true"
# Expected: 3 rows

# Check countries
supabase db query "SELECT name, momo_supported FROM countries"
# Expected: 7 rows
```

## Testing Checklist

### Insurance
- [ ] Upload document
- [ ] Verify OCR processes
- [ ] Check admin notifications sent
- [ ] Confirm 2000 tokens awarded
- [ ] Test Help button shows contacts

### Share easyMO
- [ ] Generate referral link
- [ ] Verify +22893002751 in link
- [ ] Generate QR code
- [ ] Test referral gives 10 tokens

### MOMO QR
- [ ] Test Rwanda number sees "Use my number"
- [ ] Test Malta number doesn't see "Use my number"
- [ ] Generate QR code successfully
- [ ] Verify tel: format

### Wallet
- [ ] Test transfer with <2000 tokens (should fail)
- [ ] Test transfer with ≥2000 tokens (should work)
- [ ] Test redeem with <2000 tokens (should fail)
- [ ] Test redeem with ≥2000 tokens (should work)
- [ ] Test earn tokens link generation

### Rides
- [ ] Request nearby drivers
- [ ] Share location ONCE
- [ ] Verify location cached (30 min)
- [ ] Check drivers receive notification
- [ ] Try nearby again <30 min (should use cache)

## Verification

Run verification script:
```bash
chmod +x verify-deployment.sh
./verify-deployment.sh
```

## Monitoring

Watch for these events in logs:
- ✅ INSURANCE_OCR_OK
- ✅ DRIVER_NOTIFIED
- ✅ WALLET_TRANSFER_SUCCESS
- ✅ LOCATION_CACHED

## Rollback (if needed)

```bash
supabase functions deploy wa-webhook --version <previous-version>
```

## Success Criteria

- [ ] All 5 workflows tested successfully
- [ ] No errors in Supabase logs
- [ ] Driver notifications received
- [ ] Location caching works
- [ ] Token limits enforced

## Sign-off

- [ ] Deployed by: _______________
- [ ] Tested by: _______________
- [ ] Date: _______________
- [ ] All tests passed: _______________

---

See **DEPLOYMENT_GUIDE.md** for detailed instructions.
