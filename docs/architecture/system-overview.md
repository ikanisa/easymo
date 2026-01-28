# System Overview

EasyMo is a WhatsApp-first platform for Rwanda (RW). UI languages are English and French; currency is RWF.

## High-Level Architecture

```
WhatsApp Cloud API (Meta)        Admin App (Next.js)
           |                               |
           v                               v
    Supabase Edge Functions        Supabase/Postgres APIs
           |                               |
           +---------------+---------------+
                           v
                Supabase PostgreSQL
                           |
                           v
                 Cloud Run Services
```

## Core Layers
- Client: WhatsApp and Admin App (Next.js)
- Edge: Supabase Functions (wa-webhook-* and admin-*)
- Services: Node/NestJS services in `services/*`
- Data: Supabase Postgres, plus optional Redis/Kafka if enabled

## Guardrails (Non-Negotiable)
- WhatsApp Cloud API only (no Twilio)
- USSD-based mobile money (no MoMo API)
- No Kinyarwanda UI translation
- Rwanda (RW) only
