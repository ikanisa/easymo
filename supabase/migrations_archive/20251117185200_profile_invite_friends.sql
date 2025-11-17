BEGIN;

INSERT INTO whatsapp_profile_menu_items (
  key,
  name,
  label_en,
  label_fr,
  label_rw,
  description_en,
  description_fr,
  description_rw,
  display_order,
  is_active,
  action_type,
  action_target,
  country_specific_names
) VALUES (
  'invite_friends',
  '🎁 Invite friends',
  'Invite friends',
  'Inviter des amis',
  'Tumiya inshuti',
  'Earn 10 tokens per successful invite. Tokens redeemable for fuel vouchers or transfer to friends.',
  'Gagnez 10 jetons par invitation réussie. Jetons échangeables contre des bons carburant ou transférables à des amis.',
  'Bona 10 tokens kuri buri nshuti yinjiye. Ushobora kubikoresha kugura essence cyangwa kubiha abandi.',
  6,
  true,
  'action',
  'show_invite_friends',
  jsonb_build_object('en','Invite friends','fr','Inviter des amis','rw','Tumiya inshuti')
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  label_en = EXCLUDED.label_en,
  label_fr = EXCLUDED.label_fr,
  label_rw = EXCLUDED.label_rw,
  description_en = EXCLUDED.description_en,
  description_fr = EXCLUDED.description_fr,
  description_rw = EXCLUDED.description_rw,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active,
  action_type = EXCLUDED.action_type,
  action_target = EXCLUDED.action_target,
  country_specific_names = EXCLUDED.country_specific_names,
  updated_at = now();

COMMIT;

