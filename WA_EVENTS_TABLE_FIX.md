# WA-WEBHOOK FIX - URGENT

## Issue Found ✅
```
Error: "Could not find the table 'public.wa_events' in the schema cache"
```

The `wa_events` table is missing from your database.

## IMMEDIATE FIX

### Option 1: Apply via Supabase Dashboard (FASTEST)

1. Go to: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/editor
2. Click "SQL Editor"
3. Paste and run this SQL:

```sql
BEGIN;

CREATE TABLE IF NOT EXISTS public.wa_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  correlation_id TEXT,
  wa_id TEXT,
  phone_number TEXT,
  message_id TEXT,
  conversation_id TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  direction TEXT CHECK (direction IN ('inbound', 'outbound')),
  status TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_wa_events_event_type ON public.wa_events(event_type);
CREATE INDEX IF NOT EXISTS idx_wa_events_wa_id ON public.wa_events(wa_id);
CREATE INDEX IF NOT EXISTS idx_wa_events_message_id ON public.wa_events(message_id);
CREATE INDEX IF NOT EXISTS idx_wa_events_correlation_id ON public.wa_events(correlation_id);
CREATE INDEX IF NOT EXISTS idx_wa_events_created_at ON public.wa_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_events_phone_number ON public.wa_events(phone_number);
CREATE INDEX IF NOT EXISTS idx_wa_events_conversation_id ON public.wa_events(conversation_id);

ALTER TABLE public.wa_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'wa_events' AND policyname = 'svc_rw_wa_events'
  ) THEN
    CREATE POLICY svc_rw_wa_events ON public.wa_events 
      FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON TABLE public.wa_events TO postgres, anon, authenticated, service_role;

COMMIT;
```

### Option 2: Apply via CLI
```bash
supabase db push
```

## After Applying

The wa-webhook will immediately start working. Test with:
```bash
curl https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook/health
```

Should return `200 OK` ✅

## Why This Happened

The `wa_events` table was part of pending migrations that weren't applied due to connection issues. This table is critical for WhatsApp webhook event logging.

## Status
- ✅ Migration file created: `20251120080700_create_wa_events_table.sql`
- ✅ Committed to repository
- ⏳ **Needs to be applied to database** (use Option 1 above)

---

**ETA to fix: 30 seconds** (just run the SQL above in Supabase Dashboard)
