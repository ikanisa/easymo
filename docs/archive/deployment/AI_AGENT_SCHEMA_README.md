# AI Agent Ecosystem - WhatsApp-First Schema

## Overview

This schema implements a **normalized, WhatsApp-first AI agent ecosystem** for Supabase/Postgres. All user interactions occur exclusively via WhatsApp chats, where AI agents parse natural language, extract structured intents, and manage domain-specific data.

## Architecture

### Core Principles

1. **WhatsApp-First**: All interactions via WhatsApp - no web UI or mobile app
2. **Intent-Driven**: Natural language → structured intents → DB updates
3. **Agent-Agnostic**: Generic messaging/intent tables + domain-specific tables
4. **Normalized**: Avoid redundancy; use foreign keys and views
5. **Additive-Only**: Schema changes are backward-compatible

### Supported Agents

| Agent Slug | Purpose | Domain |
|------------|---------|--------|
| `waiter` | Virtual waiter/maître d' | Restaurant menus, orders, reservations |
| `farmer` | Agricultural marketplace | Produce listings, farmer-buyer matching |
| `business_broker` | Business directory | Local business discovery, promotions |
| `real_estate` | Property search | Rental listings, property shortlisting |
| `jobs` | Job board | Job posts, seeker profiles, matching |
| `sales_cold_caller` | Lead generation | Lead management, conversion tracking |

## Schema Structure

### 1. Core Agent Meta Tables

#### `ai_agents`
Master registry of AI agents (one row per agent).

**Key Columns:**
- `slug` (unique): Agent identifier (`waiter`, `farmer`, etc.)
- `default_persona_code`: Points to default persona
- `default_system_instruction_code`: Points to default system prompt
- `is_active`: Enable/disable agent

#### `ai_agent_personas`
Persona definitions (tone, languages, traits).

**Key Columns:**
- `agent_id`: FK to `ai_agents`
- `code`: Persona identifier (e.g., `W-PERSONA`)
- `tone_style`: "Friendly, professional, attentive"
- `languages`: Array of supported languages (`{en, fr, rw}`)
- `is_default`: Mark as default persona for agent

#### `ai_agent_system_instructions`
System prompts, guardrails, and memory strategies.

**Key Columns:**
- `agent_id`: FK to `ai_agents`
- `code`: Instruction identifier (e.g., `W-SYS`)
- `instructions`: Main system prompt text
- `guardrails`: Safety constraints
- `memory_strategy`: How to maintain conversation context
- `is_active`: Enable/disable version

#### `ai_agent_tools`
Tools available to agents (DB queries, HTTP calls, Maps, SIP, etc.).

**Key Columns:**
- `agent_id`: FK to `ai_agents`
- `name`: Tool identifier (e.g., `search_menu_supabase`)
- `tool_type`: `db`, `http`, `deep_search`, `maps`, `sip`, `whatsapp`, etc.
- `input_schema` / `output_schema`: JSONB schemas
- `config`: Tool-specific configuration

#### `ai_agent_tasks`
High-level tasks per agent (e.g., `waiter_take_order`, `jobs_match`).

**Key Columns:**
- `agent_id`: FK to `ai_agents`
- `code`: Task identifier
- `tools_used`: Array of tool names
- `requires_human_handoff`: Flag for escalation

#### `ai_agent_knowledge_bases`
Logical knowledge bases (menus, produce catalogue, job posts, etc.).

**Key Columns:**
- `agent_id`: FK to `ai_agents`
- `storage_type`: `table`, `view`, `vector_store`, `external`
- `access_method`: How agent queries the KB (e.g., `tool:search_menu_supabase`)
- `update_strategy`: How KB is updated (`admin_ui`, `cron_daily`, etc.)

### 2. WhatsApp-First Messaging & Intent Tables

#### `whatsapp_users`
All end-users and business staff (one row per phone number).

**Key Columns:**
- `phone_number` (unique): E.164 format (e.g., `+250788123456`)
- `preferred_language`: Default language for responses
- `user_roles`: Array of roles (`{guest, driver, farmer, landlord}`)

#### `whatsapp_conversations`
Logical conversation thread (user × agent × context).

