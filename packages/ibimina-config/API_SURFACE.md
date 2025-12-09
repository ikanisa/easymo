# API Surface

## Stability levels

- **Stable**: `@ibimina/config` exposes environment helpers, feature flag
  helpers, and USSD configuration through `src/index.public.ts`.
- **Supported subpaths**: The root export covers the supported helpers; other
  file-level imports are private.
- **Private**: Direct imports to files under `src/` or any `../internal/*` path
  are not supported and may change.

## Deprecations

- None noted.

## Notes

Consume configuration helpers from the root entrypoint to avoid breaking changes
during refactors.
