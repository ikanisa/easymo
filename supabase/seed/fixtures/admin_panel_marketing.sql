-- Admin Panel Marketing Fixtures
-- ---------------------------------------------------------------------------
-- Populates campaigns, vouchers, voucher events, orders, and insurance leads
-- with representative data so the admin panel surfaces meaningful content.
-- Execute after `admin_panel_core.sql` to ensure profiles/adopters exist.
-- ---------------------------------------------------------------------------

BEGIN;

-- Reference handles
WITH
  rider_one AS (
    SELECT user_id, whatsapp_e164 FROM public.profiles WHERE ref_code = 'RIDER001'
  ),
  rider_two AS (
    SELECT user_id, whatsapp_e164 FROM public.profiles WHERE ref_code = 'RIDER002'
  ),
  driver_one AS (
    SELECT user_id, whatsapp_e164 FROM public.profiles WHERE ref_code = 'DRIVER001'
  ),
  admin_actor AS (
    SELECT id FROM auth.users WHERE id = '11111111-1111-4111-8111-111111111111'
  ),
  upsert_station AS (
    INSERT INTO public.stations (id, name, engencode, owner_contact, location_point, status, created_at)
    VALUES (
      '55555555-5555-4555-8555-555555555555',
      'Fixture Station Downtown',
      'ENG-001',
      '+250788000020',
      ST_SetSRID(ST_MakePoint(30.0601, -1.9495), 4326)::geography,
      'active',
      now() - interval '90 days'
    )
    ON CONFLICT (engencode) DO UPDATE
      SET owner_contact = EXCLUDED.owner_contact,
          location_point = EXCLUDED.location_point,
          status = EXCLUDED.status
    RETURNING id
  ),
  station AS (
    SELECT id FROM upsert_station
    UNION ALL
    SELECT id FROM public.stations WHERE engencode = 'ENG-001'
    LIMIT 1
  ),
  upsert_campaigns AS (
    INSERT INTO public.campaigns (id, name, type, status, template_id, created_by, created_at, started_at, metadata)
    VALUES
      ('66666666-6666-4666-8666-666666666666'::uuid, 'Fixture Voucher Blast', 'voucher', 'running', 'promo_generic',
        (SELECT id FROM admin_actor), now() - interval '10 days', now() - interval '7 days',
        jsonb_build_object('segment', 'loyal-customers')),
      ('77777777-7777-4777-8777-777777777777'::uuid, 'Fixture Draft Promo', 'promo', 'draft', 'promo_generic',
        (SELECT id FROM admin_actor), now() - interval '2 days', NULL,
        jsonb_build_object('segment', 'trial-users'))
    ON CONFLICT (id) DO UPDATE
      SET status = EXCLUDED.status,
          started_at = EXCLUDED.started_at,
          metadata = EXCLUDED.metadata
    RETURNING id, status
  ),
  campaigns AS (
    SELECT id FROM upsert_campaigns
    UNION ALL
    SELECT id FROM public.campaigns WHERE id IN (
      '66666666-6666-4666-8666-666666666666',
      '77777777-7777-4777-8777-777777777777'
    )
  )
INSERT INTO public.campaign_targets (campaign_id, msisdn, user_id, personalized_vars, status, error_code, message_id, last_update_at)
SELECT
  target.campaign_id,
  target.msisdn,
  target.user_id,
  target.personalized_vars,
  target.status,
  target.error_code,
  target.message_id,
  target.last_update_at
