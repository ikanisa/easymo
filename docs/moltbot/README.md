# Moltbot DineIn Integration

This directory contains documentation for the Moltbot integration with the DineIn ecosystem.

## Overview

Moltbot provides conversational AI capabilities across WhatsApp, Telegram, and other messaging channels. The DineIn skill enables:

- **Customer ordering** via natural language
- **Bar Manager operations** through chat interface
- **Admin controls** for platform management

## Quick Links

- [Moltbot Installation](file:///Volumes/PRO-G40/Apps/moltbot/src/README.md)
- [DineIn Skill Reference](file:///Volumes/PRO-G40/Apps/moltbot/src/skills/dinein/SKILL.md)
- [Multi-Agent Config](file:///Volumes/PRO-G40/Apps/moltbot/workspace/moltbot.json)

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   WhatsApp      │     │    Telegram     │     │   Other         │
│   Channel       │     │    Channel      │     │   Channels      │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │     Moltbot Gateway     │
                    │  (Agent Router + Tools) │
                    └────────────┬────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
┌────────▼────────┐   ┌─────────▼─────────┐   ┌────────▼────────┐
│ Customer Agent  │   │ Bar Manager Agent │   │  Admin Agent    │
│ (dinein-customer│   │ (dinein-bar-mgr)  │   │ (dinein-admin)  │
└────────┬────────┘   └─────────┬─────────┘   └────────┬────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   DineIn Supabase       │
                    │   (venues, menus,       │
                    │    orders, users)       │
                    └─────────────────────────┘
```

## Agent Routing

| User Role | Agent | Capabilities |
|-----------|-------|--------------|
| Anonymous/Customer | dinein-customer | Browse, order, ring bell |
| Venue Owner/Staff | dinein-bar-manager | + Order mgmt, analytics |
| Platform Admin | dinein-admin | Full access |

Routing is determined by user metadata (role field) attached during authentication.

## Setup

1. **Install Moltbot** (see main README)
2. **Configure DineIn credentials**:
   ```bash
   moltbot config set DINEIN_SUPABASE_URL "https://kczghhipbyykluuiiunp.supabase.co"
   moltbot config set DINEIN_SUPABASE_KEY "your-anon-key"
   ```
3. **Copy workspace config**:
   ```bash
   cp /Volumes/PRO-G40/Apps/moltbot/workspace/moltbot.json ~/.clawdbot/
   ```

## Security

- DM pairing required for unknown senders
- Rate limiting per agent type
- All operations logged for audit
- Service role keys stored in `~/.clawdbot/credentials/`

## Related Workflows

- [/02_conversation_backbone](/workflows/02_conversation_backbone.md) - Message handling
- [/08_moltbot_skill](/workflows/08_moltbot_skill.md) - Skill development
- [/19_security_hardening](/workflows/19_security_hardening.md) - Security audit
