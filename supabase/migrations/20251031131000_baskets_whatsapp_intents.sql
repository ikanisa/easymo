-- WhatsApp intents and menu definitions for baskets module (Phase 3)

BEGIN;

CREATE TABLE IF NOT EXISTS public.whatsapp_intents (
  id text PRIMARY KEY,
  payload_id text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  audience text NOT NULL DEFAULT 'member',
  category text NOT NULL DEFAULT 'baskets',
  template_name text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.whatsapp_menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_key text NOT NULL,
  position integer NOT NULL,
  intent_id text NOT NULL REFERENCES public.whatsapp_intents(id) ON DELETE CASCADE,
  emoji text,
  title_override text,
  description_override text,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_menu_items_menu_position_idx
  ON public.whatsapp_menu_items (menu_key, position);

CREATE INDEX IF NOT EXISTS whatsapp_menu_items_intent_idx
  ON public.whatsapp_menu_items (intent_id);

CREATE OR REPLACE VIEW public.whatsapp_menu_entries AS
SELECT
  m.menu_key,
  m.position,
  i.payload_id,
  COALESCE(m.title_override, i.title) AS title,
  COALESCE(m.description_override, i.description) AS description,
  m.emoji,
  m.is_enabled
FROM public.whatsapp_menu_items m
JOIN public.whatsapp_intents i ON i.id = m.intent_id;

ALTER TABLE public.whatsapp_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY whatsapp_intents_service_rw ON public.whatsapp_intents
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY whatsapp_menu_items_service_rw ON public.whatsapp_menu_items
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS trg_whatsapp_intents_updated ON public.whatsapp_intents;
CREATE TRIGGER trg_whatsapp_intents_updated
  BEFORE UPDATE ON public.whatsapp_intents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_whatsapp_menu_items_updated ON public.whatsapp_menu_items;
CREATE TRIGGER trg_whatsapp_menu_items_updated
  BEFORE UPDATE ON public.whatsapp_menu_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.basket_invites
  ADD COLUMN IF NOT EXISTS resolved_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_resolved_at timestamptz;

INSERT INTO public.whatsapp_intents (id, payload_id, title, description, audience, category, template_name, metadata)
VALUES
  ('BKT_CREATE', 'baskets_create', 'Create Ikimina', 'Set up a new savings circle for your group.', 'non_member', 'baskets', 'tmpl_baskets_invite', jsonb_build_object('journey', 'onboarding')),
  ('BKT_JOIN', 'baskets_join', 'Join with code', 'Enter an invite code that was shared with you.', 'non_member', 'baskets', NULL, jsonb_build_object('journey', 'onboarding')),
  ('BKT_MY', 'baskets_my', 'My ikimina', 'Open baskets you manage or joined.', 'member', 'baskets', NULL, jsonb_build_object('journey', 'dashboard')),
  ('BKT_SHARE', 'baskets_share', 'Share invite link', 'Send an invite link or deep link to new members.', 'member', 'baskets', 'tmpl_baskets_invite', jsonb_build_object('journey', 'growth')),
  ('BKT_QR', 'baskets_qr', 'Show MoMo QR', 'Generate or resend the basket QR code.', 'member', 'baskets', NULL, jsonb_build_object('journey', 'collections')),
  ('BKT_CLOSE', 'baskets_close', 'Close ikimina', 'Close the basket after payout or migration.', 'committee', 'baskets', 'tmpl_baskets_close_notice', jsonb_build_object('journey', 'governance')),
  ('BKT_LEAVE', 'baskets_leave', 'Leave ikimina', 'Leave the group if you do not want to continue.', 'member', 'baskets', NULL, jsonb_build_object('journey', 'support')),
  ('BKT_BACK_HOME', 'back_menu', '← Back', 'Return to the easyMO services menu.', 'shared', 'baskets', NULL, jsonb_build_object('journey', 'navigation'))
ON CONFLICT (id) DO UPDATE
SET payload_id = EXCLUDED.payload_id,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    audience = EXCLUDED.audience,
    category = EXCLUDED.category,
    template_name = EXCLUDED.template_name,
    metadata = EXCLUDED.metadata,
    updated_at = timezone('utc', now());

INSERT INTO public.whatsapp_menu_items (menu_key, position, intent_id, emoji, title_override, description_override)
VALUES
  ('baskets_non_member', 1, 'BKT_CREATE', '🧺', NULL, 'Start a new savings circle.'),
  ('baskets_non_member', 2, 'BKT_JOIN', '🔑', NULL, 'Join with an invite code.'),
  ('baskets_non_member', 3, 'BKT_BACK_HOME', '↩️', NULL, 'Return to the services menu.'),
  ('baskets_member', 1, 'BKT_MY', '📋', NULL, 'View baskets you belong to.'),
  ('baskets_member', 2, 'BKT_JOIN', '🔑', NULL, 'Join with an invite code.'),
  ('baskets_member', 3, 'BKT_SHARE', '🔗', NULL, 'Share the invite link or deep link.'),
  ('baskets_member', 4, 'BKT_QR', '💳', NULL, 'Show the MoMo QR code.'),
  ('baskets_member', 5, 'BKT_LEAVE', '🚪', NULL, 'Leave the ikimina.'),
  ('baskets_member', 6, 'BKT_BACK_HOME', '↩️', NULL, 'Return to the services menu.'),
  ('baskets_committee', 1, 'BKT_MY', '📋', 'My ikimina', 'Pick a basket to manage.'),
  ('baskets_committee', 2, 'BKT_SHARE', '🔗', 'Share invite link', 'Send the invite link or QR.'),
  ('baskets_committee', 3, 'BKT_CLOSE', '🛑', NULL, 'Close the ikimina when complete.'),
  ('baskets_committee', 4, 'BKT_BACK_HOME', '↩️', NULL, 'Return to the services menu.')
ON CONFLICT (menu_key, position) DO UPDATE
SET intent_id = EXCLUDED.intent_id,
    emoji = EXCLUDED.emoji,
    title_override = EXCLUDED.title_override,
    description_override = EXCLUDED.description_override,
    is_enabled = true,
    updated_at = timezone('utc', now());

COMMIT;
