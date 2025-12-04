# Insurance Admin Notifications - Quick Fix Guide

## Problem
Insurance admins not receiving WhatsApp notifications when users submit certificates.

## Root Cause
Missing WhatsApp admin numbers in the database. The system has 3 fallback levels:
1. `insurance_admin_contacts` table (EMPTY ❌)
2. `insurance_admins` table (EMPTY ❌)  
3. Environment variable `INSURANCE_ADMIN_FALLBACK_WA_IDS` (NOT SET ❌)

## Quick Fix (5 Minutes)

### Option 1: Automated Script
```bash
./scripts/setup-insurance-admin-notifications.sh
```
Follow prompts to add admin WhatsApp numbers.

### Option 2: Manual Setup

#### Step 1: Add Admin Numbers to Database
```sql
-- Insert insurance admin contacts
INSERT INTO insurance_admin_contacts (
    contact_type,
    contact_value,
    display_name,
    display_order,
    is_active
) VALUES 
    ('whatsapp', '+250788123456', 'Insurance Admin 1', 1, true),
    ('whatsapp', '+250789654321', 'Insurance Admin 2', 2, true);
```

Execute:
```bash
supabase db execute < admin_contacts.sql
```

#### Step 2: Set Fallback Environment Variable
```bash
supabase secrets set INSURANCE_ADMIN_FALLBACK_WA_IDS="+250788123456,+250789654321"
```

#### Step 3: Deploy Function
```bash
supabase functions deploy send-insurance-admin-notifications --no-verify-jwt
```

## How It Works

### When User Submits Certificate:
```
1. User sends insurance certificate image via WhatsApp
2. insurance-ocr function extracts data
3. notifyInsuranceAdmins() is called
4. System resolves admin contacts (3-tier fallback):
   ├─ insurance_admin_contacts (WhatsApp type, active=true) [PRIORITY 1]
   ├─ insurance_admins (is_active=true) [PRIORITY 2]
   └─ INSURANCE_ADMIN_FALLBACK_WA_IDS env var [PRIORITY 3]
5. For each admin:
   ├─ Sends WhatsApp message immediately (sendText)
   ├─ Records to insurance_admin_notifications table
   └─ Queues to notifications table (status='sent' or 'queued')
6. send-insurance-admin-notifications function processes queue
```

### Notification Message Format:
```
🔔 *New Insurance Certificate Submitted*

📋 *Certificate Details:*
• Insurer: Example Insurance Co.
• Policy Number: POL-123456
• Certificate Number: CERT-789
• Registration Plate: RAB-123A

📅 *Policy Dates:*
• Inception: 2024-01-01
• Expiry: 2025-01-01

🚗 *Vehicle Information:*
• Make: Toyota
• Model: Corolla
• Year: 2020

👤 *Customer Contact:*
• WhatsApp: https://wa.me/250788999888
• Direct: wa.me/250788999888

💬 *Click the link above to contact the customer directly*
```

## Verification

### Check Admin Contacts
```sql
SELECT * FROM insurance_admin_contacts WHERE is_active = true;
```

### Check Notification Queue
```sql
SELECT 
    status, 
    COUNT(*) 
FROM notifications 
WHERE notification_type = 'insurance_admin_alert'
GROUP BY status;
```

### Check Recent Notifications
```sql
SELECT 
    ian.admin_wa_id,
    ian.user_wa_id,
    ian.status,
    ian.sent_at,
    ian.created_at
FROM insurance_admin_notifications ian
ORDER BY ian.created_at DESC
LIMIT 10;
```

### Test Notification Manually
```bash
curl -X POST https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/send-insurance-admin-notifications
```

### Monitor Logs
1. Go to Supabase Dashboard
2. Functions → send-insurance-admin-notifications → Logs
3. Look for:
   - `INSURANCE_ADMIN_NOTIFICATION_START`
   - `NOTIFICATIONS_FETCHED`
   - `NOTIFICATION_SENT`

## Current Status

### Database Tables
- ✅ `notifications` - Created by migration 20251204160000
- ✅ `insurance_admin_notifications` - Created by migration 20251204160000

### Edge Functions
- ✅ `send-insurance-admin-notifications` - Deployed
- ✅ Enhanced logging for debugging

### Configuration Needed
- ⚠️ Admin WhatsApp numbers (use script or manual method above)

## Admin Number Format
- **Must include country code**: `+250788123456`
- **Rwanda format**: `+2507XXXXXXXX` (10 digits after +250)
- **International**: Any valid E.164 format

## Troubleshooting

### Admins Not Receiving Notifications?

1. **Check database has admin contacts:**
   ```sql
   SELECT COUNT(*) FROM insurance_admin_contacts 
   WHERE contact_type = 'whatsapp' AND is_active = true;
   ```
   Expected: > 0

2. **Check notifications are being queued:**
   ```sql
   SELECT * FROM notifications 
   WHERE notification_type = 'insurance_admin_alert'
   ORDER BY created_at DESC LIMIT 5;
   ```

3. **Check function logs:**
   - Dashboard → Functions → send-insurance-admin-notifications → Logs
   - Look for errors

4. **Verify WhatsApp number format:**
   - Must start with `+` or be valid E.164
   - Must be 10-15 digits

5. **Test admin number manually:**
   ```sql
   SELECT * FROM insurance_admin_contacts 
   WHERE contact_value = '+250788123456';
   ```

### No Records in Queue?

The `notifyInsuranceAdmins()` function sends immediately AND queues. Check:
```sql
SELECT * FROM insurance_admin_notifications 
ORDER BY created_at DESC LIMIT 5;
```

If empty, the notification function was never called. Check:
- insurance-ocr function is working
- OCR extraction is successful
- notifyInsuranceAdmins() is being invoked

## Monitoring Dashboard

Create this view for easy monitoring:
```sql
CREATE OR REPLACE VIEW insurance_notification_status AS
SELECT 
    DATE(created_at) as date,
    status,
    COUNT(*) as count
FROM insurance_admin_notifications
GROUP BY DATE(created_at), status
ORDER BY date DESC, status;
```

Query:
```sql
SELECT * FROM insurance_notification_status WHERE date >= CURRENT_DATE - 7;
```

## Next Steps

1. ✅ Run setup script: `./scripts/setup-insurance-admin-notifications.sh`
2. ✅ Test with real insurance certificate upload
3. ✅ Verify admin receives WhatsApp message
4. ⏭️ Set up cron job for `send-insurance-admin-notifications` (every 5 min)
5. ⏭️ Monitor notification delivery rate
6. ⏭️ Set up alerting for failed notifications

## Support

**Files:**
- Setup: `scripts/setup-insurance-admin-notifications.sh`
- Notification Logic: `supabase/functions/_shared/wa-webhook-shared/domains/insurance/ins_admin_notify.ts`
- Queue Processor: `supabase/functions/send-insurance-admin-notifications/index.ts`
- Migration: `supabase/migrations/20251204160000_add_insurance_admin_notifications.sql`

**Admin Dashboard:**
https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt
