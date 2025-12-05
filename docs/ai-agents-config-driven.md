# AI Agents - Config-Driven Architecture

This document describes how to manage AI agents entirely from the Supabase database, without hardcoding configurations in the codebase.

## Overview

EasyMO AI agents are now **100% config-driven from Supabase**. This means:

- ✅ Agent personas, system instructions, tools, tasks, and knowledge bases are defined in the database
- ✅ No hardcoded model names, temperatures, or prompts in code
- ✅ Adding/updating agents is done through Supabase dashboard or API
- ✅ Changes take effect within 60 seconds (cache TTL)
- ✅ A/B testing of different instructions is supported

## Database Tables

### Core Tables

| Table | Purpose |
|-------|---------|
| `ai_agents` | Agent definitions (id, slug, name, defaults) |
| `ai_agent_personas` | Persona definitions (role, tone, languages) |
| `ai_agent_system_instructions` | System prompts and guardrails |
| `ai_agent_tools` | Tool definitions (name, type, schema, config) |
| `ai_agent_tasks` | Task definitions (triggers, tools used, handoffs) |
| `ai_agent_knowledge_bases` | Knowledge base references |

### Telemetry Tables

| Table | Purpose |
|-------|---------|
| `ai_agent_metrics` | Agent performance metrics |
| `ai_agent_tool_executions` | Tool execution logs |
| `ai_agent_match_events` | Match events (job, property, ride) |
| `ai_agent_intents` | Parsed user intents |

### Experiment Tables

| Table | Purpose |
|-------|---------|
| `ai_agent_instruction_experiments` | A/B test definitions |
| `ai_agent_experiment_results` | Experiment outcomes |

## Adding a New Agent

### Step 1: Create Agent Record

```sql
INSERT INTO ai_agents (slug, name, description, default_language, default_channel)
VALUES (
  'my_agent',
  'My Custom Agent',
  'Description of what this agent does',
  'en',
  'whatsapp'
);
```

### Step 2: Add Persona

```sql
INSERT INTO ai_agent_personas (
  agent_id,
  code,
  role_name,
  tone_style,
  languages,
  traits,
  is_default
)
VALUES (
  (SELECT id FROM ai_agents WHERE slug = 'my_agent'),
  'default',
  'Assistant',
  'friendly, professional',
  ARRAY['en', 'fr'],
  '{"patience": "high", "formality": "medium"}'::jsonb,
  true
);
```

### Step 3: Add System Instructions

```sql
INSERT INTO ai_agent_system_instructions (
  agent_id,
  code,
  title,
  instructions,
  guardrails,
  is_active
)
VALUES (
  (SELECT id FROM ai_agents WHERE slug = 'my_agent'),
  'v1',
  'Default Instructions',
  'You are a helpful assistant for EasyMO...',
  'Never provide medical advice. Never share PII.',
  true
);
```

### Step 4: Add Tools

```sql
INSERT INTO ai_agent_tools (
  agent_id,
  name,
  display_name,
  tool_type,
  description,
  input_schema,
  config,
  is_active
)
VALUES (
  (SELECT id FROM ai_agents WHERE slug = 'my_agent'),
  'search_products',
  'Search Products',
  'db',
  'Search the product catalog',
  '{"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}'::jsonb,
  '{"table": "products"}'::jsonb,
  true
);
```

### Step 5: Add Tasks (Optional)

```sql
INSERT INTO ai_agent_tasks (
  agent_id,
  code,
  name,
  description,
  trigger_description,
  tools_used,
  requires_human_handoff
)
VALUES (
  (SELECT id FROM ai_agents WHERE slug = 'my_agent'),
  'search_and_recommend',
  'Search and Recommend',
  'Search products and recommend the best options',
  'When user asks for product recommendations',
  ARRAY['search_products'],
  false
);
```

## Loading Agent Config in Code

```typescript
import { AgentConfigLoader, buildRuntimeTools } from '@easymo/agents';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Create loader (configs cached for 60s)
const loader = new AgentConfigLoader(supabase);

// Load full agent configuration
const config = await loader.getAgentBySlugOrId('my_agent');

// Access config parts
console.log(config.agent.name);           // "My Custom Agent"
console.log(config.persona?.roleName);    // "Assistant"
console.log(config.systemInstructions);   // Array of instructions
console.log(config.tools);                // Array of tools
console.log(config.tasks);                // Array of tasks

// Build runtime tools for LLM
const runtimeTools = buildRuntimeTools(config.tools, supabase);
```

## Tool Types

