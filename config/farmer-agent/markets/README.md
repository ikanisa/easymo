# Farmer Agent Market Configurations

This directory stores market-level JSON configuration that the farmer-facing
agents and edge functions consume. Each file describes:

- `marketCode`: stable identifier used across tools
- `timezone`: IANA timezone used for scheduling market-day alerts
- `allowedCities`: cities or logistics corridors we can target for the market
- `marketDays`: day-of-week strings when the market opens (lowercase English)
- `alertLeadHours`: number of hours before the market day when we send alerts
- `commodities`: commodity/variety level validation (units, grades, synonyms)
- `codFallback`: copy shown when we fall back to cash-on-delivery for merchants
- `whatsappTemplates`: intents/locales that map to WhatsApp template payloads

The JSON files are imported via `config/farmer-agent/markets/index.ts`, so any
new market should be referenced there as well.
