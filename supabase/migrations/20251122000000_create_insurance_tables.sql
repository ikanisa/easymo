-- Create insurance_leads table
CREATE TABLE IF NOT EXISTS public.insurance_leads (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    whatsapp text,
    status text DEFAULT 'received',
    file_path text,
    raw_ocr jsonb,
    extracted jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create insurance_media table
CREATE TABLE IF NOT EXISTS public.insurance_media (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id uuid REFERENCES public.insurance_leads(id) ON DELETE CASCADE,
    wa_media_id text,
    storage_path text,
    mime_type text,
    created_at timestamptz DEFAULT now()
);

-- Create insurance_quotes table
CREATE TABLE IF NOT EXISTS public.insurance_quotes (
    id uuid PRIMARY KEY REFERENCES public.insurance_leads(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    uploaded_docs text[],
    insurer text,
    status text DEFAULT 'pending',
    reviewer_comment text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create insurance_admins table
CREATE TABLE IF NOT EXISTS public.insurance_admins (
    wa_id text PRIMARY KEY,
    name text,
    is_active boolean DEFAULT true,
    receives_all_alerts boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- Create insurance_admin_contacts table
CREATE TABLE IF NOT EXISTS public.insurance_admin_contacts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    contact_type text,
    contact_value text,
    display_name text,
    is_active boolean DEFAULT true,
    display_order int DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- Create insurance_admin_notifications table
CREATE TABLE IF NOT EXISTS public.insurance_admin_notifications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id uuid REFERENCES public.insurance_leads(id) ON DELETE CASCADE,
    admin_wa_id text,
    user_wa_id text,
    notification_payload jsonb,
    status text DEFAULT 'queued',
    created_at timestamptz DEFAULT now()
);

-- Create insurance_media_queue table
CREATE TABLE IF NOT EXISTS public.insurance_media_queue (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    wa_id text,
    storage_path text,
    mime_type text,
    caption text,
    status text DEFAULT 'queued',
    lead_id uuid REFERENCES public.insurance_leads(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.insurance_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_admin_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_admin_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_media_queue ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies (allow service role full access, others read-only or specific access as needed)
-- For simplicity in this migration, we'll allow service role bypass (which is default) and add specific policies if needed.
-- Assuming the webhook uses service role key, it will bypass RLS.

-- Grant permissions
GRANT ALL ON public.insurance_leads TO service_role;
GRANT ALL ON public.insurance_media TO service_role;
GRANT ALL ON public.insurance_quotes TO service_role;
GRANT ALL ON public.insurance_admins TO service_role;
GRANT ALL ON public.insurance_admin_contacts TO service_role;
GRANT ALL ON public.insurance_admin_notifications TO service_role;
GRANT ALL ON public.insurance_media_queue TO service_role;

-- Notifications table might already exist, check before creating or altering
-- Assuming 'notifications' table exists from previous context, if not, it should be created.
-- Based on ins_admin_notify.ts usage:
-- .from("notifications").insert({ to_wa_id, notification_type, payload, status, retry_count })
CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    to_wa_id text,
    notification_type text,
    payload jsonb,
    status text DEFAULT 'queued',
    retry_count int DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.notifications TO service_role;

-- Create function to sync admins (referenced in ins_admin_notify.ts)
CREATE OR REPLACE FUNCTION public.sync_insurance_admins_from_contacts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.insurance_admins (wa_id, name, is_active, receives_all_alerts)
  SELECT
    contact_value,
    display_name,
    is_active,
    true
  FROM public.insurance_admin_contacts
  WHERE contact_type = 'whatsapp' AND is_active = true
  ON CONFLICT (wa_id) DO UPDATE
  SET name = EXCLUDED.name, is_active = EXCLUDED.is_active;
END;
$$;
