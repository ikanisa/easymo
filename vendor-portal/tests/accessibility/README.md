# Accessibility Test Suite

This directory contains Vitest suites that assert keyboard support, focus
trapping, and escape routes for overlays such as the command palette and quick
actions sheet.

## Running the tests

Install workspace dependencies for the staff admin PWA first:

```bash
pnpm --filter @ibimina/staff-admin-pwa install
```

Then execute the component test runner:

```bash
pnpm --filter @ibimina/staff-admin-pwa test:component
```

The tests rely on Vitest and Testing Library. If the `vitest` binary is missing,
rerun the install step to populate `node_modules` before executing the suite.
