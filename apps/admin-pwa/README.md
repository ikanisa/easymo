# Admin PWA (Strangler Workbench)

This package is the future home of the progressive web application that will replace the legacy `admin-app/` Next.js bundle.

We will migrate screen-by-screen using the strangler fig pattern:

- New functionality lands here first.
- Existing admin flows are proxied to the React app in `admin-app/` until they are rewritten.
- Shared UI primitives will graduate into `packages/ui/` so both worlds can coexist.

> **Status:** placeholder only – use this README to coordinate carve-out plans before wiring up build tooling.
