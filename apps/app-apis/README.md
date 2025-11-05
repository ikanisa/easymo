# App APIs (Strangler Fig)

Use this space to spin up scoped API surfaces that will supersede the monolithic [`../api`](../api) service.

During the transition we will forward only new endpoints through this package while legacy routes remain in place, allowing for dual-running verification before retirement.
