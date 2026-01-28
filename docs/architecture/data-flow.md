# Data Flow

## WhatsApp Inbound Flow

1. User sends a WhatsApp message.
2. Meta delivers the webhook to `wa-webhook-core`.
3. `wa-webhook-core` verifies the signature and routes by intent/state.
4. The target handler processes the request and reads/writes Supabase.
5. Response is sent back through the WhatsApp Cloud API.

## Mobility Flow (Button-Driven)

1. User selects a mobility action from the home menu.
2. User chooses vehicle type and shares location.
3. A trip is created with an auto-expiry.
4. Matching uses nearby trips and returns results.
5. Users connect directly via WhatsApp.

## Marketplace Flow (AI Agent)

1. User describes intent in natural language.
2. Buy & Sell agent classifies, searches, and suggests matches.
3. Results are delivered via WhatsApp responses and follow-up prompts.

## Admin App Flow

1. Admin App reads public data via Supabase client.
2. Admin actions call edge functions secured by admin token.
3. Changes persist to Supabase and update dashboards.
