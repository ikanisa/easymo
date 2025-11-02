# Utilities (Strangler Workbench)

This package will collect shared helpers that we want to use from both the legacy code (`packages/shared/`, `packages/commons/`) and the new packages.

Migration approach:

- Fork utilities here while keeping them compatible with the legacy imports via re-export shims.
- Establish lint + test scaffolding once the first shared helpers move over.
- Prefer pure functions so the package stays side-effect free for runtime sharing.

> **Status:** placeholder only – add RFCs here before moving code.
