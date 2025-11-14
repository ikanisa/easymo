-- Agent admin composite views for driver negotiations and SLA monitoring
-- Provides read-only projections for the admin app. Additive and idempotent.

begin;

-- Latest location snapshot per driver
create or replace view public.driver_locations_latest as
select distinct on (dp.user_id)
  dp.user_id,
  p.ref_code,
  p.whatsapp_e164,
  dp.vehicle_type,
  dp.last_seen,
  dp.lat,
  dp.lng,
  dp.updated_at,
  (timezone('utc', now()) - dp.last_seen) <= interval '10 minutes' as is_online
from public.driver_presence dp
join public.profiles p on p.user_id = dp.user_id
order by dp.user_id, dp.last_seen desc;

comment on view public.driver_locations_latest is
  'Latest known location for each driver with presence data and contact details.';

-- SLA timers for active agent sessions
create or replace view public.sla_timers as
select
  s.id as session_id,
  s.agent_type,
  s.status,
  s.started_at,
  s.deadline_at,
  r.sla_minutes,
  extract(epoch from (timezone('utc', now()) - s.started_at))::integer as elapsed_seconds,
  greatest(0, extract(epoch from (s.deadline_at - timezone('utc', now())))::integer) as remaining_seconds,
  (timezone('utc', now()) > s.deadline_at) as breached
from public.agent_sessions s
join public.agent_registry r on r.agent_type = s.agent_type;

comment on view public.sla_timers is
  'Computed SLA timers for agent sessions including elapsed and remaining seconds.';

-- High level request summary for driver/negotiation flows
create or replace view public.agent_requests_v as
select
  s.id as session_id,
  s.agent_type,
  r.name as agent_name,
  s.user_id,
  p.whatsapp_e164,
  s.status,
  s.request_data,
  s.started_at,
  s.deadline_at,
  s.completed_at,
  coalesce(s.extensions_count, 0) as extensions_count,
  coalesce(s.metadata, '{}'::jsonb) as metadata,
  coalesce(qt.quotes_count, 0) as quotes_count
from public.agent_sessions s
left join public.agent_registry r on r.agent_type = s.agent_type
left join public.profiles p on p.user_id = s.user_id
left join lateral (
  select count(*)::integer as quotes_count
  from public.agent_quotes q
  where q.session_id = s.id
) qt on true;

comment on view public.agent_requests_v is
  'View of agent negotiation requests with user contact information and quote counts.';

-- Candidate quotes per negotiation session
create or replace view public.negotiation_candidates_v as
select
  q.id as quote_id,
  q.session_id,
  q.vendor_type,
  q.vendor_name,
  q.vendor_phone,
  q.status,
  q.price_amount,
  q.price_currency,
  q.estimated_time_minutes,
  q.notes,
  coalesce(q.offer_data, '{}'::jsonb) as offer_data,
  q.responded_at,
  q.created_at,
  q.updated_at
from public.agent_quotes q;

comment on view public.negotiation_candidates_v is
  'Normalized vendor quote candidates associated with negotiation sessions.';

-- Message timeline combining agent conversations and vendor responses
create or replace view public.negotiation_messages_v as
select
  c.session_id,
  c.id as message_id,
  'conversation'::text as message_type,
  c.role as author_role,
  c.content as body,
  null::uuid as quote_id,
  c.created_at
from public.agent_conversations c
union all
select
  v.session_id,
  v.id as message_id,
  'vendor_response'::text as message_type,
  'vendor'::text as author_role,
  coalesce(v.response_message, '') as body,
  v.quote_id,
  coalesce(v.received_at, v.created_at)
from public.vendor_quote_responses v
union all
select
  q.session_id,
  q.id as message_id,
  'quote'::text as message_type,
  q.vendor_type as author_role,
  coalesce(q.offer_data::text, '') as body,
  q.id as quote_id,
  coalesce(q.responded_at, q.created_at)
from public.agent_quotes q;

comment on view public.negotiation_messages_v is
  'Unified negotiation timeline including agent messages, vendor responses, and quote payloads.';

-- Negotiation threads enriched with SLA snapshot and message recency
create or replace view public.negotiation_threads_v as
select
  req.session_id,
  req.agent_type,
  req.agent_name,
  req.user_id,
  req.whatsapp_e164,
  req.status,
  req.started_at,
  req.deadline_at,
  req.completed_at,
  req.extensions_count,
  req.metadata,
  req.quotes_count,
  sla.sla_minutes,
  sla.elapsed_seconds,
  sla.remaining_seconds,
  sla.breached,
  msg.last_message_at
from public.agent_requests_v req
left join public.sla_timers sla on sla.session_id = req.session_id
left join lateral (
  select max(created_at) as last_message_at
  from public.negotiation_messages_v nm
  where nm.session_id = req.session_id
) msg on true;

comment on view public.negotiation_threads_v is
  'Negotiation session overview combining request, SLA and latest message metadata.';

-- Knowledge assets joined with persona metadata
create or replace view public.agent_knowledge_assets_v as
select
  d.id,
  d.agent_id,
  p.name as agent_name,
  d.title,
  d.source_url,
  d.storage_path,
  d.embedding_status,
  coalesce(d.metadata, '{}'::jsonb) as metadata,
  d.created_at
from public.agent_documents d
join public.agent_personas p on p.id = d.agent_id;

comment on view public.agent_knowledge_assets_v is
  'Agent knowledge base documents with persona metadata and ingestion status.';

-- Tool catalog projection (ensures consistent column casing for app consumption)
create or replace view public.agent_tools_v as
select
  t.id,
  t.tool_name,
  t.category,
  t.description,
  t.json_schema,
  t.rate_limit_per_minute,
  t.enabled,
  coalesce(t.metadata, '{}'::jsonb) as metadata,
  t.created_at,
  t.updated_at
from public.agent_tool_catalog t;

comment on view public.agent_tools_v is
  'Tool registry projection for admin UI consumption.';

-- Agent task projection with persona information
create or replace view public.agent_tasks_v as
select
  t.id,
  t.agent_id,
  p.name as agent_name,
  t.title,
  t.status,
  coalesce(t.payload, '{}'::jsonb) as payload,
  t.created_by,
  t.assigned_to,
  t.due_at,
  t.created_at
from public.agent_tasks t
join public.agent_personas p on p.id = t.agent_id;

comment on view public.agent_tasks_v is
  'Admin-friendly projection of agent tasks with persona names and payload.';

-- Grant read access to authenticated clients for the projections
grant select on public.driver_locations_latest to authenticated, anon, service_role;
grant select on public.sla_timers to authenticated, anon, service_role;
grant select on public.agent_requests_v to authenticated, anon, service_role;
grant select on public.negotiation_candidates_v to authenticated, anon, service_role;
grant select on public.negotiation_messages_v to authenticated, anon, service_role;
grant select on public.negotiation_threads_v to authenticated, anon, service_role;
grant select on public.agent_knowledge_assets_v to authenticated, anon, service_role;
grant select on public.agent_tools_v to authenticated, anon, service_role;
grant select on public.agent_tasks_v to authenticated, anon, service_role;

commit;
