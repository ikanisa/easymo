-- Add formal district organization link to saccos
alter table app.saccos
  add column if not exists district_org_id uuid null references app.organizations(id) on delete set null;

create index if not exists saccos_district_org_idx on app.saccos(district_org_id);

-- Attempt backfill: match organizations by name (case-insensitive) and type DISTRICT
update app.saccos s
set district_org_id = o.id
from app.organizations o
where o.type = 'DISTRICT'
  and upper(coalesce(s.district, '')) = upper(o.name)
  and s.district_org_id is null;

-- Note: After manual verification, consider enforcing NOT NULL:
-- alter table app.saccos alter column district_org_id set not null;

