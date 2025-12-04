# Insurance Admin Notifications - Quick Reference

**Last Updated:** December 4, 2025, 17:25 UTC  
**Status:** ✅ WORKING

---

## Quick Commands

### View Admins
```sql
SELECT contact_value, display_name, is_active 
FROM insurance_admin_contacts 
WHERE contact_type = 'whatsapp';
```

### Add Admin
```sql
INSERT INTO insurance_admin_contacts (contact_type, contact_value, display_name, display_order, is_active)
VALUES ('whatsapp', '+250XXXXXXXXX', 'Admin Name', 4, true);
```

### Remove Admin
```sql
UPDATE insurance_admin_contacts SET is_active = false WHERE contact_value = '+250XXXXXXXXX';
```

### Check Recent Notifications
```sql
SELECT admin_wa_id, status, created_at 
FROM insurance_admin_notifications 
ORDER BY created_at DESC LIMIT 10;
```

---

## ⚠️ Critical: WhatsApp 24-Hour Window

**Admins MUST message your WhatsApp Business number first!**

If admin not receiving notifications:
1. Have admin send ANY message to your WhatsApp number
2. Re-submit insurance certificate
3. Admin should receive notification within seconds

---

## Troubleshooting

**Admins not receiving notifications?**
1. Check logs: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/functions/insurance-ocr/logs
2. Search for: `WA_MESSAGE_SENT`
3. If present → WhatsApp delivered, admin needs to initiate contact
4. If missing → Code issue, check error logs

**Check notification delivery:**
```sql
SELECT admin_wa_id, COUNT(*) as total, MAX(created_at) as last_notification
FROM insurance_admin_notifications
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY admin_wa_id;
```

---

## Key Points

✅ All admins notified **concurrently** (no primary/secondary)  
✅ Dynamic list from database (no hardcoded numbers)  
✅ Admins MUST initiate contact first (WhatsApp policy)  
✅ Phone numbers in E.164 format: `+250XXXXXXXXX`  
✅ Full audit trail in `insurance_admin_notifications`  

---

## Documentation

- **Complete Guide:** `docs/INSURANCE_ADMIN_NOTIFICATIONS_README.md`
- **Implementation:** `CONCURRENT_ADMIN_NOTIFICATIONS.md`
- **WhatsApp Issues:** `WHATSAPP_ADMIN_DELIVERY_ISSUE.md`
- **Deployment:** `DEPLOYMENT_COMPLETE_2025_12_04.md`

---

**Current Admins:** 3 active  
**Notifications:** Sent concurrently in 1-2 seconds  
**Status:** ✅ All working as expected
