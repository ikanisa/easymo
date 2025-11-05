# Supabase Infrastructure (Strangler Fig)

This folder will house Terraform and edge function deployment scripts that gradually replace the handcrafted assets under [`../../supabase`](../../supabase) and [`../cloudflared`](../cloudflared).

Expect to see one-for-one migrations that keep the existing pipelines running while new IaC modules are validated side-by-side.
