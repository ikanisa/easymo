# AI Agent Ecosystem Schema

## Overview

Normalized database schema for managing multiple AI agents in the easyMO platform. Supports 6+ specialized agents with extensible architecture for personas, tools, tasks, and knowledge bases.

## Core Agents

1. **Waiter AI Agent** (`waiter`) - Restaurant/bar service, menu browsing, order taking, MoMo payments
2. **Farmer AI Agent** (`farmer`) - Agricultural marketplace, produce listing, buyer matching
3. **Business Broker AI Agent** (`business_broker`) - Local business discovery and recommendations
4. **Real Estate AI Agent** (`real_estate`) - Rental concierge, property matching
5. **Jobs AI Agent** (`jobs`) - Job marketplace, candidate-employer matching
6. **Sales/Marketing SDR** (`sales_cold_caller`) - Lead qualification, demo booking, follow-ups

## Database Schema

### Tables

#### `ai_agents`
Master registry of all AI agents.

**Key Columns:**
- `slug` (unique) - Machine-friendly identifier (e.g., 'waiter', 'farmer')
- `name` - Human-readable name
- `default_persona_code` - Reference to default persona
- `default_system_instruction_code` - Reference to default system prompt
- `metadata` (jsonb) - Free-form configuration

#### `ai_agent_personas`
Persona definitions per agent (tone, language, traits).

**Key Columns:**
- `agent_id` - Foreign key to `ai_agents`
- `code` - Persona code (e.g., 'W-PERSONA', 'F-PERSONA')
- `role_name` - Display name (e.g., 'Virtual Waiter')
- `tone_style` - Behavioral tone description
- `languages` (array) - Supported languages
- `traits` (jsonb) - Structured persona attributes
- `is_default` - Primary persona flag

#### `ai_agent_system_instructions`
System prompts, guardrails, and memory strategies.

**Key Columns:**
- `agent_id` - Foreign key to `ai_agents`
- `code` - Instruction set code (e.g., 'W-SYS')
- `instructions` - Full system prompt text
- `guardrails` - Safety/constraint rules
- `memory_strategy` - Conversation state management approach
- `is_active` - Active version flag

#### `ai_agent_tools`
Tool registry mapping to backend functions/APIs.

**Key Columns:**
- `agent_id` - Foreign key to `ai_agents`
- `name` - Internal tool identifier
- `tool_type` - Category: `db`, `http`, `deep_search`, `maps`, `sip`, `whatsapp`, `momo`, etc.
- `input_schema` (jsonb) - JSON schema for inputs
- `output_schema` (jsonb) - JSON schema for outputs
- `config` (jsonb) - Tool configuration (endpoints, timeouts)

#### `ai_agent_tasks`
Tasks/actions each agent can perform.

**Key Columns:**
- `agent_id` - Foreign key to `ai_agents`
- `code` - Task code (e.g., 'waiter_take_order')
- `trigger_description` - When this task activates
- `tools_used` (array) - List of required tool names
- `requires_human_handoff` - Escalation flag

#### `ai_agent_knowledge_bases`
Knowledge sources per agent.

**Key Columns:**
- `agent_id` - Foreign key to `ai_agents`
- `code` - KB code (e.g., 'restaurant_menus', 'business_directory')
- `storage_type` - Storage mechanism: `table`, `view`, `vector_store`, `external`
- `access_method` - How agent accesses: `direct_db`, `tool:name`, `deep_search`
- `update_strategy` - How KB is refreshed

### Views

#### `ai_agents_overview_v`
Aggregated view joining agents with their default configs and counts.

**Columns:**
- All agent base fields
- `default_persona_role_name`
- `default_system_instruction_title`
- `tool_count`, `task_count`, `kb_count`

## Migration

```bash
# Deploy to Supabase
cd /Users/jeanbosco/workspace/easymo-
supabase db push

# Or apply directly
psql $DATABASE_URL -f supabase/migrations/20251121191011_ai_agent_ecosystem.sql
```

## TypeScript Usage

