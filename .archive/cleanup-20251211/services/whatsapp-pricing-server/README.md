# WhatsApp Motor Pricing Server

This service glues three flows together:

1. Receives logbooks / yellow cards / photos through the WhatsApp Cloud API (or the `/simulate` endpoint).
2. Extracts structured data using `@insure/ocr-extract` (OpenAI Vision).
3. Computes itemised quotes for BK, Old Mutual, Prime and Radiant via `@insure/pricing-engine` and replies over WhatsApp.

## Quick start

```bash
cd services/whatsapp-pricing-server
pnpm install
pnpm dev            # ts-node
# or build + run
pnpm build && pnpm start
```

Environment variables:

- `OPENAI_API_KEY` – required for OCR/classification.
- `OCR_MODEL` – optional override (defaults to `gpt-4o-mini`).
- `WHATSAPP_PHONE_ID` / `WHATSAPP_TOKEN` – required when you want the bot to reply on WhatsApp (including the webhook).
- `WHATSAPP_VERIFY_TOKEN` – token Meta checks during webhook verification (`GET /webhook`).
- `PORT` – defaults to `8080`.

## Endpoints

- `POST /simulate` – multipart form (`files` array). Any missing fields (sum insured, seats, etc.) can be provided as form fields. Response contains the parsed inputs and per-insurer quotes (each quote now includes a ready-to-dial MoMo USSD string). If `to` is set (E.164), the service also sends the formatted result via WhatsApp Cloud API.
- `GET /paylink?provider=BK%20Insurance&amount=200000` – returns the insurer profile, the raw USSD string (`*182*8*1*<merchant>*<amount>*<ref>#`) and a `tel:` deep link based on the MoMo merchant configured for that insurer.
- `POST /webhook` – fully wired: handles Meta verification, stores a per-customer state machine, downloads media via the Cloud API, extracts overrides from free text (sum insured, COMESA, occupant plan), and triggers the same pricing run once the inputs are complete (`type "quote"` to force a run).

See [`FLOW.md`](./FLOW.md) for the scripted UX (greeting → uploads → confirmation → comparison table → payment). The live webhook follows the same flow automatically.

## Insurer metadata (MoMo USSD codes & contacts)

`packages/pricing-engine/src/insurers.ts` defines a structured table for BK, Old Mutual, Prime and Radiant (legal name, MoMo merchant code, reference prefix, support/claims contacts, etc.). The pricing payload and WhatsApp copy both read from this table, so updating MoMo numbers or contact details only requires editing that single file.
