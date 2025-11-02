# Clients (Strangler Workbench)

This package will centralize typed API clients that are currently scattered across `apps/api/`, `services/*`, and `packages/shared/`.

Migration approach:

- Start by wrapping existing fetch/axios utilities and progressively move callers over.
- Keep compatibility shims so legacy services can still import the older helpers while new surfaces use this package.
- Use semantic versioned exports when we eventually publish the clients outside the workspace.

> **Status:** placeholder only – use this space to spec the first shared client modules.
