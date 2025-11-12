# Agent Configurations

This directory contains the comprehensive AI agent configurations for the EasyMO WhatsApp-first platform.

## Overview

The EasyMO platform uses 15 specialized AI agents to handle various service categories, from mobility and dining to insurance and video generation. Each agent is configured with specific instructions, tools, guardrails, and operational parameters.

## Configuration Structure

### YAML Format

The main configuration file is `agent_configs.yaml`, which defines each agent with the following schema:

```yaml
- slug: agent-identifier          # Unique kebab-case identifier
  name: Display Name              # Human-readable agent name
  enabled: true/false             # Whether the agent is active
  languages: [en, fr, rw, sw, ln] # Supported language codes
  autonomy: auto|suggest|handoff  # Autonomy level
  tools: []                       # Array of available tools
  guardrails: {}                  # Safety and operational limits
  instructions: |                 # Complete system prompt
    ROLE: ...
    GOAL: ...
    STYLE: ...
    BEHAVIOR: ...
    FLOW: ...
```

### Database Schema

Agent configurations are stored in the `agent_registry` table with the following structure:

- **Core Fields:**
  - `id`: UUID primary key
  - `agent_type`: Unique identifier (snake_case)
  - `slug`: Unique kebab-case identifier
  - `name`: Display name
  - `description`: Brief description

- **Configuration:**
  - `enabled`: Boolean flag
  - `languages`: Array of language codes
  - `autonomy`: Level of automation (auto/suggest/handoff)
  - `enabled_tools`: Array of tool names
  - `guardrails`: JSONB object with safety/operational limits
  - `instructions`: Full system prompt
  - `system_prompt`: Short system context

- **Orchestration:**
  - `sla_minutes`: Service level agreement timeout
  - `max_extensions`: Maximum session extensions
  - `fan_out_limit`: Max concurrent vendor queries
  - `counter_offer_delta_pct`: Negotiation threshold
  - `auto_negotiation`: Auto-negotiation flag
  - `feature_flag_scope`: Deployment scope (disabled/staging/prod_*)

## Autonomy Levels

### Auto (Full Automation)
- Agent operates autonomously end-to-end
- No human approval required
- Used for: Concierge Router, Waiter AI, Shop Agent, Payments

### Suggest (Requires Approval)
- Agent proposes actions, waits for confirmation
- Human approval for critical decisions
- Used for: Mobility, Pharmacy, Hardware, Insurance, Property

### Handoff (Human Required)
- Agent collects information, hands off to human
- No autonomous decision-making
- Used for: Legal Intake, Marketing & Sales, Sora Video

## Agent Catalog

### 1. Concierge Router
**Purpose:** Front-door triage for WhatsApp service hub  
**Autonomy:** Auto  
**Languages:** EN, FR, RW, SW, LN  
**Key Features:** Intent detection, routing, escalation

### 2. Waiter AI
**Purpose:** Dine-in ordering with QR-table sessions  
**Autonomy:** Auto  
**Languages:** EN, FR, RW  
**Key Features:** Menu presentation, order processing, payment, kitchen notification

### 3. Mobility Orchestrator
**Purpose:** Passenger/driver matching and trip scheduling  
**Autonomy:** Suggest  
**Languages:** EN, FR, RW, SW  
**Key Features:** Location-based matching, ETA estimation, booking confirmation

### 4. Pharmacy Agent
**Purpose:** OTC medication sourcing and RX handling  
**Autonomy:** Suggest  
**Languages:** EN, FR  
**Key Features:** Product search, substitution, RX verification, pharmacist escalation

### 5. Hardware Agent (Quincaillerie)
**Purpose:** Hardware store item sourcing  
**Autonomy:** Suggest  
**Languages:** EN, FR  
**Key Features:** Specification gathering, compatibility suggestions, delivery quotes

