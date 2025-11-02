# Router Functions (Strangler Workbench)

This package will host the new request router functions that incrementally replace the monolithic handlers in `apps/api/` and `services/*`.

Strangler plan:

- Edge-friendly handlers live here and proxy to the existing Express/Node entry points until parity is reached.
- Feature flags exposed via `packages/config` control traffic shifting between the old and new routers.
- Telemetry hooks should report to the same dashboards as `apps/api/` during the coexistence phase.

> **Status:** placeholder only – do not wire into production traffic yet.