FROM (
  VALUES
    ('66666666-6666-4666-8666-666666666666'::uuid, '+250780010001', '11111111-1111-4111-8111-111111111111'::uuid, jsonb_build_object('discount', '25%'), 'delivered', NULL, 'MSG-001', now() - interval '1 hour'),
    ('66666666-6666-4666-8666-666666666666'::uuid, '+250780010002', '22222222-2222-4222-8222-222222222222'::uuid, jsonb_build_object('discount', '25%'), 'failed', 'wa_template_error', 'MSG-002', now() - interval '30 minutes'),
    ('66666666-6666-4666-8666-666666666666'::uuid, '+250780020001', '33333333-3333-4333-8333-333333333333'::uuid, jsonb_build_object('discount', '25%'), 'queued', NULL, NULL, now() - interval '5 minutes'),
    ('77777777-7777-4777-8777-777777777777'::uuid, '+250780010001', '11111111-1111-4111-8111-111111111111'::uuid, jsonb_build_object('cta', 'Preview'), 'queued', NULL, NULL, now() - interval '1 day')
) AS target (campaign_id, msisdn, user_id, personalized_vars, status, error_code, message_id, last_update_at)
ON CONFLICT (campaign_id, msisdn) DO UPDATE
  SET status = EXCLUDED.status,
      error_code = EXCLUDED.error_code,
      message_id = EXCLUDED.message_id,
      last_update_at = EXCLUDED.last_update_at;

-- Vouchers
WITH
  station AS (SELECT id FROM public.stations WHERE engencode = 'ENG-001' LIMIT 1)
INSERT INTO public.vouchers (
  user_id,
  amount,
  currency,
  station_scope,
  code5,
  qr_url,
  png_url,
  status,
  issued_at,
  redeemed_at,
  expires_at,
  created_by,
  campaign_id,
  metadata,
  whatsapp_e164,
  policy_number,
  qr_payload
)
VALUES
  ('11111111-1111-4111-8111-111111111111'::uuid, 2000, 'RWF', (SELECT id FROM station), 'AB123', 'https://cdn.example.com/qr/AB123.svg', 'https://cdn.example.com/vouchers/AB123.png', 'redeemed', now() - interval '6 days', now() - interval '1 day', now() + interval '24 days', '11111111-1111-4111-8111-111111111111'::uuid, '66666666-6666-4666-8666-666666666666'::uuid, jsonb_build_object('channel', 'whatsapp'), '+250780010001', 'POL-AB123', 'QR:AB123'),
  ('22222222-2222-4222-8222-222222222222'::uuid, 2000, 'RWF', (SELECT id FROM station), 'CD456', 'https://cdn.example.com/qr/CD456.svg', 'https://cdn.example.com/vouchers/CD456.png', 'sent', now() - interval '4 days', NULL, now() + interval '26 days', '11111111-1111-4111-8111-111111111111'::uuid, '66666666-6666-4666-8666-666666666666'::uuid, jsonb_build_object('channel', 'whatsapp'), '+250780010002', 'POL-CD456', 'QR:CD456'),
  ('33333333-3333-4333-8333-333333333333'::uuid, 1500, 'RWF', NULL, 'EF789', NULL, NULL, 'issued', now() - interval '1 day', NULL, now() + interval '29 days', '11111111-1111-4111-8111-111111111111'::uuid, NULL, jsonb_build_object('segment', 'drivers'), '+250780020001', 'POL-EF789', 'QR:EF789'),
  ('22222222-2222-4222-8222-222222222222'::uuid, 2000, 'RWF', (SELECT id FROM station), 'GH012', NULL, NULL, 'expired', now() - interval '45 days', NULL, now() - interval '15 days', '11111111-1111-4111-8111-111111111111'::uuid, NULL, jsonb_build_object('segment', 'reactivation'), '+250780010002', 'POL-GH012', 'QR:GH012')
ON CONFLICT (code5) DO UPDATE
  SET status = EXCLUDED.status,
      redeemed_at = EXCLUDED.redeemed_at,
      expires_at = EXCLUDED.expires_at,
      metadata = EXCLUDED.metadata;

-- Voucher Events
INSERT INTO public.voucher_events (voucher_id, event_type, actor_id, station_id, context, created_at)
SELECT
  v.id,
  ev.event_type,
  '11111111-1111-4111-8111-111111111111'::uuid,
  (SELECT id FROM public.stations WHERE engencode = 'ENG-001' LIMIT 1),
  ev.context,
  ev.created_at
