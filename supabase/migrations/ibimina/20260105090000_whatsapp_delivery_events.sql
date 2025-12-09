-- Capture WhatsApp webhook delivery statuses for operational insight.

create table if not exists ops.whatsapp_delivery_events (
  id uuid primary key default gen_random_uuid(),
  message_id text not null,
  status text not null,
  message_timestamp timestamptz not null,
  recipient text,
  conversation_id text,
  conversation_origin text,
  error_code text,
  error_title text,
  error_message text,
  failure_reason text,
  raw_payload jsonb not null,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists ux_whatsapp_delivery_events_dedup
  on ops.whatsapp_delivery_events (message_id, status, message_timestamp);

create index if not exists idx_whatsapp_delivery_events_status
  on ops.whatsapp_delivery_events (status, created_at desc);

comment on table ops.whatsapp_delivery_events is 'WhatsApp Business API webhook delivery telemetry and failure diagnostics.';
comment on column ops.whatsapp_delivery_events.message_id is 'WhatsApp Business API message identifier (wamid.*).';
comment on column ops.whatsapp_delivery_events.status is 'Delivery status reported by Meta (sent, delivered, read, failed, etc.).';
comment on column ops.whatsapp_delivery_events.message_timestamp is 'Timestamp from webhook payload indicating when the status occurred.';
comment on column ops.whatsapp_delivery_events.recipient is 'Recipient phone number reported in the webhook payload.';
comment on column ops.whatsapp_delivery_events.conversation_origin is 'Conversation origin type (e.g., business_initiated, user_initiated).';
comment on column ops.whatsapp_delivery_events.failure_reason is 'Concatenated error titles/messages returned by Meta for failed deliveries.';
