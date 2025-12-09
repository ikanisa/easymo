# API Surface

## Stability levels

- **Stable**: `@ibimina/lib` provides security, USSD builder, and observability
  utilities via `src/index.public.ts`.
- **Supported subpaths**: Use the root package import; individual files under
  `observability/` or `security/` should be consumed through the public
  entrypoint.
- **Private**: Any deep imports or `../internal/*` style paths are outside the
  supported surface.

## Deprecations

- None.

## Notes

Rely on the public entrypoint to keep compatibility as internal folder
structures evolve.
