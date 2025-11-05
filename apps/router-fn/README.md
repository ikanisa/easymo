# Router Function (Strangler Fig)

This directory will host the Supabase Edge Functions that gradually replace the logic currently concentrated in [`../api`](../api) and [`../../supabase/functions`](../../supabase/functions).

Expect hybrid deployments where specific routes are proxied into this folder while the remainder keep flowing through the legacy handlers until parity is achieved.
