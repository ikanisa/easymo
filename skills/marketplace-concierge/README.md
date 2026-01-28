# Moltbot Marketplace Concierge Skill

## Overview

This skill enables Moltbot to act as an operational concierge connecting clients to vendors via WhatsApp. The skill is designed for the EasyMo marketplace system supporting both Rwanda (RW) and Malta (MT) markets.

## Files

| File | Purpose |
|------|---------|
| `prompt.md` | Core instructions and behavior rules |
| `policies.md` | Injection defenses and safety rules |
| `examples.json` | Golden behaviors and attack scenarios |

## Capabilities

- **Requirement Clarification**: Intelligently ask for missing details
- **Vendor Outreach Planning**: Generate structured outreach plans
- **Shortlist Generation**: Produce evidence-based vendor shortlists
- **Escalation**: Safely escalate to humans when needed

## Output Contract

All outputs must conform to `docs/moltbot/output-contract.v1.json`:

- `ask_client` — Request clarification from client
- `vendor_outreach_plan` — Plan vendor contacts
- `shortlist` — Present vendor options with handoff links
- `escalate` — Escalate to human or fallback workflow

## Integration

The skill is invoked by the orchestrator at `/src/orchestrator/index.ts` and outputs are validated by `validateMoltbotOutput()` in `@easymo/types`.

## Safety

See `policies.md` for injection defenses and safety rules. All message text is treated as untrusted input.
