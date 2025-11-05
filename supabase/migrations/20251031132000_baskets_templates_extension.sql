-- Extend baskets template catalog and surface menu keys for WhatsApp intents

BEGIN;

UPDATE public.settings
SET value = value || jsonb_build_object(
    'invite_link', 'tmpl_baskets_invite',
    'loan_submitted', 'tmpl_baskets_loan_submitted',
    'loan_status', 'tmpl_baskets_loan_status',
    'committee_prompt', 'tmpl_baskets_committee_prompt',
    'close_notice', 'tmpl_baskets_close_notice'
  ),
  updated_at = timezone('utc', now())
WHERE key = 'baskets.templates';

INSERT INTO public.settings (key, value, updated_at)
VALUES (
  'baskets.menu_keys',
  jsonb_build_object(
    'non_member', 'baskets_non_member',
    'member', 'baskets_member',
    'committee', 'baskets_committee'
  ),
  timezone('utc', now())
)
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      updated_at = EXCLUDED.updated_at;

COMMIT;
