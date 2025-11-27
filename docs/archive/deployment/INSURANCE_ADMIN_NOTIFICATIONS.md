# Insurance Admin Notifications System

## Overview

When a user submits an insurance certificate via WhatsApp, the system:
1. Extracts certificate details using OCR (OpenAI Vision)
2. Sends detailed information to the **user** (confirmation)
3. Sends **same information + user's WhatsApp contact** to all **insurance admins**

This allows admins to:
- Monitor all insurance certificate submissions in real-time
- Contact users directly via WhatsApp
- Track policy details and expirations
- Manage customer relationships

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER SUBMITS CERTIFICATE                     │
│                     (WhatsApp Image Message)                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                   insurance-ocr Edge Function                    │
│  • Downloads image from WhatsApp                                 │
│  • Runs OpenAI Vision OCR                                        │
│  • Extracts: policy #, insurer, dates, vehicle details           │
│  • Normalizes extracted data                                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                  ┌──────────┴──────────┐
                  │                     │
                  ↓                     ↓
    ┌─────────────────────┐   ┌─────────────────────┐
    │  Send to USER       │   │  Send to ALL ADMINS │
    │  (Confirmation)     │   │  (Alert + Contact)  │
    └─────────────────────┘   └──────────┬──────────┘
                                         │
                                         ↓
                        ┌────────────────────────────────┐
                        │  insurance_admins table        │
                        │  • +250788767816 (Admin 1)     │
                        │  • +250793094876 (Admin 2)     │
                        │  • +250795588248 (Admin 3)     │
                        └────────────────────────────────┘
                                         │
                                         ↓
                        ┌────────────────────────────────┐
                        │  notifications table (queued)  │
                        │  → Processed by notification-  │
                        │     worker to send WhatsApp    │
                        └────────────────────────────────┘
```

---

## Database Tables

### 1. `insurance_admins`

Stores admin phone numbers who receive certificate alerts.

```sql
CREATE TABLE insurance_admins (
  id uuid PRIMARY KEY,
  wa_id text UNIQUE NOT NULL,              -- WhatsApp phone (e.g., '250788767816')
  name text NOT NULL,                      -- Admin name
  role text DEFAULT 'admin',               -- Role (admin, supervisor, etc.)
  is_active boolean DEFAULT true,          -- Active/inactive
  receives_all_alerts boolean DEFAULT true, -- Receive all notifications
  notification_preferences jsonb,          -- Custom preferences
  total_notifications_sent integer,        -- Stats counter
  last_notified_at timestamptz,           -- Last notification time
  created_at timestamptz,
  updated_at timestamptz
);
```

**Current Admins:**
- `+250788767816` - Insurance Admin 1
- `+250793094876` - Insurance Admin 2
- `+250795588248` - Insurance Admin 3

### 2. `insurance_admin_notifications`

Tracks every notification sent to admins.

```sql
CREATE TABLE insurance_admin_notifications (
  id uuid PRIMARY KEY,
  lead_id uuid REFERENCES insurance_leads(id),
  admin_wa_id text REFERENCES insurance_admins(wa_id),
  user_wa_id text NOT NULL,                -- User's WhatsApp for contact
  notification_payload jsonb NOT NULL,     -- Full message + extracted data
  status text DEFAULT 'queued',            -- queued → sent → delivered → read
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  error_message text,
  retry_count integer DEFAULT 0,
  created_at timestamptz,
  updated_at timestamptz
);
```

---

## Admin Notification Message Format

When a certificate is submitted, each admin receives this message:

```
🔔 *New Insurance Certificate Submitted*

📋 *Certificate Details:*
• Insurer: SORAS Rwanda
• Policy Number: POL/2024/12345
• Certificate Number: CERT/456789
• Registration Plate: RAD 123 A
• VIN/Chassis: 1HGBH41JXMN109876

📅 *Policy Dates:*
• Inception: 2024-01-15
• Expiry: 2025-01-15

🚗 *Vehicle Information:*
• Make: Toyota
• Model: RAV4
• Year: 2023
• VIN: 1HGBH41JXMN109876

👤 *Customer Contact:*
• WhatsApp: https://wa.me/250788123456
• Direct: wa.me/250788123456

