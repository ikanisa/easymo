# WhatsApp Templates for Farmer AI Agents

These JSON files describe localized template payloads that the AI agents use
when nudging buyers ahead of a market day. They mirror the structure of the
`whatsapp_templates` table so that operators can copy/paste payloads when
registering or refreshing templates in Meta Business Manager.

Each template file includes:

- `intent`: logical intent used by the template registry (e.g. `produce_market_alert`)
- `locale`: BCP-47 locale code
- `templateName`: the WhatsApp template name (must match what was approved)
- `variables.body`: ordered list of variable placeholders expected by the BODY
- `body`: translatable WhatsApp body text, using `{{1}}`, `{{2}}`, ... for vars
- `buttons`: optional quick-reply buttons surfaced to the buyer
- `samples`: example variable substitutions for QA teams
