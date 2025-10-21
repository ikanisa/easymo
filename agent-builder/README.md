Agent Builder – Broker AI and Voice Agents

This folder contains ready‑to‑import tool definitions and workflow blueprints for OpenAI Agent Builder.

How to use
- Replace placeholder base URLs and tokens in tools.json with your environment values (see .env.example).
- Import tools first, then import workflows and bind each step to the corresponding tool.
- Ensure all tool calls propagate `x-request-id` and set `Idempotency-Key` (ulid).

Service endpoints (default local)
- Agent‑Core: http://localhost:4000
- Buyer Service: http://localhost:4700
- Vendor Service: http://localhost:4600
- Ranking Service: http://localhost:4500
- Wallet Service: http://localhost:4400
- WhatsApp Bot: http://localhost:4800
- Attribution Service: http://localhost:4900
- Reconciliation Service: http://localhost:5000

Security & headers
- Agent‑Core tools require `x-agent-jwt` (service token or signed JWT).
- Other services use service tokens via `Authorization: Bearer <token>` if deployed behind a gateway.
- Always include `x-request-id` and `Idempotency-Key`.

URL variables to set when importing
- AGENT_CORE_URL, MARKETPLACE_BUYER_URL, MARKETPLACE_VENDOR_URL, MARKETPLACE_RANKING_URL, WALLET_SERVICE_URL, WHATSAPP_BOT_URL, ATTRIBUTION_SERVICE_URL, RECONCILIATION_SERVICE_URL

Workflows
- intent_to_quote.json – WhatsApp intent ➜ shortlist ➜ decision.
- purchase_and_commission.json – Confirmations ➜ postings ➜ settled.
- feedback_loop.json – Feedback flow ➜ quality updates.
