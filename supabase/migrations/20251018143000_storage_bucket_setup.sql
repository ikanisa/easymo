-- Ensure required storage buckets exist for Phase 2 features.
-- Buckets: insurance-docs, kyc-documents, menu-source-files, ocr-json-cache, vouchers

BEGIN;
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'insurance-docs') then
    perform storage.create_bucket('insurance-docs', public => false);
  end if;

  if not exists (select 1 from storage.buckets where id = 'kyc-documents') then
    perform storage.create_bucket('kyc-documents', public => false);
  end if;

  if not exists (select 1 from storage.buckets where id = 'menu-source-files') then
    perform storage.create_bucket('menu-source-files', public => false);
  end if;

  if not exists (select 1 from storage.buckets where id = 'ocr-json-cache') then
    perform storage.create_bucket('ocr-json-cache', public => false);
  end if;

  if not exists (select 1 from storage.buckets where id = 'vouchers') then
    perform storage.create_bucket('vouchers', public => false);
  end if;
end;
$$;
COMMIT;
