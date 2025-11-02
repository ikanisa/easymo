# App APIs (Strangler Workbench)

This app will expose the modular HTTP APIs that will eventually replace the bundled endpoints inside `apps/api/`.

Migration approach:

- Start by mirroring high-risk endpoints while still delegating to the legacy controllers.
- Use feature-flag guards from `packages/config` to gradually cut traffic over.
- Share DTOs and validation logic from `packages/clients` and `packages/utils` as they come online.

> **Status:** placeholder only – use this directory for design docs and migration spikes.
