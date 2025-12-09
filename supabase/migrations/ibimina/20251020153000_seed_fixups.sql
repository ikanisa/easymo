-- Align seeded app schema data with legacy sources without overwriting existing customisations

begin;

-- Ensure merchant_code and metadata from legacy records persist in app.saccos
DO $$
DECLARE
  has_merchant boolean;
  has_metadata boolean;
BEGIN
  IF to_regclass('public.saccos') IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'saccos'
      AND column_name = 'merchant_code'
  ) INTO has_merchant;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'saccos'
      AND column_name = 'metadata'
  ) INTO has_metadata;

  IF has_merchant THEN
    UPDATE app.saccos s
    SET merchant_code = src.merchant_code,
        updated_at = timezone('UTC', now())
    FROM public.saccos src
    WHERE s.id = src.id
      AND src.merchant_code IS NOT NULL
      AND src.merchant_code <> s.merchant_code;
  END IF;

  IF has_metadata THEN
    UPDATE app.saccos s
    SET metadata = coalesce(src.metadata, '{}'::jsonb),
        updated_at = timezone('UTC', now())
    FROM public.saccos src
    WHERE s.id = src.id
      AND src.metadata IS NOT NULL
      AND src.metadata <> s.metadata;
  END IF;
END;
$$;

-- Back-fill sacco relationships on app.accounts when the legacy table exposes them
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'accounts'
      and column_name = 'sacco_id'
  ) then
    update app.accounts a
    set sacco_id = src.sacco_id,
        updated_at = timezone('UTC', now())
    from public.accounts src
    where a.id = src.id
      and src.sacco_id is not null
      and (
        a.sacco_id is distinct from src.sacco_id
        or a.sacco_id is null
      );
  end if;
end;
$$;

-- Propagate sacco context into ledger entries where possible
with account_map as (
  select id, sacco_id
  from app.accounts
  where sacco_id is not null
)
update app.ledger_entries le
set sacco_id = acc.sacco_id
from account_map acc
where le.debit_id = acc.id
  and (
    le.sacco_id is distinct from acc.sacco_id
    or le.sacco_id is null
  );

with credit_account_map as (
  select id, sacco_id
  from app.accounts
  where sacco_id is not null
)
update app.ledger_entries le
set sacco_id = acc.sacco_id
from credit_account_map acc
where le.sacco_id is null
  and le.credit_id = acc.id;

commit;