```typescript
import {
  AiAgent,
  AiAgentTool,
  AgentSlug,
  fromAiAgentRow,
  toAiAgentInsert
} from '@/types/ai-agents.types';

// Query agents
const { data: agents } = await supabase
  .from('ai_agents')
  .select('*')
  .eq('is_active', true);

// Convert to app types
const appAgents = agents.map(fromAiAgentRow);

// Query with relations
const { data: agentWithTools } = await supabase
  .from('ai_agents')
  .select(`
    *,
    tools:ai_agent_tools(*),
    tasks:ai_agent_tasks(*)
  `)
  .eq('slug', 'waiter')
  .single();

// Use overview view
const { data: overview } = await supabase
  .from('ai_agents_overview_v')
  .select('*');
```

## Example Queries

### Get all active agents with counts
```sql
SELECT * FROM ai_agents_overview_v WHERE is_active = true;
```

### Get waiter agent with all tools
```sql
SELECT 
  a.*,
  json_agg(t.*) as tools
FROM ai_agents a
LEFT JOIN ai_agent_tools t ON t.agent_id = a.id
WHERE a.slug = 'waiter'
GROUP BY a.id;
```

### Find agents using specific tool type
```sql
SELECT DISTINCT a.name, a.slug
FROM ai_agents a
JOIN ai_agent_tools t ON t.agent_id = a.id
WHERE t.tool_type = 'deep_search'
  AND t.is_active = true;
```

## Initial Data

The migration seeds 6 agents with:
- Default personas (codes: W-PERSONA, F-PERSONA, BB-PERSONA, RE-PERSONA, J-PERSONA, SDR-PERSONA)
- Default system instructions (codes: W-SYS, F-SYS, BB-SYS, RE-SYS, J-SYS, SDR-SYS)
- Placeholder instructional text (to be replaced with full prompts)

## Extensibility

### Adding New Agents

```sql
INSERT INTO ai_agents (slug, name, description, default_language, default_channel)
VALUES ('new_agent', 'New Agent', 'Description', 'en', 'whatsapp');
```

### Adding Tools to Agents

```sql
INSERT INTO ai_agent_tools (
  agent_id,
  name,
  tool_type,
  input_schema,
  config
)
SELECT 
  id,
  'search_database',
  'db',
  '{"table": "menu_items", "columns": ["name", "price"]}'::jsonb,
  '{"timeout": 5000}'::jsonb
FROM ai_agents
WHERE slug = 'waiter';
```

### Versioning System Instructions

```sql
-- Create new version
INSERT INTO ai_agent_system_instructions (
  agent_id,
  code,
  title,
  instructions,
  is_active
)
SELECT 
  agent_id,
  'W-SYS-v2',
  'Waiter Instructions v2',
  'Updated system prompt...',
  false
FROM ai_agent_system_instructions
WHERE code = 'W-SYS'
LIMIT 1;

-- Activate new version
UPDATE ai_agents
SET default_system_instruction_code = 'W-SYS-v2'
WHERE slug = 'waiter';

UPDATE ai_agent_system_instructions
SET is_active = true
WHERE code = 'W-SYS-v2';
```

## Row Level Security

RLS is **disabled** by default. Enable per-table as needed:

```sql
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access"
  ON ai_agents
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Admin full access"
  ON ai_agents
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

## Indexes

Optimized indexes for:
- Agent lookup by slug
- Tool filtering by type and agent
- Task and KB queries by agent
- JSONB searches on metadata and schemas
- Active/default record filtering

## Best Practices

1. **Immutable Codes** - Don't change persona/instruction codes; create new versions
2. **Metadata Usage** - Store agent-specific config in `metadata` jsonb
3. **Tool Reuse** - Same tool can be shared across agents (link via `agent_id`)
4. **Guardrails** - Always populate `guardrails` field for safety
5. **Human Handoff** - Flag tasks requiring escalation with `requires_human_handoff`

## Related Documentation

- [WA_INFRASTRUCTURE_IMPROVEMENTS.md](../WA_INFRASTRUCTURE_IMPROVEMENTS.md) - Dead Letter Queue
- [DUAL_LLM_IMPLEMENTATION_GUIDE.md](../DUAL_LLM_IMPLEMENTATION_GUIDE.md) - LLM Provider Integration
- [GROUND_RULES.md](../docs/GROUND_RULES.md) - Observability & Security Standards
