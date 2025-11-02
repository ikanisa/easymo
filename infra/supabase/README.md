# Supabase Infra (Strangler Workbench)

This directory will track the Terraform/configuration that replaces the handcrafted setup in `supabase/` and `infrastructure/`.

Strangler principles:

- Document every schema/policy change here before applying it to the managed project.
- Keep migration scripts compatible with the existing SQL tooling until cutover.
- Use this folder to stage IaC experiments before rolling them into the production pipeline.

> **Status:** placeholder only – coordinate with the data team before committing infrastructure changes.