**Key Columns:**
- `user_id`: FK to `whatsapp_users`
- `agent_id`: FK to `ai_agents`
- `context`: Domain context (e.g., `bar_menu`, `job_search`)
- `status`: `active`, `closed`, `paused`
- `last_message_at`: Timestamp of last message

**Example:** User +250788123456 chatting with `waiter` agent about Bar X menu.

#### `whatsapp_messages`
Raw WhatsApp messages (inbound from user, outbound from agent).

**Key Columns:**
- `conversation_id`: FK to `whatsapp_conversations`
- `direction`: `inbound` or `outbound`
- `message_type`: `text`, `button`, `list`, `image`, etc.
- `body`: Plain text content
- `payload`: Full WhatsApp webhook JSON (for debugging)

#### `ai_agent_intents`
**CRITICAL TABLE**: Structured representation of user intent extracted from messages.

**Key Columns:**
- `conversation_id`: FK to `whatsapp_conversations`
- `agent_id`: FK to `ai_agents`
- `message_id`: FK to `whatsapp_messages` (triggering message)
- `intent_type`: Domain-specific intent (e.g., `order_food`, `search_jobs`, `list_produce`)
- `summary`: Natural language summary ("User wants 2 beers and fries")
- `structured_payload`: **JSONB** with structured data to apply to domain tables
  ```json
  {
    "items": [{"name": "beer", "quantity": 2}, {"name": "fries", "quantity": 1}],
    "budget": 5000,
    "delivery": true
  }
  ```
