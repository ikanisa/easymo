# Clients Package (Strangler Fig)

HTTP and realtime clients extracted from [`../../src/lib`](../../src/lib) and [`../../services`](../../services) will progressively migrate into this workspace.

We will dual-publish adapters so that new code consumes the typed clients here while the legacy call sites continue using the current helpers until they can be rewritten.
