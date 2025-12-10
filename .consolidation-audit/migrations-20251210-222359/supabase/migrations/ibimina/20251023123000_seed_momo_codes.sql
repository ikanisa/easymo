-- Generate deterministic MoMo codes for each district (MTN) and backfill account names.
with ranked as (
  select
    id,
    district,
    row_number() over (partition by upper(provider) order by upper(district)) as rn
  from app.momo_codes
  where upper(provider) = 'MTN'
),
updated as (
  update app.momo_codes mc
  set
    code = format('182%03s', ranked.rn),
    account_name = coalesce(
      mc.account_name,
      format('Ibimina %s MoMo', initcap(ranked.district))
    ),
    provider = upper(mc.provider)
  from ranked
  where mc.id = ranked.id
  returning mc.*
)
select count(*) as mtn_momo_codes_updated from updated;
