-- Notification templates and user preferences for event-driven notifications
-- Supports bilingual templates (en/rw) and per-user channel toggles

-- Notification templates table for event-driven notifications
CREATE TABLE IF NOT EXISTS public.notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event TEXT NOT NULL,
  channel public.notification_channel NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en',
  sacco_id UUID REFERENCES public.saccos(id) ON DELETE CASCADE,
  subject TEXT,
  body TEXT NOT NULL,
  tokens JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event, channel, locale, sacco_id)
);

CREATE INDEX IF NOT EXISTS notification_templates_event_idx ON public.notification_templates(event, is_active);
CREATE INDEX IF NOT EXISTS notification_templates_sacco_id_idx ON public.notification_templates(sacco_id);

-- User notification preferences - per-user, per-channel toggles
CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  locale TEXT NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Updated_at trigger for notification_templates
DROP TRIGGER IF EXISTS notification_templates_set_updated_at ON public.notification_templates;
CREATE TRIGGER notification_templates_set_updated_at
  BEFORE UPDATE ON public.notification_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Updated_at trigger for user_notification_preferences
DROP TRIGGER IF EXISTS user_notification_preferences_set_updated_at ON public.user_notification_preferences;
CREATE TRIGGER user_notification_preferences_set_updated_at
  BEFORE UPDATE ON public.user_notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Helper function to get user's locale preference