💬 *Click the link above to contact the customer directly*
```

**Key Features:**
- ✅ All extracted certificate details
- ✅ Customer's WhatsApp number (clickable link)
- ✅ Direct wa.me link for easy contact
- ✅ Formatted for mobile viewing

---

## Implementation Details

### Code Flow

1. **OCR Processing** (`insurance-ocr/index.ts`):
   ```typescript
   // After successful OCR extraction
   if (row.wa_id) {
     const notifyResult = await notifyInsuranceAdmins(client, {
       leadId,
       userWaId: row.wa_id,
       extracted: normalized,
       documentUrl: signedUrl,
     });
   }
   ```

2. **Admin Notification Function** (`ins_admin_notify.ts`):
   ```typescript
   export async function notifyInsuranceAdmins(
     client: SupabaseClient,
     payload: AdminNotificationPayload
   ): Promise<{ sent: number; failed: number; errors: string[] }> {
     // 1. Fetch active admins
     const { data: admins } = await client
       .from("insurance_admins")
       .select("wa_id, name")
       .eq("is_active", true);

     // 2. Format message with extracted data + user contact
     const message = formatAdminNotificationMessage(
       extracted,
       userWaId
     );

     // 3. Queue notification for each admin
     for (const admin of admins) {
       await client.from("notifications").insert({
         to_wa_id: admin.wa_id,
         notification_type: "insurance_admin_alert",
         payload: { text: message, lead_id: leadId, ... },
         status: "queued"
       });

       // 4. Track in insurance_admin_notifications
       await client.from("insurance_admin_notifications").insert({
         lead_id: leadId,
         admin_wa_id: admin.wa_id,
         user_wa_id: userWaId,
         notification_payload: { message, extracted },
         status: "queued"
       });
     }

     return { sent, failed, errors };
   }
   ```

3. **Notification Worker** (`notification-worker` Edge Function):
   - Picks up queued notifications from `notifications` table
   - Sends via WhatsApp Cloud API
   - Updates status: `queued` → `sent` → `delivered`
   - Triggers update on `insurance_admin_notifications` table

---

## Managing Admins

### Add New Admin

```sql
INSERT INTO insurance_admins (wa_id, name, role, is_active, receives_all_alerts)
VALUES ('250788999888', 'New Admin Name', 'admin', true, true);
```

### Deactivate Admin (stops receiving alerts)

```sql
UPDATE insurance_admins
SET is_active = false
WHERE wa_id = '250788767816';
```

### Reactivate Admin

```sql
UPDATE insurance_admins
SET is_active = true
WHERE wa_id = '250788767816';
```

### View Admin Performance

```sql
SELECT * FROM insurance_admin_performance
ORDER BY total_notifications_sent DESC;
```

Output:
```
    wa_id     |       name        | notifications_sent | notifications_delivered | last_notification_time
--------------+-------------------+--------------------+-------------------------+------------------------
 250788767816 | Insurance Admin 1 |                 45 |                      42 | 2024-11-15 12:30:00
 250793094876 | Insurance Admin 2 |                 45 |                      43 | 2024-11-15 12:30:00
 250795588248 | Insurance Admin 3 |                 45 |                      40 | 2024-11-15 12:30:00
```

---

## Monitoring & Troubleshooting

### Check Recent Admin Notifications

```sql
SELECT 
  n.created_at,
  a.name as admin_name,
  n.admin_wa_id,
  n.user_wa_id,
  n.status,
  n.sent_at,
  n.delivered_at,
  n.error_message
FROM insurance_admin_notifications n
JOIN insurance_admins a ON n.admin_wa_id = a.wa_id
ORDER BY n.created_at DESC
LIMIT 10;
```

### Check Failed Notifications

```sql
SELECT 
  admin_wa_id,
  user_wa_id,
  status,
  error_message,
  retry_count,
  created_at
FROM insurance_admin_notifications
WHERE status = 'failed'
ORDER BY created_at DESC;
```

### Check Admin Notification Queue

```sql
SELECT 
  COUNT(*) as queued_count,
  admin_wa_id
FROM insurance_admin_notifications
WHERE status = 'queued'
GROUP BY admin_wa_id;
```

### Retry Failed Notification

```sql
UPDATE insurance_admin_notifications
SET 
  status = 'queued',
  retry_count = retry_count + 1,
  updated_at = now()
