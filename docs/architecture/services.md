# Services

This repo is a pnpm workspace with edge functions, services, and shared packages.

## Edge Functions (Supabase)
Location: `supabase/functions`

Core entry points:
- wa-webhook-core: verification, routing, home menu
- wa-webhook-mobility: mobility workflow
- wa-webhook-profile: profile and wallet
- wa-webhook-insurance: insurance workflow
- wa-webhook-buy-sell / wa-webhook-marketplace: marketplace flows
- admin-* functions: admin settings, stats, users, trips

## Cloud Run Services
Location: `services/*`

Common services:
- agent-core: AI agent orchestration
- wallet-service: ledger and wallet operations
- ranking-service: ranking and matching
- voice-bridge / voice-gateway: SIP and voice flows
- buyer-service, tracking-service: domain-specific services
- openai-responses-service / openai-deep-research-service: internal AI support

## Shared Packages
Location: `packages/*`

Common packages:
- @easymo/commons: shared utils and infra
- @easymo/agents, @easymo/ai: agent logic
- @easymo/sms-parser: SMS parsing for USSD flows
- @easymo/ui: shared UI components
- @easymo/supabase-schemas: schema bindings
- @easymo/vendor-admin-core: vendor/admin workflows
