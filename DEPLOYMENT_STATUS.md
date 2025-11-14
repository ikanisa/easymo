# Deployment Status - Insurance Admin Notifications

**Date:** 2025-11-14  
**Time:** 11:15 UTC  
**Project:** lhbowpbcpwoiparwnwgt

## ✅ Edge Functions Deployed

| Function | Status | Size | Dashboard Link |
|----------|--------|------|----------------|
| **insurance-ocr** | ✅ Deployed | 116.4 KB | [View](https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/functions) |
| **wa-webhook** | ✅ Deployed | - | [View](https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/functions) |
| **ocr-processor** | ✅ Deployed | - | [View](https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/functions) |

## ⚠️ Database Migration - Action Required

The database migration needs to be applied manually via the Supabase SQL Editor:

### Steps to Apply Migration:

1. **Open SQL Editor:**
   - Go to: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/sql/new

2. **Copy Migration SQL:**
   - File: `supabase/migrations/20260502000000_insurance_admin_notifications.sql`
   - Or use the SQL below

3. **Execute in SQL Editor:**
   ```sql
   BEGIN;

   -- Insurance admin table for notification recipients
   CREATE TABLE IF NOT EXISTS insurance_admins (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     wa_id TEXT NOT NULL UNIQUE,
     name TEXT,
     role TEXT DEFAULT 'admin',
     is_active BOOLEAN DEFAULT true,
     created_at TIMESTAMPTZ DEFAULT now(),
     updated_at TIMESTAMPTZ DEFAULT now()
   );

   -- Index for active admin lookup
   CREATE INDEX IF NOT EXISTS idx_insurance_admins_active 
     ON insurance_admins(is_active) WHERE is_active = true;

   -- Insert the three admin numbers
   INSERT INTO insurance_admins (wa_id, name, role, is_active)
   VALUES
     ('250793094876', 'Insurance Admin 1', 'admin', true),
     ('250788767816', 'Insurance Admin 2', 'admin', true),
     ('250795588248', 'Insurance Admin 3', 'admin', true)
   ON CONFLICT (wa_id) DO UPDATE
     SET is_active = EXCLUDED.is_active,
         updated_at = now();

   -- Track admin notifications sent
   CREATE TABLE IF NOT EXISTS insurance_admin_notifications (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     lead_id UUID NOT NULL REFERENCES insurance_leads(id) ON DELETE CASCADE,
     admin_wa_id TEXT NOT NULL,
     user_wa_id TEXT NOT NULL,
     notification_payload JSONB,
     sent_at TIMESTAMPTZ DEFAULT now(),
     status TEXT DEFAULT 'sent',
     error_message TEXT
   );

   -- Indexes for tracking
   CREATE INDEX IF NOT EXISTS idx_insurance_admin_notifications_lead 
     ON insurance_admin_notifications(lead_id);
   CREATE INDEX IF NOT EXISTS idx_insurance_admin_notifications_admin 
     ON insurance_admin_notifications(admin_wa_id);
   CREATE INDEX IF NOT EXISTS idx_insurance_admin_notifications_sent 
     ON insurance_admin_notifications(sent_at DESC);

   -- Function to get active insurance admins
   CREATE OR REPLACE FUNCTION get_active_insurance_admins()
   RETURNS TABLE (wa_id TEXT, name TEXT, role TEXT) AS $$
   BEGIN
     RETURN QUERY
     SELECT ia.wa_id, ia.name, ia.role
     FROM insurance_admins ia
     WHERE ia.is_active = true
     ORDER BY ia.created_at;
   END;
   $$ LANGUAGE plpgsql STABLE;

   COMMENT ON TABLE insurance_admins IS 'WhatsApp numbers of insurance backend staff who receive certificate notifications';
   COMMENT ON TABLE insurance_admin_notifications IS 'Tracks notifications sent to insurance admins with extracted certificate data';
   COMMENT ON FUNCTION get_active_insurance_admins IS 'Returns list of active insurance admin WhatsApp IDs for notifications';

   COMMIT;
   ```

4. **Verify Migration:**
   ```sql
   -- Should return 3 rows
   SELECT * FROM insurance_admins;
   ```

## 🔍 Verification Steps

Once migration is applied:

### 1. Check Admin Table
```sql
SELECT wa_id, name, is_active 
FROM insurance_admins 
WHERE is_active = true;
```

**Expected:** 3 rows with phone numbers

### 2. Test Notification Flow
- Send insurance certificate image via WhatsApp
- User should receive summary message
- All 3 admins should receive detailed notification with customer contact link

