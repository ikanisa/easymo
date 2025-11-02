# Utils Package (Strangler Fig)

Shared utilities extracted from the legacy [`../../src`](../../src) tree will be relocated here over time.

Keep new cross-cutting helpers in this package and backfill the existing call sites by referencing the built outputs until the direct imports from `src/` can be retired.