- `status`: `pending`, `applied`, `rejected`
- `confidence`: 0.0-1.0 (agent's confidence in the parse)

**Flow:**
1. User sends WhatsApp message → stored in `whatsapp_messages`
2. Agent parses message → creates row in `ai_agent_intents`
3. Agent applies intent → updates domain tables (e.g., `orders`, `job_seekers`)
4. Intent status → `applied`

#### `ai_agent_match_events`
Generic log of matches across domains (jobs ↔ seekers, properties ↔ renters, etc.).

**Key Columns:**
- `agent_id`: FK to `ai_agents`
- `conversation_id`: FK to `whatsapp_conversations`
- `intent_id`: FK to `ai_agent_intents`
- `match_type`: `job`, `property`, `produce`, `business`, `menu_item`, `lead`
- `demand_ref`: JSONB reference to demand record (e.g., `{table: 'job_seekers', id: '...'})
- `supply_ref`: JSONB reference to supply record (e.g., `{table: 'job_posts', id: '...'})
- `score`: Relevance/ranking score (0.0-1.0)

**Example:**
```json
{
  "match_type": "job",
  "demand_ref": {"table": "job_seekers", "id": "uuid-123"},
  "supply_ref": {"table": "job_posts", "id": "uuid-456"},
  "score": 0.87,
  "metadata": {"distance_km": 5, "skill_overlap": ["python", "sql"]}
}
```

### 3. Master View

#### `ai_agents_overview_v`
Comprehensive view joining agents with personas, system instructions, and counts.

**Columns:**
- All `ai_agents` columns
- `default_persona_code`, `default_persona_role_name`
- `default_system_instruction_code`, `default_system_instruction_title`
- `tool_count`, `task_count`, `kb_count`

**Usage:** Admin dashboard, agent status monitoring.

## Indexes

### Performance-Critical Indexes

```sql
-- Lookups by phone number (every WhatsApp message)
idx_whatsapp_users_phone_number

-- Conversation queries (active conversations per user/agent)
idx_whatsapp_conversations_user_agent_status

-- Intent queries (pending intents for processing)
idx_ai_agent_intents_type_status

-- Message history (recent messages for context)
idx_whatsapp_messages_conversation_id
idx_whatsapp_messages_sent_at

-- Match queries (recent matches for feedback)
idx_ai_agent_match_events_match_type
```

### JSONB GIN Indexes

```sql
-- Advanced queries on structured payloads
idx_ai_agent_intents_structured_payload
idx_ai_agent_match_events_metadata
idx_whatsapp_messages_payload
```

**Example Query:**
```sql
-- Find all intents with budget constraint
SELECT * FROM ai_agent_intents
WHERE structured_payload @> '{"budget": 5000}'::jsonb;
```

## TypeScript Integration

### Database Row Types (snake_case)

Match database exactly:
```typescript
interface AiAgentRow {
  id: string;
  slug: string;
  default_persona_code: string | null;
  // ...
}
```

### Application Types (camelCase)

For app usage:
```typescript
interface AiAgent {
  id: string;
  slug: string;
  defaultPersonaCode?: string;
  // ...
}
```

### Type Converters

```typescript
// DB → App
const agent = fromAiAgentRow(row);

// App → DB
const insert = toAiAgentInsert(input);
```

See: `types/ai-agents.types.ts`

## Usage Examples

### 1. Waiter Agent: Order Food

**WhatsApp Message (User):**
> "I want 2 beers and fries, deliver to Table 5"

**Flow:**
1. Create `whatsapp_messages` row (direction: `inbound`)
2. Agent parses → creates `ai_agent_intents`:
   ```json
   {
     "intent_type": "order_food",
     "summary": "2 beers, 1 fries, table 5 delivery",
     "structured_payload": {
       "items": [
         {"menu_item_id": "uuid-beer", "quantity": 2},
         {"menu_item_id": "uuid-fries", "quantity": 1}
       ],
       "delivery_location": "Table 5"
     },
     "confidence": 0.95,
     "status": "pending"
   }
   ```
3. Agent applies → inserts into `orders` table, status → `applied`
4. Agent responds via WhatsApp:
   > "✅ Order confirmed: 2 Beers, 1 Fries → Table 5. Total: 3,500 RWF"

### 2. Jobs Agent: Find Jobs

**WhatsApp Message (User):**
> "Find me software jobs in Kigali, salary > 500k"

**Flow:**
1. Create `whatsapp_messages` row
2. Agent parses → creates `ai_agent_intents`:
   ```json
   {
     "intent_type": "search_jobs",
     "summary": "Software jobs in Kigali, min 500k",
     "structured_payload": {
       "category": "software",
       "location": "Kigali",
       "min_salary": 500000
     },
     "confidence": 0.92,
     "status": "pending"
   }
   ```
3. Agent queries `job_posts` table → finds 3 matches
4. Agent creates 3 rows in `ai_agent_match_events`:
   ```json
   {
     "match_type": "job",
     "demand_ref": {"table": "job_seekers", "id": "user-uuid"},
     "supply_ref": {"table": "job_posts", "id": "job-1-uuid"},
     "score": 0.89,
     "metadata": {"distance_km": 2, "salary_delta": 100000}
   }
   ```
5. Agent responds:
   > "📋 Found 3 jobs:\n1️⃣ Senior Dev @ TechCo (600k)\n2️⃣ Full Stack @ StartupX (550k)\n3️⃣ Python Dev @ AgencyY (520k)"

### 3. Real Estate Agent: Property Search

**WhatsApp Message (User):**
> "2 bedroom apartment in Kimihurura, budget 300k/month"

**Flow:**
1. Intent: `search_property`
2. Structured payload:
   ```json
   {
     "bedrooms": 2,
     "location": "Kimihurura",
     "max_monthly_rent": 300000,
     "property_type": "apartment"
   }
   ```
3. Agent searches `properties` → finds 5 matches
4. Agent creates match events (demand: user, supply: properties)
5. Agent responds with shortlist

## Migration & Deployment

### Apply Schema

```bash
# Apply migration
supabase db push

# Or specific file
psql $DATABASE_URL -f supabase/migrations/20251121184617_ai_agent_ecosystem_whatsapp_first.sql
```

### Load Seed Data (Optional)

```bash
psql $DATABASE_URL -f supabase/seed/ai_agents_seed.sql
```

**Seed includes:**
- 6 AI agents (waiter, farmer, broker, real_estate, jobs, sales_cold_caller)
- Default personas (1 per agent)
- Default system instructions (1 per agent)
- Sample tools (2 per agent)

### Verify

```sql
-- Check agents
SELECT * FROM ai_agents_overview_v;

-- Check personas
SELECT a.slug, p.role_name, p.languages
FROM ai_agents a
JOIN ai_agent_personas p ON p.agent_id = a.id
WHERE p.is_default = true;

-- Check tools per agent
SELECT a.slug, COUNT(t.id) as tool_count
FROM ai_agents a
LEFT JOIN ai_agent_tools t ON t.agent_id = a.id
GROUP BY a.slug;
```

## RLS Policies (TODO)

**Current Status:** RLS is **DISABLED** by default.

**Next Steps:**
1. Enable RLS on all tables
2. Create policies:
   - `whatsapp_users`: Users can only see their own data
   - `whatsapp_conversations`: Users can only see conversations they're part of
   - `ai_agent_intents`: Users can only see their own intents
   - Admin tables (`ai_agents`, etc.): Require admin role

**Example Policy:**
```sql
ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own conversations"
  ON whatsapp_conversations
  FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM whatsapp_users
      WHERE phone_number = current_setting('request.jwt.claims')::json->>'phone'
    )
  );
```

## Monitoring & Observability

### Key Metrics to Track

1. **Intent Parse Rate**: % of messages successfully parsed to intents
   ```sql
   SELECT
     COUNT(DISTINCT message_id)::float / COUNT(DISTINCT m.id) as parse_rate
   FROM whatsapp_messages m
   LEFT JOIN ai_agent_intents i ON i.message_id = m.id
   WHERE m.direction = 'inbound';
   ```

2. **Intent Apply Rate**: % of intents successfully applied
   ```sql
   SELECT
     COUNT(*) FILTER (WHERE status = 'applied')::float / COUNT(*) as apply_rate
   FROM ai_agent_intents;
   ```

3. **Match Quality**: Average match score by type
   ```sql
   SELECT match_type, AVG(score) as avg_score, COUNT(*) as match_count
   FROM ai_agent_match_events
   GROUP BY match_type;
   ```

4. **Conversation Activity**: Active conversations per agent
   ```sql
   SELECT a.slug, COUNT(*) as active_conversations
   FROM whatsapp_conversations c
   JOIN ai_agents a ON a.id = c.agent_id
   WHERE c.status = 'active'
   GROUP BY a.slug;
   ```

## Domain-Specific Tables

This schema is **domain-agnostic**. Each agent uses domain-specific tables:

| Agent | Domain Tables (examples) |
|-------|---------------------------|
| Waiter | `menu_items`, `orders`, `reservations` |
| Farmer | `produce_listings`, `farmers`, `buyers` |
| Business Broker | `businesses`, `promotions`, `reviews` |
| Real Estate | `properties`, `landlords`, `property_shortlists` |
| Jobs | `job_posts`, `job_seekers`, `applications` |
| Sales Cold Caller | `leads`, `campaigns`, `interactions` |

**These tables already exist or will be created separately.** This schema provides the glue between WhatsApp messages and domain actions.

## Future Enhancements

1. **Voice Integration**: Add SIP/voice call support via `default_channel = 'voice'`
2. **Vector Search**: Add `pgvector` extension for semantic search in knowledge bases
3. **Conversation Analytics**: Add `conversation_analytics` table for tracking user journeys
4. **Multi-Channel**: Support SMS, web chat via `channel` field
5. **Agent Handoff**: Add `agent_handoff_logs` for human escalation tracking
6. **Intent Feedback**: Add `intent_feedback` for correcting bad parses

## References

- **Migration File**: `supabase/migrations/20251121184617_ai_agent_ecosystem_whatsapp_first.sql`
- **Seed File**: `supabase/seed/ai_agents_seed.sql`
- **TypeScript Types**: `types/ai-agents.types.ts`
- **Constraints**: ADDITIVE-ONLY (no breaking changes to existing tables)

## Support

For issues or questions:
1. Check seed data examples
2. Review TypeScript type definitions
3. Inspect `ai_agents_overview_v` for agent status
4. Query `ai_agent_intents` for intent parse errors

---

**Last Updated**: 2025-11-21  
**Schema Version**: 1.0.0  
**Compatibility**: Supabase, PostgreSQL 14+