### 3. Monitor Notifications
```sql
SELECT 
  ian.*,
  ia.name as admin_name
FROM insurance_admin_notifications ian
JOIN insurance_admins ia ON ia.wa_id = ian.admin_wa_id
ORDER BY ian.sent_at DESC
LIMIT 5;
```

### 4. Check Function Logs
```bash
supabase functions logs insurance-ocr --limit 50
supabase functions logs wa-webhook --limit 50
```

## 📊 Implementation Summary

### What's Live:

✅ **ins_admin_notify.ts** - Admin notification module  
✅ **insurance-ocr/index.ts** - OCR processor with admin alerts  
✅ **ins_handler.ts** - WhatsApp handler with admin notifications  
✅ **ocr-processor/index.ts** - Menu OCR (OpenAI schema fixed)

### What's Pending:

⏳ **Database Migration** - Requires manual SQL execution

### Admin Numbers Configured:

1. **+250793094876** - Insurance Admin 1
2. **+250788767816** - Insurance Admin 2
3. **+250795588248** - Insurance Admin 3

## 🎯 Expected Behavior

When a user submits an insurance certificate via WhatsApp:

```
1. User sends certificate photo
              ↓
2. OCR extracts certificate data (2-5 sec)
              ↓
3. User receives summary message
              ↓
4. PARALLEL: 3 admins receive:
   - Complete certificate details
   - Policy information
   - Vehicle details
   - Customer WhatsApp link: https://wa.me/[number]
              ↓
5. Admin clicks link → Direct WhatsApp chat with customer
```

## 📱 Admin Notification Format

```
🔔 *New Insurance Certificate Submitted*

📋 *Certificate Details:*
• Insurer: [Name]
• Policy Number: [Number]
• Certificate Number: [Number]
• Registration Plate: [Plate]
• VIN/Chassis: [VIN]

📅 *Policy Dates:*
• Inception: [Date]
• Expiry: [Date]

🚗 *Vehicle Information:*
• Make: [Make]
• Model: [Model]
• Year: [Year]
• VIN: [VIN]

👤 *Customer Contact:*
• WhatsApp: https://wa.me/[customer_number]
• Direct: wa.me/[customer_number]

💬 *Click the link above to contact the customer directly*
```

## 🔧 Admin Management (After Migration)

### Add New Admin:
```sql
INSERT INTO insurance_admins (wa_id, name, role, is_active)
VALUES ('250XXXXXXXXX', 'Admin Name', 'admin', true);
```

### Deactivate Admin:
```sql
UPDATE insurance_admins 
SET is_active = false 
WHERE wa_id = '250XXXXXXXXX';
```

### View Delivery Stats:
```sql
SELECT 
  ia.name,
  COUNT(*) as total_notifications,
  COUNT(*) FILTER (WHERE ian.status = 'sent') as successful,
  COUNT(*) FILTER (WHERE ian.status = 'failed') as failed
FROM insurance_admin_notifications ian
JOIN insurance_admins ia ON ia.wa_id = ian.admin_wa_id
WHERE ian.sent_at > now() - interval '7 days'
GROUP BY ia.name
ORDER BY total_notifications DESC;
```

## 🐛 Troubleshooting

### No Notifications Received?

1. **Check if migration applied:**
   ```sql
   SELECT COUNT(*) FROM insurance_admins;
   -- Should return 3
   ```

2. **Check notification queue:**
   ```sql
   SELECT * FROM notifications 
   WHERE notification_type = 'insurance_admin_alert'
   ORDER BY created_at DESC LIMIT 10;
   ```

3. **Check function logs:**
   ```bash
   supabase functions logs insurance-ocr | grep "admin_notify"
   ```

### User Not Getting Summary?

```bash
supabase functions logs wa-webhook | grep "INS_"
```

### OCR Errors?

Check OpenAI configuration:
```bash
supabase secrets list | grep OPENAI_API_KEY
```

## 📞 Support & Documentation

- **Full Documentation:** `INSURANCE_ADMIN_NOTIFICATIONS_COMPLETE.md`
- **Quick Guide:** `QUICK_DEPLOY_GUIDE.md`
- **Implementation Summary:** `IMPLEMENTATION_SUMMARY.md`
- **Dashboard:** https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt

---

## ✅ Next Steps

1. **Apply Database Migration** (see SQL above)
2. **Verify** admin table has 3 records
3. **Test** end-to-end flow with certificate image
4. **Monitor** notification delivery via queries above

**Status:** Functions Deployed ✅ | Migration Pending ⏳  
**Ready for:** Production testing after migration
