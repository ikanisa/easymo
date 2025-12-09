# API Surface

## Stability levels

- **Stable**: `@ibimina/locales` exposes locale content packs, message
  registries, and resolution helpers through `src/index.public.ts`.
- **Supported subpaths**: Use the root import for accessing locale utilities and
  message/content pack exports.
- **Private**: Deep imports into locale files or any `../internal/*` references
  are not supported.

## Deprecations

- None.

## Notes

Rely on the root entrypoint so locale organization can change without affecting
consumers.