CREATE OR REPLACE FUNCTION public.get_user_locale(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_locale TEXT;
BEGIN
  SELECT locale INTO v_locale
  FROM public.user_notification_preferences
  WHERE user_id = p_user_id;
  
  RETURN COALESCE(v_locale, 'en');
END;
$$;

-- Helper function to check if user has channel enabled
CREATE OR REPLACE FUNCTION public.is_channel_enabled(p_user_id UUID, p_channel TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_enabled BOOLEAN;
BEGIN
  IF p_channel = 'IN_APP' THEN
    SELECT COALESCE(in_app_enabled, TRUE) INTO v_enabled
    FROM public.user_notification_preferences
    WHERE user_id = p_user_id;
    RETURN COALESCE(v_enabled, TRUE);
  ELSIF p_channel = 'EMAIL' THEN
    SELECT COALESCE(email_enabled, FALSE) INTO v_enabled
    FROM public.user_notification_preferences
    WHERE user_id = p_user_id;
    RETURN COALESCE(v_enabled, FALSE);
  ELSIF p_channel = 'WHATSAPP' THEN
    SELECT COALESCE(whatsapp_enabled, FALSE) INTO v_enabled
    FROM public.user_notification_preferences
    WHERE user_id = p_user_id;
    RETURN COALESCE(v_enabled, FALSE);
  END IF;
  
  RETURN FALSE;
END;
$$;

-- Event bus function to dispatch notifications
CREATE OR REPLACE FUNCTION public.dispatch_notification_event(
  p_event TEXT,
  p_user_id UUID,
  p_sacco_id UUID DEFAULT NULL,
  p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_locale TEXT;
  v_template RECORD;
  v_in_app_enabled BOOLEAN;
  v_email_enabled BOOLEAN;
  v_whatsapp_enabled BOOLEAN;
  v_email TEXT;
  v_msisdn TEXT;
BEGIN
  -- Get user locale and preferences
  SELECT 
    COALESCE(locale, 'en'),
    COALESCE(in_app_enabled, TRUE),
    COALESCE(email_enabled, FALSE),
    COALESCE(whatsapp_enabled, FALSE)
  INTO v_locale, v_in_app_enabled, v_email_enabled, v_whatsapp_enabled
  FROM public.user_notification_preferences
  WHERE user_id = p_user_id;
  
  -- Default to 'en' if no preferences found
  v_locale := COALESCE(v_locale, 'en');
  v_in_app_enabled := COALESCE(v_in_app_enabled, TRUE);
  v_email_enabled := COALESCE(v_email_enabled, FALSE);
  v_whatsapp_enabled := COALESCE(v_whatsapp_enabled, FALSE);
  
  -- Create in-app notification if enabled
  IF v_in_app_enabled THEN
    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (
      p_user_id,
      CASE p_event
        WHEN 'INVITE_ACCEPTED' THEN 'invite_accepted'::public.notification_type
        WHEN 'JOIN_APPROVED' THEN 'new_member'::public.notification_type
        WHEN 'PAYMENT_CONFIRMED' THEN 'payment_confirmed'::public.notification_type
        ELSE 'new_member'::public.notification_type
      END,
      p_payload
    );
  END IF;
  
  -- Queue email notification if enabled and user has email
  IF v_email_enabled THEN
    SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
    
    IF v_email IS NOT NULL THEN
      -- Find template for this event and locale
      SELECT * INTO v_template
      FROM public.notification_templates
      WHERE event = p_event
        AND channel = 'EMAIL'
        AND locale = v_locale
        AND (sacco_id IS NULL OR sacco_id = p_sacco_id)
        AND is_active = TRUE
      ORDER BY sacco_id DESC NULLS LAST
      LIMIT 1;
      
      IF v_template.id IS NOT NULL THEN
        INSERT INTO public.notification_queue (
          event,
          channel,
          sacco_id,
          template_id,
          status,
          scheduled_for,
          payload
        ) VALUES (
          p_event,
          'EMAIL',
          p_sacco_id,
          v_template.id,
          'PENDING',
          NOW(),
          jsonb_build_object(
            'email', v_email,
            'subject', v_template.subject,
            'body', v_template.body,
            'tokens', p_payload
          )
        );
      END IF;
    END IF;
  END IF;
  
  -- Queue WhatsApp notification if enabled and user has msisdn
  IF v_whatsapp_enabled THEN
    -- Try to get msisdn from members_app_profiles
    SELECT whatsapp_msisdn INTO v_msisdn
    FROM public.members_app_profiles
    WHERE user_id = p_user_id;
    
    IF v_msisdn IS NOT NULL THEN
      -- Find template for this event and locale
      SELECT * INTO v_template
      FROM public.notification_templates
      WHERE event = p_event
        AND channel = 'WHATSAPP'
        AND locale = v_locale
        AND (sacco_id IS NULL OR sacco_id = p_sacco_id)
        AND is_active = TRUE
      ORDER BY sacco_id DESC NULLS LAST
      LIMIT 1;
      
      IF v_template.id IS NOT NULL THEN
        INSERT INTO public.notification_queue (
          event,
          channel,
          sacco_id,
          template_id,
          status,
          scheduled_for,
          payload
        ) VALUES (
          p_event,
          'WHATSAPP',
          p_sacco_id,
          v_template.id,
          'PENDING',
          NOW(),
          jsonb_build_object(
            'to', v_msisdn,
            'tokens', p_payload
          )
        );
      END IF;
    END IF;
  END IF;
END;
$$;

-- Trigger function for invite_accepted event
CREATE OR REPLACE FUNCTION public.on_invite_accepted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_group_name TEXT;
  v_sacco_id UUID;
BEGIN
  -- Only fire when status changes to 'accepted'
  IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted') THEN
    -- Get group name and sacco_id
    SELECT i.name, i.sacco_id
    INTO v_group_name, v_sacco_id
    FROM public.ibimina i
    WHERE i.id = NEW.group_id;
    
    -- Dispatch notification to invitee
    IF NEW.invitee_user_id IS NOT NULL THEN
      PERFORM public.dispatch_notification_event(
        'INVITE_ACCEPTED',
        NEW.invitee_user_id,
        v_sacco_id,
        jsonb_build_object(
          'group_name', v_group_name,
          'group_id', NEW.group_id,
          'accepted_at', NEW.accepted_at
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger function for join_approved event
CREATE OR REPLACE FUNCTION public.on_join_approved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_group_name TEXT;
  v_sacco_id UUID;
BEGIN
  -- Only fire when status changes to 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    -- Get group name and sacco_id
    SELECT i.name, i.sacco_id
    INTO v_group_name, v_sacco_id
    FROM public.ibimina i
    WHERE i.id = NEW.group_id;
    
    -- Dispatch notification to user
    PERFORM public.dispatch_notification_event(
      'JOIN_APPROVED',
      NEW.user_id,
      v_sacco_id,
      jsonb_build_object(
        'group_name', v_group_name,
        'group_id', NEW.group_id,
        'decided_at', NEW.decided_at
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger function for payment_confirmed event
CREATE OR REPLACE FUNCTION public.on_payment_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_member_user_id UUID;
  v_group_name TEXT;
  v_amount_formatted TEXT;
BEGIN
  -- Only fire when status changes to 'CONFIRMED'
  IF NEW.status = 'CONFIRMED' AND (OLD.status IS NULL OR OLD.status != 'CONFIRMED') THEN
    -- Try to find the member's user_id
    SELECT m.user_id
    INTO v_member_user_id
    FROM public.ikimina_members m
    WHERE m.id = NEW.member_id;
    
    -- Also try to get group name
    SELECT i.name
    INTO v_group_name
    FROM public.ibimina i
    WHERE i.id = NEW.ikimina_id;
    
    -- Format amount
    v_amount_formatted := CONCAT(NEW.currency, ' ', (NEW.amount / 100.0)::TEXT);
    
    -- Dispatch notification if we found a user
    IF v_member_user_id IS NOT NULL THEN
      PERFORM public.dispatch_notification_event(
        'PAYMENT_CONFIRMED',
        v_member_user_id,
        NEW.sacco_id,
        jsonb_build_object(
          'amount', v_amount_formatted,
          'currency', NEW.currency,
          'reference', NEW.reference,
          'group_name', v_group_name,
          'occurred_at', NEW.occurred_at,
          'payment_id', NEW.id
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_invite_accepted ON public.group_invites;
CREATE TRIGGER trigger_invite_accepted
  AFTER UPDATE ON public.group_invites
  FOR EACH ROW
  EXECUTE FUNCTION public.on_invite_accepted();

DROP TRIGGER IF EXISTS trigger_join_approved ON public.join_requests;
CREATE TRIGGER trigger_join_approved
  AFTER UPDATE ON public.join_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.on_join_approved();

DROP TRIGGER IF EXISTS trigger_payment_confirmed ON public.payments;
CREATE TRIGGER trigger_payment_confirmed
  AFTER UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.on_payment_confirmed();

-- Seed default templates (English)
INSERT INTO public.notification_templates (event, channel, locale, subject, body, tokens) VALUES
  -- INVITE_ACCEPTED - Email (EN)
  ('INVITE_ACCEPTED', 'EMAIL', 'en', 
   'Welcome to {group_name}!',
   E'Hello,\n\nYou have successfully joined {group_name}. Welcome to the group!\n\nYou can now participate in group activities and view group information in the app.\n\nBest regards,\nSACCO+ Team',
   '["group_name"]'::jsonb),
  
  -- INVITE_ACCEPTED - WhatsApp (EN)
  ('INVITE_ACCEPTED', 'WHATSAPP', 'en',
   NULL,
   'Welcome to {group_name}! You have successfully joined the group. You can now participate in group activities.',
   '["group_name"]'::jsonb),
  
  -- JOIN_APPROVED - Email (EN)
  ('JOIN_APPROVED', 'EMAIL', 'en',
   'Your request to join {group_name} has been approved',
   E'Hello,\n\nGreat news! Your request to join {group_name} has been approved.\n\nYou can now access the group and participate in all activities.\n\nBest regards,\nSACCO+ Team',
   '["group_name"]'::jsonb),
  
  -- JOIN_APPROVED - WhatsApp (EN)
  ('JOIN_APPROVED', 'WHATSAPP', 'en',
   NULL,
   'Good news! Your request to join {group_name} has been approved. You can now access the group.',
   '["group_name"]'::jsonb),
  
  -- PAYMENT_CONFIRMED - Email (EN)
  ('PAYMENT_CONFIRMED', 'EMAIL', 'en',
   'Payment confirmed: {amount}',
   E'Hello,\n\nYour payment of {amount} has been confirmed and recorded.\n\nReference: {reference}\nGroup: {group_name}\nDate: {occurred_at}\n\nThank you for your contribution!\n\nBest regards,\nSACCO+ Team',
   '["amount", "reference", "group_name", "occurred_at"]'::jsonb),
  
  -- PAYMENT_CONFIRMED - WhatsApp (EN)
  ('PAYMENT_CONFIRMED', 'WHATSAPP', 'en',
   NULL,
   'Payment confirmed! {amount} received for {group_name}. Reference: {reference}. Thank you!',
   '["amount", "reference", "group_name"]'::jsonb)
ON CONFLICT (event, channel, locale, sacco_id) DO NOTHING;

-- Seed default templates (Kinyarwanda)
INSERT INTO public.notification_templates (event, channel, locale, subject, body, tokens) VALUES
  -- INVITE_ACCEPTED - Email (RW)
  ('INVITE_ACCEPTED', 'EMAIL', 'rw',
   'Murakaza neza muri {group_name}!',
   E'Muraho,\n\nMwiyunze neza muri {group_name}. Murakaza neza muri itsinda!\n\nUbu mushobora kugira uruhare mu bikorwa by''itsinda no kureba amakuru y''itsinda muri porogaramu.\n\nMurakoze,\nIkipe ya SACCO+',
   '["group_name"]'::jsonb),
  
  -- INVITE_ACCEPTED - WhatsApp (RW)
  ('INVITE_ACCEPTED', 'WHATSAPP', 'rw',
   NULL,
   'Murakaza neza muri {group_name}! Mwiyunze neza muri itsinda. Ubu mushobora kugira uruhare mu bikorwa.',
   '["group_name"]'::jsonb),
  
  -- JOIN_APPROVED - Email (RW)
  ('JOIN_APPROVED', 'EMAIL', 'rw',
   'Icyifuzo cyanyu cyo kwinjira muri {group_name} cyemewe',
   E'Muraho,\n\nAmakuru meza! Icyifuzo cyanyu cyo kwinjira muri {group_name} cyemewe.\n\nUbu mushobora kubona itsinda no kugira uruhare mu bikorwa byose.\n\nMurakoze,\nIkipe ya SACCO+',
   '["group_name"]'::jsonb),
  
  -- JOIN_APPROVED - WhatsApp (RW)
  ('JOIN_APPROVED', 'WHATSAPP', 'rw',
   NULL,
   'Amakuru meza! Icyifuzo cyanyu cyo kwinjira muri {group_name} cyemewe. Ubu mushobora kubona itsinda.',
   '["group_name"]'::jsonb),
  
  -- PAYMENT_CONFIRMED - Email (RW)
  ('PAYMENT_CONFIRMED', 'EMAIL', 'rw',
   'Ubwishyu bwemejwe: {amount}',
   E'Muraho,\n\nUbwishyu bwanyu bwa {amount} bwemejwe kandi bwanditswe.\n\nReferensi: {reference}\nItsinda: {group_name}\nItariki: {occurred_at}\n\nMurakoze cyane kubw''umusanzu wanyu!\n\nMurakoze,\nIkipe ya SACCO+',
   '["amount", "reference", "group_name", "occurred_at"]'::jsonb),
  
  -- PAYMENT_CONFIRMED - WhatsApp (RW)
  ('PAYMENT_CONFIRMED', 'WHATSAPP', 'rw',
   NULL,
   'Ubwishyu bwemejwe! {amount} byakiriwe kuri {group_name}. Referensi: {reference}. Murakoze!',
   '["amount", "reference", "group_name"]'::jsonb)
ON CONFLICT (event, channel, locale, sacco_id) DO NOTHING;
