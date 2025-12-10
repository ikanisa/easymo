create schema if not exists config;

grant usage on schema config to authenticated;
grant usage on schema config to service_role;
grant usage on schema config to supabase_admin;

create table if not exists config.ussd_templates (
  operator_id text primary key,
  version text not null,
  ttl_seconds integer not null check (ttl_seconds > 0),
  payload jsonb not null,
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  metadata jsonb
);

comment on table config.ussd_templates is 'Mobile money USSD templates with versioning and TTL for OTA refreshes';
comment on column config.ussd_templates.operator_id is 'Unique operator identifier (e.g., mtn-rw)';
comment on column config.ussd_templates.payload is 'Raw template payload mirroring packages/config/ussd.json structure';
comment on column config.ussd_templates.ttl_seconds is 'Suggested cache TTL for this operator in seconds';
comment on column config.ussd_templates.version is 'Semantic version or date tag for the template payload';
comment on column config.ussd_templates.metadata is 'Optional metadata for auditing/template provenance';

alter table config.ussd_templates enable row level security;

grant select on config.ussd_templates to authenticated;
grant select on config.ussd_templates to service_role;
grant select on config.ussd_templates to supabase_admin;

create policy "Authenticated read USSD templates" on config.ussd_templates
  for select
  using (auth.role() in ('authenticated', 'service_role', 'supabase_admin'));

insert into config.ussd_templates (operator_id, version, ttl_seconds, payload, metadata)
values
  (
    'mtn-rw',
    '2025-01-15',
    86400,
    jsonb_build_object(
      'id', 'mtn-rw',
      'name', 'MTN MoMo',
      'network', 'MTN',
      'country', 'RW',
      'currency', 'RWF',
      'supportsAutoDial', true,
      'default', true,
      'shortcode', '*182#',
      'templates', jsonb_build_object(
        'shortcut', '*182*8*1*{MERCHANT}*{AMOUNT}#',
        'menu', '*182*8*1*{MERCHANT}#',
        'base', '*182#'
      ),
      'placeholders', jsonb_build_object(
        'merchant', '{MERCHANT}',
        'amount', '{AMOUNT}',
        'reference', '{REFERENCE}'
      ),
      'locales', jsonb_build_object(
        'en-RW', jsonb_build_object(
          'copy', 'Dial {code} to pay {amount} with reference {reference}.',
          'cta', 'Tap to dial',
          'instructions', jsonb_build_array(
            'Ensure you have sufficient balance before dialing.',
            'Dial {code} and follow the prompts to confirm the payment.',
            'Enter the reference {reference} when prompted.'
          )
        ),
        'rw-RW', jsonb_build_object(
          'copy', 'Hamagara {code} wishyure {amount} ukoresheje indangamubare {reference}.',
          'cta', 'Kanda uhageze',
          'instructions', jsonb_build_array(
            'Reba ko ufite amafaranga ahagije kuri konti yawe ya MoMo.',
            'Hamagara {code} hanyuma ukurikize amabwiriza kuri telefoni.',
            'Shyiramo indangamubare {reference} igihe bayigusabye.'
          )
        ),
        'fr-RW', jsonb_build_object(
          'copy', 'Composez {code} pour payer {amount} avec la référence {reference}.',
          'cta', 'Appuyer pour appeler',
          'instructions', jsonb_build_array(
            'Vérifiez votre solde avant de composer le code.',
            'Composez {code} et suivez les instructions pour confirmer le paiement.',
            'Saisissez la référence {reference} lorsque demandé.'
          )
        )
      )
    ),
    jsonb_build_object('source', 'packages/config/ussd.json')
  ),
  (
    'airtel-rw',
    '2025-01-15',
    86400,
    jsonb_build_object(
      'id', 'airtel-rw',
      'name', 'Airtel Money',
      'network', 'Airtel',
      'country', 'RW',
      'currency', 'RWF',
      'supportsAutoDial', true,
      'default', false,
      'shortcode', '*500#',
      'templates', jsonb_build_object(
        'shortcut', '*500*1*3*{MERCHANT}*{AMOUNT}#',
        'menu', '*500*1*3*{MERCHANT}#',
        'base', '*500#'
      ),
      'placeholders', jsonb_build_object(
        'merchant', '{MERCHANT}',
        'amount', '{AMOUNT}',
        'reference', '{REFERENCE}'
      ),
      'locales', jsonb_build_object(
        'en-RW', jsonb_build_object(
          'copy', 'Dial {code} to pay {amount} with reference {reference}.',
          'cta', 'Tap to dial',
          'instructions', jsonb_build_array(
            'Make sure your Airtel Money wallet has enough balance.',
            'Dial {code} and approve the transaction.',
            'Provide reference {reference} if requested.'
          )
        ),
        'rw-RW', jsonb_build_object(
          'copy', 'Hamagara {code} wishyure {amount} ukoresheje indangamubare {reference}.',
          'cta', 'Kanda uhageze',
          'instructions', jsonb_build_array(
            'Menya neza ko ufite amafaranga kuri Airtel Money.',
            'Hamagara {code} hanyuma wemere ubwishyu.',
            'Uzabwire indangamubare {reference} niba basabye.'
          )
        ),
        'fr-RW', jsonb_build_object(
          'copy', 'Composez {code} pour payer {amount} avec la référence {reference}.',
          'cta', 'Appuyer pour appeler',
          'instructions', jsonb_build_array(
            'Assurez-vous d''avoir assez de solde Airtel Money.',
            'Composez {code} puis validez le paiement.',
            'Donnez la référence {reference} si nécessaire.'
          )
        )
      )
    ),
    jsonb_build_object('source', 'packages/config/ussd.json')
  )
on conflict (operator_id) do update
  set version = excluded.version,
      ttl_seconds = excluded.ttl_seconds,
      payload = excluded.payload,
      metadata = excluded.metadata,
      is_active = true,
      updated_at = now();
