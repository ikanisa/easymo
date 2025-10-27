PNPM ?= pnpm

.PHONY: deps build start admin caddy tunnel

deps:
	$(PNPM) install

build:
	$(PNPM) build

start:
	$(PNPM) start

admin:
	$(PNPM) --filter @easymo/admin-app dev

caddy:
	./scripts/mac/caddy-dev.sh

tunnel:
	./scripts/mac/tunnel.sh

.PHONY: db.push db.verify-wa-fixes

# Apply pending Supabase SQL migrations locally or to the configured remote
db.push:
	supabase db push

# Quick verification for WA fixes — requires psql and a reachable DB (SUPABASE_DB_URL)
db.verify-wa-fixes:
	psql "$$SUPABASE_DB_URL" -Atc "select 1 from information_schema.columns where table_schema='public' and table_name='marketplace_categories' and column_name='slug';" | grep -q 1 && echo "OK: marketplace_categories.slug present" || (echo "MISSING: marketplace_categories.slug" && exit 1)
	psql "$$SUPABASE_DB_URL" -Atc "select 1 from pg_views where schemaname='public' and viewname='whatsapp_menu_entries';" | grep -q 1 && echo "OK: public.whatsapp_menu_entries view present" || (echo "MISSING: public.whatsapp_menu_entries" && exit 1)