### 6. Shop Agent
**Purpose:** Convenience/grocery shopping with substitutions  
**Autonomy:** Auto  
**Languages:** EN, FR  
**Key Features:** Smart substitutions, basket building, delivery tracking

### 7. Insurance Agent
**Purpose:** Policy quotes with OCR document extraction  
**Autonomy:** Suggest  
**Languages:** EN, FR, RW  
**Key Features:** OCR extraction, premium calculation, certificate generation

### 8. Property Rentals Agent
**Purpose:** Property search and viewing coordination  
**Autonomy:** Suggest  
**Languages:** EN, FR  
**Key Features:** Filtering, shortlisting, viewing scheduling, deposit collection

### 9. Legal Intake Agent
**Purpose:** Legal service triage (no legal advice)  
**Autonomy:** Handoff  
**Languages:** EN, FR  
**Key Features:** Category classification, fact gathering, retainer collection

### 10. Payments Agent
**Purpose:** MoMo payment orchestration  
**Autonomy:** Auto  
**Languages:** EN, FR  
**Key Features:** Payment link creation, webhook handling, receipt generation

### 11. Marketing & Sales Agent
**Purpose:** WhatsApp campaign planning  
**Autonomy:** Handoff  
**Languages:** EN, FR  
**Key Features:** Campaign briefs, template selection, compliance checks

### 12. Sora-2 Video Agent
**Purpose:** Brand-safe video ad generation  
**Autonomy:** Handoff  
**Languages:** EN, FR  
**Key Features:** Brand kit verification, prompt validation, video generation

### 13. Support & Handoff Agent
**Purpose:** Human escalation coordination  
**Autonomy:** Auto  
**Languages:** EN, FR, RW, SW, LN  
**Key Features:** Context summarization, staff notification, SLA tracking

### 14. Localization & Country Pack Agent
**Purpose:** Locale and compliance enforcement  
**Autonomy:** Auto  
**Languages:** EN, FR  
**Key Features:** Locale detection, template selection, market restrictions

### 15. Analytics & Risk Agent
**Purpose:** Funnel analytics and anomaly detection  
**Autonomy:** Auto  
**Languages:** EN, FR  
**Key Features:** Event logging, risk scoring, pattern detection

## Tool Catalog

Agents have access to the following tools:

### Data Access
- `search_supabase`: Query database for entities
- `inventory_check`: Check product/service availability
- `maps_geosearch`: Location-based search

### Operations
- `order_create`: Create new orders
- `order_status_update`: Update order status
- `schedule_viewing`: Schedule property viewings
- `momo_charge`: Initiate MoMo payment

### Document Processing
- `ocr_extract`: Extract text from images
- `generate_pdf`: Generate PDF documents
- `sora_generate_video`: Generate video clips

### Communication
- `notify_staff`: Escalate to human staff
- `analytics_log`: Log events and metrics

## Guardrails

Each agent has specific guardrails to ensure safe and compliant operation:

### Privacy & Security
- `pii_minimization`: Minimize collection of personal data
- `never_collect_card`: Never collect credit card details
- `location_privacy`: Use only coarse location data

### Operational Limits
- `max_clarifying_questions`: Limit back-and-forth
- `payment_limits`: Transaction amount caps
- `delivery_fee_threshold_kg`: Weight-based delivery fees

### Compliance
- `medical_advice`: Forbidden for pharmacy agent
- `advice`: Forbidden for legal intake agent
- `only_preapproved_templates`: Marketing campaigns
- `require_brand_kit`: Video generation

### Approval Thresholds
- `premium_gt`: Insurance premium approval limit
- `ocr_conf_lt`: OCR confidence threshold
- `pharmacist_review_required`: RX verification

## Database Migrations

### Schema Extension
**File:** `supabase/migrations/20260323100000_agent_registry_extended_config.sql`

Extends the `agent_registry` table with:
- `slug`: Kebab-case identifier
- `languages`: Supported language array
- `autonomy`: Autonomy level enum
- `guardrails`: JSONB configuration
- `instructions`: Full system prompt

