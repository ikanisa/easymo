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
