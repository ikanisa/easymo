-- Migration: NFC Reference Management
-- Description: NDEF tag data for group reference tokens, tap-to-copy, offline support
-- Date: 2025-10-31

-- NFC tag registrations (for NDEF tags with group references)
CREATE TABLE IF NOT EXISTS public.nfc_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE, -- NULL if member-specific
  group_member_id UUID REFERENCES public.group_members(id) ON DELETE CASCADE, -- NULL if group-level
  
  -- Tag metadata
  tag_uid TEXT UNIQUE, -- NFC tag unique identifier
  tag_type TEXT CHECK (tag_type IN ('NDEF', 'HCE', 'CARD_EMULATION')) NOT NULL,
  
  -- NDEF payload
  ndef_message TEXT NOT NULL, -- Full reference token or payment URL
  ndef_format TEXT DEFAULT 'text/plain', -- MIME type
  
  -- Display information
  display_name TEXT NOT NULL, -- e.g., "Abishyizehamwe Group Tag", "Marie's Member Card"
  description TEXT,
  
  -- Status and lifecycle
  status TEXT CHECK (status IN ('ACTIVE', 'INACTIVE', 'LOST', 'REPLACED')) NOT NULL DEFAULT 'ACTIVE',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deactivated_at TIMESTAMPTZ,
  deactivated_by UUID REFERENCES auth.users(id),
  deactivation_reason TEXT,
  
  -- Write protection
  locked BOOLEAN DEFAULT false,
  locked_at TIMESTAMPTZ,
  locked_by UUID REFERENCES auth.users(id),
  
  -- Audit trail
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nfc_tags_org_id ON public.nfc_tags(org_id);
CREATE INDEX IF NOT EXISTS idx_nfc_tags_group_id ON public.nfc_tags(group_id);
CREATE INDEX IF NOT EXISTS idx_nfc_tags_group_member_id ON public.nfc_tags(group_member_id);
CREATE INDEX IF NOT EXISTS idx_nfc_tags_tag_uid ON public.nfc_tags(tag_uid);
CREATE INDEX IF NOT EXISTS idx_nfc_tags_status ON public.nfc_tags(status);

-- NFC tap events (for analytics and security monitoring)
CREATE TABLE IF NOT EXISTS public.nfc_tap_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id UUID REFERENCES public.nfc_tags(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Event metadata
  event_type TEXT CHECK (event_type IN ('READ', 'WRITE', 'REDEEM', 'VERIFY')) NOT NULL,
  tag_uid TEXT,
  
  -- Device information
  device_info JSONB DEFAULT '{}'::jsonb, -- User agent, device model, OS version
  
  -- Location (optional)
  location_name TEXT, -- e.g., "SACCO Office", "Group Meeting"
  location_coordinates JSONB, -- {lat, lng}
  
  -- Result
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  
  -- Timestamps
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nfc_tap_events_tag_id ON public.nfc_tap_events(tag_id);
CREATE INDEX IF NOT EXISTS idx_nfc_tap_events_user_id ON public.nfc_tap_events(user_id);
CREATE INDEX IF NOT EXISTS idx_nfc_tap_events_event_type ON public.nfc_tap_events(event_type);
CREATE INDEX IF NOT EXISTS idx_nfc_tap_events_event_timestamp ON public.nfc_tap_events(event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_nfc_tap_events_tag_uid ON public.nfc_tap_events(tag_uid);

-- Enable RLS
ALTER TABLE public.nfc_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfc_tap_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for nfc_tags
CREATE POLICY "Authenticated users can view active NFC tags"
  ON public.nfc_tags
  FOR SELECT
  USING (status = 'ACTIVE' AND auth.role() = 'authenticated');

CREATE POLICY "Staff can manage their org NFC tags"
  ON public.nfc_tags
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE org_id = nfc_tags.org_id
      AND user_id = auth.uid()
    )
  );

-- RLS Policies for nfc_tap_events
CREATE POLICY "Users can view their own tap events"
  ON public.nfc_tap_events
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can log tap events"
  ON public.nfc_tap_events
  FOR INSERT
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL); -- Allow anonymous taps

CREATE POLICY "Staff can view org tap events"
  ON public.nfc_tap_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.nfc_tags nt
      INNER JOIN public.org_memberships om ON om.org_id = nt.org_id
      WHERE nt.id = nfc_tap_events.tag_id
      AND om.user_id = auth.uid()
    )
  );

-- Function to validate NDEF message format
CREATE OR REPLACE FUNCTION validate_ndef_message()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure NDEF message is not empty
  IF NEW.ndef_message IS NULL OR trim(NEW.ndef_message) = '' THEN
    RAISE EXCEPTION 'NDEF message cannot be empty';
  END IF;
  
  -- For group tags, ensure group_id is set
  IF NEW.tag_type = 'NDEF' AND NEW.group_id IS NULL AND NEW.group_member_id IS NULL THEN
    RAISE EXCEPTION 'NFC tag must be associated with a group or group member';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_nfc_tag_ndef ON public.nfc_tags;
CREATE TRIGGER validate_nfc_tag_ndef
  BEFORE INSERT OR UPDATE ON public.nfc_tags
  FOR EACH ROW
  EXECUTE FUNCTION validate_ndef_message();

-- Add updated_at trigger
DROP TRIGGER IF EXISTS update_nfc_tags_updated_at ON public.nfc_tags;
CREATE TRIGGER update_nfc_tags_updated_at
  BEFORE UPDATE ON public.nfc_tags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Grant permissions
GRANT SELECT ON public.nfc_tags TO authenticated;
GRANT INSERT ON public.nfc_tap_events TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Comments
COMMENT ON TABLE public.nfc_tags IS 'NFC tag registrations for group reference tokens and member cards';
COMMENT ON TABLE public.nfc_tap_events IS 'NFC tap event log for analytics and security monitoring';
COMMENT ON COLUMN public.nfc_tags.tag_uid IS 'NFC tag unique identifier (UID) from hardware';
COMMENT ON COLUMN public.nfc_tags.ndef_message IS 'NDEF payload: reference token, payment URL, or voucher code';
COMMENT ON COLUMN public.nfc_tags.tag_type IS 'Tag type: NDEF (physical tag), HCE (Host Card Emulation), CARD_EMULATION (closed loop)';
COMMENT ON COLUMN public.nfc_tags.locked IS 'Whether tag is write-protected (prevents tampering)';
COMMENT ON COLUMN public.nfc_tap_events.event_type IS 'Tap event type: READ (view reference), WRITE (program tag), REDEEM (voucher), VERIFY (check authenticity)';
