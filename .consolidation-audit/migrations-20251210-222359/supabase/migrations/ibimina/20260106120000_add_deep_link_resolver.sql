create or replace function public.resolve_deep_link(route text, identifier text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  result jsonb;
  group_row record;
  invite_row record;
  identifier_uuid uuid;
begin
  if route = 'join' then
    begin
      identifier_uuid := identifier::uuid;
    exception
      when invalid_text_representation then
        return jsonb_build_object('status', 'not_found', 'type', route);
    end;

    select g.id, g.name, g.status
    into group_row
    from public.ibimina g
    where g.id = identifier_uuid;

    if not found then
      return jsonb_build_object('status', 'not_found', 'type', route);
    end if;

    result := jsonb_build_object(
      'status', coalesce(lower(group_row.status::text), 'unknown'),
      'type', 'join',
      'targetId', group_row.id,
      'groupName', group_row.name,
      'scheme', 'ibimina://join/' || group_row.id
    );

    return result;
  elsif route = 'invite' then
    select gi.id, gi.token, gi.status, gi.group_id, ig.name as group_name
    into invite_row
    from public.group_invites gi
    left join public.ibimina ig on ig.id = gi.group_id
    where gi.token = identifier;

    if not found then
      return jsonb_build_object('status', 'not_found', 'type', route);
    end if;

    result := jsonb_build_object(
      'status', coalesce(lower(invite_row.status::text), 'unknown'),
      'type', 'invite',
      'targetId', invite_row.group_id,
      'groupName', invite_row.group_name,
      'token', invite_row.token,
      'scheme', 'ibimina://invite/' || invite_row.token
    );

    return result;
  else
    return jsonb_build_object('status', 'unsupported', 'type', route);
  end if;
end;
$$;

revoke all on function public.resolve_deep_link(text, text) from public;

grant execute on function public.resolve_deep_link(text, text) to anon;
grant execute on function public.resolve_deep_link(text, text) to authenticated;
grant execute on function public.resolve_deep_link(text, text) to service_role;