WHERE id = 'notification-uuid-here';
```

---

## Testing

### Manual Test: Trigger Admin Notification

```sql
-- Get a recent insurance lead
SELECT id, wa_id FROM insurance_leads ORDER BY created_at DESC LIMIT 1;

-- Manually trigger admin notification
SELECT notifyInsuranceAdmins(
  'lead-id-here'::uuid,
  'user-wa-id-here',
  extracted_json
)
FROM insurance_leads
WHERE id = 'lead-id-here'::uuid;
```

### Test with cURL (Edge Function)

```bash
curl -X POST "https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/insurance-ocr" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## Configuration

### Environment Variables

No additional env vars needed. System uses:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key
- `OPENAI_API_KEY` - For OCR extraction

### Notification Preferences (Per Admin)

```sql
-- Customize what notifications an admin receives
UPDATE insurance_admins
SET notification_preferences = '{
  "certificate_submitted": true,
  "policy_expiring": true,
  "verification_needed": false
}'::jsonb
WHERE wa_id = '250788767816';
```

---

## Security & Privacy

1. **RLS Policies**: Both tables have Row Level Security enabled
2. **Service Role Only**: Only service role can insert/update
3. **Admin Portal**: Authenticated users can view admins (read-only)
4. **User Privacy**: User's phone number sent only to verified admins
5. **Audit Trail**: All notifications tracked in `insurance_admin_notifications`

---

## Analytics & Reporting

### Daily Admin Notification Stats

```sql
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_notifications,
  COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
  COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
FROM insurance_admin_notifications
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Admin Response Rate

```sql
SELECT 
  a.name,
  COUNT(n.id) as total_notifications,
  COUNT(CASE WHEN n.status = 'delivered' THEN 1 END) as delivered,
  ROUND(100.0 * COUNT(CASE WHEN n.status = 'delivered' THEN 1 END) / COUNT(n.id), 1) as delivery_rate
FROM insurance_admins a
LEFT JOIN insurance_admin_notifications n ON a.wa_id = n.admin_wa_id
WHERE n.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY a.name
ORDER BY total_notifications DESC;
```

---

## Future Enhancements

### Planned Features

1. **Admin Response Tracking**
   - Track when admin contacts user
   - Measure response time
   - Admin performance metrics

2. **Smart Routing**
   - Route to specific admin based on region/insurer
   - Load balancing for high volume
   - Priority admins for urgent cases

3. **Admin Dashboard**
   - Web portal to view all submissions
   - Filter by date, insurer, status
   - Export reports

4. **Two-Way Communication**
   - Admin can reply via system
   - Track conversation history
   - Notes and follow-up reminders

---

## Support

### Quick Reference

**Current Admins:**
- +250788767816 (Admin 1)
- +250793094876 (Admin 2)
- +250795588248 (Admin 3)

**Key Tables:**
- `insurance_admins` - Admin phone numbers
- `insurance_admin_notifications` - Notification tracking
- `insurance_leads` - Certificate data
- `notifications` - WhatsApp queue

**Key Functions:**
- `notifyInsuranceAdmins()` - Send to all admins
- `get_active_insurance_admins()` - List active admins
- `insurance_admin_performance` - Stats view

**Edge Functions:**
- `insurance-ocr` - Processes certificates, triggers admin notifications
- `notification-worker` - Sends queued notifications via WhatsApp

---

## Migration Applied

✅ **Migration File**: `20251115124600_insurance_admin_notifications.sql`

**What it does:**
1. Creates `insurance_admins` table
2. Creates `insurance_admin_notifications` table
3. Adds 3 default admins (your numbers)
4. Sets up triggers for stats tracking
5. Creates performance view
6. Enables RLS policies

**Status**: ✅ Applied successfully to production database

---

## Summary

✅ **System is now operational**
- All insurance certificate submissions trigger admin notifications
- 3 admins configured and active
- Each admin receives:
  - Full certificate details
  - Customer's WhatsApp contact (clickable link)
  - Ability to message customer directly
- Full audit trail maintained
- Performance tracking enabled

**Next Steps:**
1. Test by submitting an insurance certificate via WhatsApp
2. Verify all 3 admins receive notification
3. Monitor `insurance_admin_notifications` table for delivery status
4. Add more admins as needed
