# Vehicle Management - Deployment Guide

## ✅ Implementation Complete

The vehicle management workflow has been completely refactored and is ready for deployment.

## 🎯 What Was Fixed

### Before (Broken)
- ❌ Referenced non-existent "AI Agent" for vehicle management
- ❌ Used wrong database table (`insurance_profiles`)
- ❌ No OCR integration for insurance certificate processing
- ❌ Confusing user experience
- ❌ No insurance expiry validation

### After (Fixed)
- ✅ **Simple, direct flow**: User uploads insurance → System extracts data → Vehicle added
- ✅ **Proper database tables**: Uses `vehicles`, `vehicle_ownerships`, `driver_insurance_certificates`
- ✅ **OCR integration**: Leverages existing `insurance-ocr` function with OpenAI/Gemini
- ✅ **Clear user messages**: Step-by-step guidance with actionable feedback
- ✅ **Insurance validation**: Checks expiry dates, rejects expired certificates
- ✅ **Error handling**: Graceful fallbacks with manual review queue

## 📁 Files Changed

### New Files
1. **`supabase/functions/wa-webhook-profile/vehicles/add.ts`** (249 lines)
   - `startAddVehicle()`: Initiates vehicle addition flow
   - `handleVehicleInsuranceUpload()`: Processes insurance document with OCR

### Modified Files
2. **`supabase/functions/wa-webhook-profile/vehicles/list.ts`** (modified)
   - Updated to query `vehicle_ownerships` table
   - Shows insurance expiry status with warnings
   - Removed AI Agent references

3. **`supabase/functions/wa-webhook-profile/index.ts`** (modified)
   - Added `ADD_VEHICLE` button handler
   - Added `RENEW_INSURANCE` button handler
   - Routes insurance documents to OCR handler
   - Manages `vehicle_add_insurance` state

### Documentation
4. **`VEHICLE_MANAGEMENT_IMPLEMENTATION.md`** (complete technical documentation)
5. **`VEHICLE_MANAGEMENT_DEPLOYMENT_GUIDE.md`** (this file)

## 🚀 Deployment Steps

### 1. Verify Environment Variables
Ensure these are set in Supabase:

```bash
# Required: At least one OCR provider
OPENAI_API_KEY=sk-...
# OR
GEMINI_API_KEY=...

# Required: WhatsApp authentication
WHATSAPP_APP_SECRET=your-app-secret
WA_VERIFY_TOKEN=your-verify-token

# Optional: Storage bucket name (defaults to "insurance-docs")
INSURANCE_MEDIA_BUCKET=insurance-docs
```

Check in Supabase dashboard:
Settings → Edge Functions → Environment Variables

### 2. Verify Database Schema
The required tables should already exist from migration:
`supabase/migrations/20251203080000_insurance_system_fixes.sql`

Verify tables exist:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('vehicles', 'vehicle_ownerships', 'driver_insurance_certificates');
```

Should return 3 rows. If not, run:
```bash
supabase db push
```

### 3. Deploy Edge Function
```bash
# Deploy wa-webhook-profile with new vehicle handlers
supabase functions deploy wa-webhook-profile

# Verify deployment
supabase functions list
```

Expected output:
```
wa-webhook-profile (v2.2.1) - healthy
```

### 4. Test Health Check
```bash
curl https://your-project.supabase.co/functions/v1/wa-webhook-profile/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "wa-webhook-profile",
  "timestamp": "2024-12-04T...",
  "checks": {
    "database": "connected",
    "table": "profiles"
  },
  "version": "2.2.1"
}
```

## 🧪 Testing

### Test Case 1: Empty Vehicle List
**Action**: User taps "My Vehicles" (no vehicles yet)

**Expected Response**:
```
🚗 You don't have any registered vehicles yet.

To add a vehicle, simply send us a photo or PDF of your 
valid insurance certificate (Yellow Card).

We'll automatically extract the vehicle details and 
register it for you!

[➕ Add Vehicle] [← Back]
```

### Test Case 2: Add Vehicle (Happy Path)
**Steps**:
1. User taps "➕ Add Vehicle"
2. User uploads clear insurance certificate image
3. Certificate contains: valid plate, expiry date in future
4. All fields are readable

**Expected Response**:
```
⏳ Processing your insurance certificate...

✅ Vehicle Added Successfully!

🚗 Plate Number: RAB 123 A
🏢 Insurance Company: SORAS
📄 Policy Number: POL-2024-12345
📅 Insurance Expires: 31/12/2025

Your vehicle is now registered and ready to use for rides!

[📋 View My Vehicles] [← Back to Profile]
```

### Test Case 3: Expired Insurance
**Steps**:
1. User uploads insurance certificate
2. Certificate has expiry date in the past

**Expected Response**:
```
⚠️ Insurance certificate is expired!

Plate: RAB 123 A
Expiry Date: 15/01/2024

Please upload a valid (non-expired) insurance certificate 
to add your vehicle.

[🔄 Upload Valid Certificate] [← Back]
```

### Test Case 4: Unreadable Document
**Steps**:
1. User uploads blurry/unclear image
2. OCR cannot extract plate number

**Expected Response**:
```
⚠️ Could not find vehicle plate number.

Please make sure the document clearly shows the vehicle 
registration plate and try again.

[🔄 Try Again] [← Back]
```

### Test Case 5: View Vehicle Details
**Steps**:
1. User has 1+ vehicles
2. User taps "My Vehicles"
3. User selects a vehicle

**Expected Response**:
```
🚗 Vehicle Details

📋 Plate: RAB 123 A
🏢 Make: Toyota
🚙 Model: Corolla
📅 Year: 2020

