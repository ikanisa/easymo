# Station PWA

High-contrast progressive web app for station operators to redeem vouchers.

## Guardrails

- All work must follow the repository-wide additive-only policy
  (`ADD_ONLY_RULES.md`).
- Do not edit forbidden paths; Station features integrate through Admin APIs.

## Current State

- App skeleton pending implementation (see roadmap tasks T19–T22).
- Planned features: Login, Redeem via QR/Code, Balance, History.

## Development Notes

- Target outdoor usability with large fonts and strong contrast.
- The redeem flow must call `/api/station/redeem` atomically.
- Follow UX guidance in `UX_POLISH_BRIEF.md` and QA steps in `QA_MATRIX.md`.
