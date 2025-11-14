# Quick Deploy Guide - Insurance Admin Notifications

## 🚀 One-Command Deploy

```bash
# Deploy everything
supabase db push && \
supabase functions deploy insurance-ocr && \
supabase functions deploy wa-webhook && \
supabase functions deploy ocr-processor
```

## ✅ Verify Deployment

```bash
# Check admin table (should return 3 rows)
supabase db execute "SELECT wa_id, name, is_active FROM insurance_admins;"

# Expected output:
#     wa_id      |      name          | is_active
# ---------------+--------------------+-----------
# 250793094876  | Insurance Admin 1  |     t
# 250788767816  | Insurance Admin 2  |     t
# 250795588248  | Insurance Admin 3  |     t
```

## 🧪 Test Flow

1. **Send test certificate via WhatsApp** to your business number
2. **User should receive:** Summary of extracted data
3. **Admins should receive:**
   - Full certificate details
   - Vehicle information
   - Policy dates
   - Customer WhatsApp link: `https://wa.me/[customer_number]`

## 📊 Monitor Notifications

```sql
-- Check recent notifications
SELECT 
  ian.lead_id,
  ia.name as admin_name,
  ian.user_wa_id as customer,
  ian.status,
  ian.sent_at
FROM insurance_admin_notifications ian
JOIN insurance_admins ia ON ia.wa_id = ian.admin_wa_id
ORDER BY ian.sent_at DESC
LIMIT 10;
```

## 🔧 Admin Management

### Add Admin
```sql
INSERT INTO insurance_admins (wa_id, name, role, is_active)
VALUES ('250XXXXXXXXX', 'New Admin Name', 'admin', true);
```

### Deactivate Admin
```sql
UPDATE insurance_admins 
SET is_active = false 
WHERE wa_id = '250XXXXXXXXX';
```

### Reactivate Admin
```sql
UPDATE insurance_admins 
SET is_active = true 
WHERE wa_id = '250XXXXXXXXX';
```

## 📞 Current Admins

| Number         | Name              | Status |
|----------------|-------------------|--------|
| +250793094876  | Insurance Admin 1 | Active |
| +250788767816  | Insurance Admin 2 | Active |
| +250795588248  | Insurance Admin 3 | Active |

## 🐛 Troubleshooting

### No notifications received?

1. **Check admin table:**
   ```sql
   SELECT * FROM insurance_admins WHERE is_active = true;
   ```

2. **Check notification queue:**
   ```sql
   SELECT * FROM notifications 
   WHERE notification_type = 'insurance_admin_alert'
   ORDER BY created_at DESC LIMIT 5;
   ```

3. **Check admin notification log:**
   ```sql
   SELECT * FROM insurance_admin_notifications 
   ORDER BY sent_at DESC LIMIT 5;
   ```

4. **Check function logs:**
   ```bash
   supabase functions logs insurance-ocr
   supabase functions logs wa-webhook
   ```

### User not getting summary?

Check insurance handler logs:
```bash
supabase functions logs wa-webhook | grep "INS_"
```

### OCR failing?

Verify OpenAI key:
```bash
supabase secrets list | grep OPENAI
```

## 📋 What Each File Does

| File | Purpose |
|------|---------|
| `20260502000000_insurance_admin_notifications.sql` | Creates tables, inserts admin numbers |
| `ins_admin_notify.ts` | Notification logic & formatting |
| `insurance-ocr/index.ts` | OCR processing + admin alerts |
| `ins_handler.ts` | WhatsApp message handling |
| `ocr-processor/index.ts` | Menu OCR (OpenAI schema fixed) |

## ✅ Success Criteria

- [x] 3 admins configured in database
- [x] User receives OCR summary
- [x] All 3 admins receive detailed notification
- [x] Admin notification includes wa.me link
- [x] Notifications tracked in audit table
- [x] No type errors
- [x] Functions deploy successfully

## 🎯 Expected Behavior

```
User sends certificate photo
              ↓
    OCR extracts data (2-5 seconds)
              ↓
         [PARALLEL]
         ↓        ↓
    User gets   3 Admins get
    summary     detailed alert
    message     + contact link
         ↓
    Complete!
```

## 📞 Support

If issues persist:
1. Check logs: `supabase functions logs [function-name]`
2. Verify migration applied: `SELECT * FROM insurance_admins;`
3. Test with simple certificate image
4. Check OpenAI API quota/errors

---

**Status:** Production Ready ✅  
**Last Updated:** 2025-11-14  
**Version:** 1.0.0