### Seed Data
**File:** `supabase/migrations/20260323100100_agent_registry_seed_configs.sql`

Populates all 15 agent configurations with:
- Complete instructions (ROLE/GOAL/STYLE/FLOW)
- Tool assignments
- Guardrail definitions
- Language support
- Autonomy levels

Both migrations are idempotent using `ON CONFLICT` clauses.

## Usage

### Accessing Agent Configuration

```typescript
// Query agent by slug
const agent = await supabase
  .from('agent_registry')
  .select('*')
  .eq('slug', 'concierge-router')
  .single();

// Get enabled agents for a language
const agents = await supabase
  .from('agent_registry')
  .select('*')
  .eq('enabled', true)
  .contains('languages', ['fr']);
```

### Loading YAML Configuration

```typescript
import yaml from 'yaml';
import fs from 'fs';

const config = yaml.parse(
  fs.readFileSync('config/agent_configs.yaml', 'utf8')
);

const concierge = config.find(a => a.slug === 'concierge-router');
```

### Invoking an Agent

```typescript
// Route through concierge
const session = await createAgentSession({
  userId,
  agentType: 'concierge_router',
  requestData: { message: userInput, locale: 'en' }
});

// Direct invocation
const session = await createAgentSession({
  userId,
  agentType: 'waiter_ai',
  requestData: { 
    venueId,
    tableNumber,
    message: userInput 
  }
});
```

## Ground Rules Compliance

All agent configurations comply with the EasyMO Ground Rules:

### 1. Observability
- All agents use `analytics_log` tool for structured logging
- Event tracking at key checkpoints
- Correlation IDs for tracing

### 2. Security
- No secrets in client-facing variables
- PII minimization enforced via guardrails
- Payment card details never collected in chat
- Webhook signature verification

### 3. Feature Flags
- All agents have `feature_flag_scope` configuration
- Default to 'disabled' for safe rollout
- Gradual enablement (staging → prod_10% → prod_100%)

## Testing

### Configuration Validation
```bash
# Validate YAML syntax
python3 -c "import yaml; yaml.safe_load(open('config/agent_configs.yaml'))"

# Check migration hygiene
bash scripts/check-migration-hygiene.sh
```

### Agent Testing
```bash
# Unit tests for agent logic
pnpm --filter @easymo/agents test

# Integration tests with database
pnpm test:integration

# E2E tests with WhatsApp simulator
pnpm test:e2e
```

## Deployment

### Staging
1. Apply migrations: `supabase db push`
2. Verify agent_registry populated
3. Update feature flags: `feature_flag_scope = 'staging'`
4. Test via staging WhatsApp number

### Production
1. Review agent performance in staging
2. Update feature flags: `feature_flag_scope = 'prod_10%'`
3. Monitor metrics and error rates
4. Gradual rollout: `prod_10%` → `prod_50%` → `prod_100%`

## Maintenance

### Adding a New Agent
1. Add configuration to `agent_configs.yaml`
2. Create migration to insert into `agent_registry`
3. Implement agent logic in appropriate service
4. Add feature flag entry
5. Create tests
6. Deploy to staging first

### Updating an Agent
1. Modify `agent_configs.yaml`
2. Create migration to update existing record
3. Test changes in staging
4. Deploy with feature flag rollback plan

### Deprecating an Agent
1. Set `enabled = false` in database
2. Set `feature_flag_scope = 'disabled'`
3. Monitor for active sessions
4. Archive agent code after grace period

## Support

For questions or issues:
- Review [GROUND_RULES.md](../docs/GROUND_RULES.md)
- Check [AGENT_CATALOG_COMPLETE.md](../docs/AGENT_CATALOG_COMPLETE.md)
- Consult [API_DOCUMENTATION.md](../docs/API_DOCUMENTATION.md)

## License

Proprietary - EasyMO Platform
