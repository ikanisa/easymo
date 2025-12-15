# wa-webhook-insurance

Simple insurance workflow edge function.

## Purpose

Provides WhatsApp links to insurance agents when users tap "Insurance" from the home menu.

**Simple workflow:**
1. User taps "Insurance" on home menu
2. Function queries `insurance_admin_contacts` table for active WhatsApp contacts
3. User receives message with clickable WhatsApp links (wa.me links) to insurance agents
4. User contacts agents directly on WhatsApp

**That's it. No admin panels, no leads tracking, no OCR, no notifications.**

## Database

Uses the `insurance_admin_contacts` table with columns:
- `id` - UUID primary key
- `channel` - Contact channel (should be 'whatsapp')
- `destination` - Phone number in international format (e.g., +250788123456)
- `display_name` - Name to display to users
- `category` - Contact category (should be 'insurance')
- `display_order` - Order to display contacts
- `is_active` - Whether contact is active
- `created_at` - Timestamp
- `updated_at` - Timestamp

## Environment Variables

Required:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-side only)

## Deployment

```bash
# Deploy to staging
supabase functions deploy wa-webhook-insurance --project-ref STAGING_REF

# Deploy to production
supabase functions deploy wa-webhook-insurance --project-ref PROD_REF
```

## Testing

```bash
# Test locally
supabase functions serve wa-webhook-insurance

# Call function
curl -X POST http://localhost:54321/functions/v1/wa-webhook-insurance \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

## Response Format

Success:
```json
{
  "success": true,
  "message": "🛡️ *Insurance Services*\n\nContact our insurance agents directly on WhatsApp:\n\n• Agent Name: https://wa.me/250788123456\n\nTap any link above to start chatting with an insurance agent.",
  "contactCount": 1
}
```

Error (no contacts):
```json
{
  "error": "No insurance contacts available",
  "message": "Please try again later or contact support."
}
```

Error (other):
```json
{
  "error": "Internal server error"
}
```

## Observability

The function logs structured events:
- `INSURANCE_REQUEST_START` - Request received
- `INSURANCE_SUCCESS` - Successfully returned contacts
- `INSURANCE_NO_CONTACTS` - No active contacts found
- `INSURANCE_DB_ERROR` - Database query error
- `INSURANCE_CONFIG_ERROR` - Missing configuration
- `INSURANCE_ERROR` - Unexpected error