🛡️ Insurance
Status: ✅ Active
Company: SORAS
Policy: POL-2024-12345
Expires: 31/12/2025

[← Back]
```

## 📊 Monitoring

### Key Metrics to Track
```sql
-- Vehicle additions per day
SELECT 
  DATE(created_at) as date,
  COUNT(*) as vehicles_added
FROM vehicle_ownerships
WHERE started_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- OCR success rate
SELECT 
  status,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM insurance_media_queue
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY status;

-- Insurance expiry warnings
SELECT 
  COUNT(*) as expiring_soon
FROM driver_insurance_certificates dic
JOIN vehicle_ownerships vo ON vo.insurance_certificate_id = dic.id
WHERE vo.is_current = TRUE
  AND dic.policy_expiry BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days';
```

### Set Up Alerts
Create alerts for:
- OCR failure rate > 20%
- Manual review queue > 50 items
- No vehicle additions in 24 hours (if you expect traffic)

## 🐛 Troubleshooting

### Issue: "Unable to read the document"
**Cause**: OCR provider (OpenAI/Gemini) failed or returned low confidence

**Solution**:
1. Check environment variable: `OPENAI_API_KEY` or `GEMINI_API_KEY`
2. Verify API key is valid and has credits
3. Check logs: `supabase functions logs wa-webhook-profile`
4. Document is queued for manual review - admins will be notified

### Issue: "Failed to create vehicle record"
**Cause**: Database constraint violation or missing RPC function

**Solution**:
1. Verify migration applied: Check for `upsert_vehicle` function
2. Run: `supabase db push` to ensure latest schema
3. Check RLS policies on `vehicles` table

### Issue: User not receiving messages
**Cause**: WhatsApp API credentials or webhook routing

**Solution**:
1. Verify `WHATSAPP_APP_SECRET` in environment
2. Check webhook routing in `wa-webhook-core`
3. Verify user's WhatsApp number format (E.164)
4. Check logs for send errors

## 📝 Logs and Debugging

### View Function Logs
```bash
# Real-time logs
supabase functions logs wa-webhook-profile --tail

# Search for specific user
supabase functions logs wa-webhook-profile | grep "VEHICLE_ADD"

# Filter by time
supabase functions logs wa-webhook-profile --since "2024-12-04 10:00:00"
```

### Key Log Events
- `VEHICLE_ADD_STARTED`: User initiated vehicle addition
- `VEHICLE_OCR_FAILED`: OCR processing failed
- `VEHICLE_ADDED_SUCCESS`: Vehicle successfully added
- `VEHICLE_ADD_ERROR`: General error in flow

### Check Database State
```sql
-- Check user's vehicles
SELECT 
  v.registration_plate,
  v.make,
  v.model,
  dic.policy_expiry,
  dic.insurer_name,
  vo.created_at
FROM vehicle_ownerships vo
JOIN vehicles v ON v.id = vo.vehicle_id
LEFT JOIN driver_insurance_certificates dic ON dic.id = vo.insurance_certificate_id
WHERE vo.user_id = '<user_uuid>'
  AND vo.is_current = TRUE;

-- Check pending OCR queue
SELECT 
  id,
  status,
  attempts,
  last_error,
  created_at
FROM insurance_media_queue
WHERE profile_id = '<user_uuid>'
ORDER BY created_at DESC
LIMIT 5;
```

## 🔄 Rollback Plan

If issues arise, you can rollback:

### Option 1: Redeploy Previous Version
```bash
# Get previous deployment
supabase functions list --show-versions

# Rollback to previous version
supabase functions deploy wa-webhook-profile --version <previous-version>
```

### Option 2: Temporarily Disable Vehicle Feature
Edit `wa-webhook-profile/index.ts`:
```typescript
// Temporarily disable vehicle features
else if (id === IDS.MY_VEHICLES || id === "MY_VEHICLES" || id === "my_vehicles") {
  await sendText(ctx.from, "🚗 Vehicle management is temporarily unavailable. Please try again later.");
  handled = true;
}
```

Then redeploy:
```bash
supabase functions deploy wa-webhook-profile
```

## ✅ Post-Deployment Checklist

- [ ] Environment variables verified
- [ ] Database schema up to date
- [ ] Function deployed successfully
- [ ] Health check returns 200 OK
- [ ] Test Case 1 (empty list) ✓
- [ ] Test Case 2 (add vehicle) ✓
- [ ] Test Case 3 (expired insurance) ✓
- [ ] Test Case 4 (unreadable document) ✓
- [ ] Test Case 5 (view details) ✓
- [ ] Monitoring dashboards configured
- [ ] Alerts set up
- [ ] Team notified of changes

## 📞 Support

If you encounter issues:

1. **Check Logs**: `supabase functions logs wa-webhook-profile --tail`
2. **Review Documentation**: `VEHICLE_MANAGEMENT_IMPLEMENTATION.md`
3. **Database State**: Run diagnostic queries above
4. **Contact**: Escalate to platform team with:
   - User ID
   - Timestamp of issue
   - Error logs
   - Steps to reproduce

## 🎉 Success Criteria

Deployment is successful when:
- ✅ Users can view their vehicles list
- ✅ Users can add vehicles by uploading insurance certificates
- ✅ OCR successfully extracts vehicle details
- ✅ Expired insurance is rejected with clear message
- ✅ Unreadable documents are queued for manual review
- ✅ Users receive clear, actionable messages at each step
- ✅ No references to "AI Agent" remain
- ✅ All database operations complete successfully

---

**Deployment Date**: _____________

**Deployed By**: _____________

**Issues Encountered**: _____________

**Resolution**: _____________