FROM public.vouchers v
JOIN LATERAL (
  VALUES
    ('issued', jsonb_build_object('channel', 'campaign'), v.issued_at),
    ('sent', jsonb_build_object('template', 'promo_generic'), v.issued_at + interval '1 hour'),
    ('redeemed', jsonb_build_object('staff', '+250788000020'), COALESCE(v.redeemed_at, v.issued_at + interval '3 days'))
) AS ev (event_type, context, created_at) ON true
WHERE v.code5 IN ('AB123', 'CD456')
ON CONFLICT DO NOTHING;

-- Orders (with display codes stored in order_code)
INSERT INTO public.bars (id, slug, name, location_text, country, city_area, currency, momo_code, is_active, created_at, updated_at)
VALUES (
  'cccccccc-cccc-4ccc-cccc-cccccccccccc'::uuid,
  'fixture-downtown',
  'Fixture Station Downtown',
  'Downtown Kigali',
  'RW',
  'Kigali',
  'RWF',
  'EASYMO123',
  true,
  now() - interval '120 days',
  now() - interval '1 day'
)
ON CONFLICT (slug) DO UPDATE
  SET name = EXCLUDED.name,
      location_text = EXCLUDED.location_text,
      city_area = EXCLUDED.city_area,
      currency = EXCLUDED.currency,
      momo_code = EXCLUDED.momo_code,
      is_active = true,
      updated_at = now();

INSERT INTO public.orders (
  id,
  order_code,
  bar_id,
  bar_name,
  table_label,
  status,
  total,
  created_at,
  updated_at,
  staff_number,
  override_reason,
  override_at
)
VALUES
  ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'::uuid, 'ORD-001', 'cccccccc-cccc-4ccc-cccc-cccccccccccc'::uuid, 'Fixture Station Downtown', 'Table A', 'served', 18.5, now() - interval '2 hours', now() - interval '1 hour', '+250788000020', NULL, NULL),
  ('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'::uuid, 'ORD-002', 'cccccccc-cccc-4ccc-cccc-cccccccccccc'::uuid, 'Fixture Station Downtown', 'Table B', 'pending', 9.0, now() - interval '20 minutes', now() - interval '5 minutes', '+250788000020', NULL, NULL)
ON CONFLICT (id) DO UPDATE
  SET status = EXCLUDED.status,
      total = EXCLUDED.total,
      updated_at = EXCLUDED.updated_at;

INSERT INTO public.order_events (order_id, event_type, actor_type, actor_identifier, note, created_at)
VALUES
  ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'::uuid, 'created', 'customer', '+250780010001', 'Customer submitted order.', now() - interval '2 hours'),
  ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'::uuid, 'paid', 'customer', '+250780010001', 'Momo payment confirmed.', now() - interval '90 minutes'),
  ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'::uuid, 'served', 'vendor', '+250788000020', 'Order served to Table A.', now() - interval '1 hour'),
  ('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'::uuid, 'created', 'customer', '+250780010002', 'Customer submitted order.', now() - interval '20 minutes')
ON CONFLICT DO NOTHING;

-- Insurance lead fixtures
INSERT INTO public.insurance_leads (id, whatsapp, file_path, raw_ocr, extracted, status, created_at)
VALUES
  ('88888888-8888-4888-8888-888888888888'::uuid, '+250780010001', 'insurance-docs/fixture-policy.pdf',
    jsonb_build_object('provider', 'azure', 'confidence', 0.89),
    jsonb_build_object('policy_number', 'FIX-123-XYZ', 'vehicle', 'TVS Star HLX', 'expiry', (now() + interval '11 months')::date),
    'reviewed', now() - interval '12 hours'),
  ('99999999-9999-4999-8999-999999999999'::uuid, '+250780020001', 'insurance-docs/fixture-driver.png',
    jsonb_build_object('provider', 'azure', 'confidence', 0.42),
    jsonb_build_object('issue', 'blurry_image'),
    'ocr_error', now() - interval '4 hours')
ON CONFLICT (id) DO UPDATE
  SET raw_ocr = EXCLUDED.raw_ocr,
      extracted = EXCLUDED.extracted,
      status = EXCLUDED.status;

COMMIT;
