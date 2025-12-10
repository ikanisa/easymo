# API Surface

## Stability levels

- **Stable**: `@ibimina/ui` exports the supported components, utilities, and
  theme tokens through `src/index.public.ts`.
- **Supported subpaths**: Consume UI pieces from the root package import to stay
  on the stable surface.
- **Private**: Deep imports into component files or any `../internal/*` usage
  are private and may change.

## Deprecations

- None documented.

## Notes

Use the documented public entrypoint rather than file-level paths when building
UI screens.
