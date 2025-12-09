# API Surface

## Stability levels

- **Stable**: `@ibimina/supabase-schemas` exposes Supabase generated types via
  `src/index.public.ts`.
- **Supported subpaths**: Use the root import for `Database`, `Json`, and
  `SchemaName` types.
- **Private**: Deep imports or `../internal/*` paths are not supported.

## Deprecations

- None.

## Notes

Rely on the root entrypoint for schema types to keep generated outputs
encapsulated.
