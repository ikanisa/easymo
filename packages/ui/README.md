# UI Toolkit (Strangler Workbench)

This package will grow into the shared component library that unifies `admin-app/` widgets with the new Admin PWA in `apps/admin-pwa/`.

Short-term plan:

- Co-locate design tokens and primitives that can be consumed by both legacy and new front-ends.
- Keep exports backward-compatible with the components living in `admin-app/` until the migration finishes.
- Document breaking changes here and gate them behind the feature flags defined in `packages/config`.

> **Status:** placeholder only – start proposals here before moving code.
