# API Surface

## Stability levels

- **Stable**: `@ibimina/flags` exposes feature flag types, client helpers, and
  admin creation utilities through `src/index.public.ts`.
- **Supported subpaths**: Consume these exports from the root package import.
- **Private**: File-level imports or `../internal/*` paths are not supported and
  may change.

## Deprecations

- None.

## Notes

Use the documented public exports to keep feature flag integrations stable.
