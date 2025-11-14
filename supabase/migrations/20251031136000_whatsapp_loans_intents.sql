BEGIN;

INSERT INTO public.whatsapp_intents (id, payload_id, title, description, audience, category, template_name, metadata)
VALUES
  ('BKT_LOAN_REQUEST', 'baskets_loan_request', 'Request loan', 'Start a SACCO-backed loan request.', 'member', 'baskets', 'tmpl_baskets_loan_request', jsonb_build_object('journey', 'loans')),
  ('BKT_LOAN_STATUS', 'baskets_loan_status', 'Loan status', 'Check your outstanding loan requests.', 'member', 'baskets', NULL, jsonb_build_object('journey', 'loans')),
  ('BKT_LOAN_APPROVALS', 'baskets_loan_approvals', 'Review loans', 'Approve or reject pending loan requests.', 'committee', 'baskets', 'tmpl_baskets_loan_committee', jsonb_build_object('journey', 'loans'))
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
  ('baskets_member', 7, 'BKT_LOAN_REQUEST', '💳', 'Request loan', 'Submit a SACCO loan request.'),
  ('baskets_member', 8, 'BKT_LOAN_STATUS', '📊', 'Loan status', 'See current applications.'),
  ('baskets_committee', 2, 'BKT_LOAN_APPROVALS', '✅', 'Review loans', 'Approve or reject committee requests.')
ON CONFLICT (menu_key, position) DO UPDATE
SET intent_id = EXCLUDED.intent_id,
    emoji = EXCLUDED.emoji,
    title_override = EXCLUDED.title_override,
    description_override = EXCLUDED.description_override,
    is_enabled = true,
    updated_at = timezone('utc', now());

UPDATE public.settings
SET value = value || jsonb_build_object(
  'loan_request', 'tmpl_baskets_loan_request',
  'loan_committee', 'tmpl_baskets_loan_committee'
),
updated_at = timezone('utc', now())
WHERE key = 'baskets.templates';

COMMIT;