| Type | Description | Config Required |
|------|-------------|-----------------|
| `db` | Database query | `table` |
| `http` | HTTP API call | `endpoint`, `method` |
| `deep_search` | Web search (no crawl) | None |
| `maps` | Google Maps API | API key in env |
| `momo` | Mobile Money | API keys in env |
| `whatsapp` | WhatsApp messaging | None |
| `location` | Location services | None |
| `static` | Static data | Return `config` directly |
| `external` | External APIs | API-specific |
| `vector_store` | Vector search | `collection`, `index` |

### Adding Custom Tool Implementation

If a tool name isn't in the default registry, add it:

```typescript
import { TOOL_IMPLEMENTATIONS } from '@easymo/agents/config';

// Register custom tool
TOOL_IMPLEMENTATIONS['my_custom_tool'] = async (params, context, config, supabase) => {
  // Your implementation
  return { result: 'success' };
};
```

## A/B Testing Instructions

### Create Experiment

```sql
INSERT INTO ai_agent_instruction_experiments (
  agent_id,
  experiment_name,
  variant_a_instruction_id,
  variant_b_instruction_id,
  traffic_split_percent,
  success_metric,
  status
)
VALUES (
  (SELECT id FROM ai_agents WHERE slug = 'waiter'),
  'Friendlier Tone Test',
  (SELECT id FROM ai_agent_system_instructions WHERE code = 'v1'),
  (SELECT id FROM ai_agent_system_instructions WHERE code = 'v2_friendly'),
  50,  -- 50% A, 50% B
  'user_satisfaction_score',
  'active'
);
```

### Use in Code

```typescript
import { getExperimentAwareInstruction } from '@easymo/agents';

// Get instruction considering active experiments
const { instruction, experimentId, variant } = await getExperimentAwareInstruction(
  supabase,
  agentId,
  userId,
  defaultInstruction
);

// Use instruction in LLM call
const systemPrompt = instruction?.instructions || 'Default instructions';
```

## Telemetry & Monitoring

### Log Agent Metrics

```typescript
import { logAgentMetric } from '@easymo/agents';

await logAgentMetric(supabase, {
  agentId: config.agent.id,
  channel: 'whatsapp',
  durationMs: 1500,
  inputTokens: 100,
  outputTokens: 200,
  success: true,
});
```

### Log Tool Executions

```typescript
import { logToolExecution } from '@easymo/agents';

await logToolExecution(supabase, {
  agentId: config.agent.id,
  toolId: tool.id,
  toolName: 'search_jobs',
  inputs: { query: 'developer' },
  result: { jobs: [...] },
  executionTimeMs: 250,
  success: true,
});
```

### Log Match Events

```typescript
import { logMatchEvent } from '@easymo/agents';

await logMatchEvent(supabase, {
  agentId: config.agent.id,
  matchType: 'job',
  demandRef: { userId: 'seeker-uuid', skills: ['javascript'] },
  supplyRef: { jobId: 'job-uuid', title: 'Developer' },
  score: 0.85,
});
```

## Caching

Agent configs are cached in memory for 60 seconds by default. To customize:

```typescript
const loader = new AgentConfigLoader(supabase, { cacheTTL: 120000 }); // 2 minutes
```

To invalidate cache:

```typescript
loader.invalidateCache('waiter');  // Specific agent
loader.clearCache();               // All agents
```

## Deep Search Tool

The deep search tool now uses **live web search only** (no crawl_strategy). It:
1. Takes a query parameter
2. Searches the web using Serper API
3. Returns top 5 results with titles, snippets, and links

```sql
-- Example tool definition
INSERT INTO ai_agent_tools (agent_id, name, tool_type, description, input_schema, is_active)
VALUES (
  agent_id,
  'deep_search',
  'deep_search',
  'Search the web for real-time information',
  '{"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}'::jsonb,
  true
);
```

## Migration from Hardcoded Configs

If you have agents defined in code (e.g., `agent-definitions.ts`), migrate them:

1. Insert agent record into `ai_agents`
2. Insert persona into `ai_agent_personas`
3. Insert instructions into `ai_agent_system_instructions`
4. Insert each tool into `ai_agent_tools`
5. Update code to use `AgentConfigLoader`

## Views for Analytics

- `ai_agents_overview_v` - Agent summary with tool/task counts
- `agent_performance_dashboard` - Performance metrics
- `tool_usage_analytics` - Tool usage stats
- `config_cache_performance` - Cache hit rates

## Best Practices

1. **Use descriptive slugs**: `jobs`, `waiter`, `real_estate` not `agent1`
2. **Version instructions**: Use codes like `v1`, `v2_friendly`
3. **Set is_active flags**: Deactivate instead of delete
4. **Log everything**: Use telemetry helpers for observability
5. **Test with experiments**: A/B test before making changes permanent
6. **Keep guardrails**: Always include guardrails in system instructions
