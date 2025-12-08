# Help & Support - Quick Reference

## User Commands
Type any of these to get support contact info:
- `help`
- `support`
- `assist`
- `contact`
- `help me`
- `need help`
- `customer service`

## Current Support Contacts
- **Team 1:** +250795588248
- **Team 2:** +250793094876

## Admin: Add/Update Contacts

### Add New Contact
```sql
INSERT INTO insurance_admin_contacts (
  contact_type, contact_value, display_name, is_active, display_order
) VALUES (
  'whatsapp', '+250XXXXXXXXX', 'Support Team Name', true, 1
);
```

### Update Contact
```sql
UPDATE insurance_admin_contacts
SET contact_value = '+250XXXXXXXXX'
WHERE display_name = 'Insurance Support Team 1';
```

### Deactivate
```sql
UPDATE insurance_admin_contacts SET is_active = false
WHERE display_name = 'Insurance Support Team 1';
```

## Files
- Handler: `supabase/functions/wa-webhook-core/handlers/help-support.ts`
- Router: `supabase/functions/wa-webhook-core/router.ts` (line 488-498)
- Docs: `HELP_SUPPORT_DEPLOYMENT.md`

## Deployment
```bash
supabase functions deploy wa-webhook-core --project-ref lhbowpbcpwoiparwnwgt
```

## Status: ✅ LIVE (v795)
