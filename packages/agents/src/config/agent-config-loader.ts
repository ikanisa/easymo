/**
 * Agent Config Loader - Database-Driven Configuration
 * 
 * Loads agent configurations (personas, instructions, tools, tasks, KBs) from Supabase.
 * Implements TTL-based in-memory caching to reduce database load.
 * 
 * Usage:
 * ```ts
 * import { AgentConfigLoader } from '@easymo/agents/config';
 * 
 * const loader = new AgentConfigLoader(supabaseClient);
 * const config = await loader.getAgentBySlugOrId('waiter');
 * ```
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

import type {
  AiAgent,
  AiAgentKnowledgeBase,
  AiAgentKnowledgeBaseRow,
  AiAgentPersona,
  AiAgentPersonaRow,
  AiAgentRow,
  AiAgentSystemInstruction,
  AiAgentSystemInstructionRow,
  AiAgentTask,
  AiAgentTaskRow,
  AiAgentTool,
  AiAgentToolRow,
  ResolvedAgentConfig,
} from './agent-config.types';

// =====================================================================
// CACHE CONFIGURATION
// =====================================================================

interface CacheEntry {
  config: ResolvedAgentConfig;
  expiresAt: number;
}

const DEFAULT_CACHE_TTL_MS = 60 * 1000; // 60 seconds default TTL

// =====================================================================
// ROW TO APP TYPE CONVERTERS
// =====================================================================

function toAiAgent(row: AiAgentRow): AiAgent {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? undefined,
    defaultPersonaCode: row.default_persona_code ?? undefined,
    defaultSystemInstructionCode: row.default_system_instruction_code ?? undefined,
    defaultLanguage: row.default_language,
    defaultChannel: row.default_channel,
    isActive: row.is_active,
    metadata: row.metadata,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function toAiAgentPersona(row: AiAgentPersonaRow): AiAgentPersona {
  return {
    id: row.id,
    agentId: row.agent_id,
    code: row.code,
    roleName: row.role_name ?? undefined,
    toneStyle: row.tone_style ?? undefined,
    languages: row.languages,
    traits: row.traits,
    isDefault: row.is_default,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function toAiAgentSystemInstruction(row: AiAgentSystemInstructionRow): AiAgentSystemInstruction {
  return {
    id: row.id,
    agentId: row.agent_id,
    code: row.code,
    title: row.title ?? undefined,
    instructions: row.instructions,
    guardrails: row.guardrails ?? undefined,
    memoryStrategy: row.memory_strategy ?? undefined,
    isActive: row.is_active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function toAiAgentTool(row: AiAgentToolRow): AiAgentTool {
  return {
    id: row.id,
    agentId: row.agent_id,
    name: row.name,
    displayName: row.display_name ?? undefined,
    toolType: row.tool_type,
    description: row.description ?? undefined,
    inputSchema: row.input_schema,
    outputSchema: row.output_schema,
    config: row.config,
    isActive: row.is_active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function toAiAgentTask(row: AiAgentTaskRow): AiAgentTask {
  return {
    id: row.id,
    agentId: row.agent_id,
    code: row.code,
    name: row.name,
    description: row.description ?? undefined,
    triggerDescription: row.trigger_description ?? undefined,
    toolsUsed: row.tools_used,
    outputDescription: row.output_description ?? undefined,
    requiresHumanHandoff: row.requires_human_handoff,
    metadata: row.metadata,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function toAiAgentKnowledgeBase(row: AiAgentKnowledgeBaseRow): AiAgentKnowledgeBase {
  return {
    id: row.id,
    agentId: row.agent_id,
    code: row.code,
    name: row.name,
    description: row.description ?? undefined,
    storageType: row.storage_type,
    accessMethod: row.access_method,
    updateStrategy: row.update_strategy ?? undefined,
    config: row.config,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// =====================================================================
// AGENT CONFIG LOADER CLASS
// =====================================================================

export class AgentConfigLoader {
  private cache: Map<string, CacheEntry> = new Map();
  private cacheTTL: number;

  constructor(
    private supabase: SupabaseClient,
    options?: { cacheTTL?: number }
  ) {
    this.cacheTTL = options?.cacheTTL ?? DEFAULT_CACHE_TTL_MS;
  }

  /**
   * Get agent configuration by slug or ID
   * Uses cache if available and not expired
   */
  async getAgentBySlugOrId(agentIdentifier: string): Promise<ResolvedAgentConfig> {
    const startTime = Date.now();
    
    // Check cache first
    const cacheKey = agentIdentifier.toLowerCase();
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() < cached.expiresAt) {
      console.warn(JSON.stringify({
        event: 'AGENT_CONFIG_CACHE_HIT',
        agentIdentifier,
        loadTime: Date.now() - startTime,
      }));
      return { ...cached.config, loadedFrom: 'cache' };
    }

    // Load from database
    try {
      const config = await this.loadFromDatabase(agentIdentifier);
      
      // Store in cache
      this.cache.set(cacheKey, {
        config,
        expiresAt: Date.now() + this.cacheTTL,
      });

      console.warn(JSON.stringify({
        event: 'AGENT_CONFIG_LOADED',
        agentIdentifier,
        loadTime: Date.now() - startTime,
        toolsCount: config.tools.length,
        tasksCount: config.tasks.length,
        kbCount: config.knowledgeBases.length,
      }));

      return config;
    } catch (error) {
      console.error(JSON.stringify({
        event: 'AGENT_CONFIG_LOAD_FAILED',
        agentIdentifier,
        error: error instanceof Error ? error.message : String(error),
      }));
      
      return this.createFallbackConfig(agentIdentifier);
    }
  }

  /**
   * List all active agents with their configurations
   */
  async listAgents(): Promise<ResolvedAgentConfig[]> {
    const { data: agents, error } = await this.supabase
      .from('ai_agents')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error || !agents) {
      console.error('Failed to list agents:', error);
      return [];
    }

    const configs: ResolvedAgentConfig[] = [];
    
    for (const agentRow of agents) {
      try {
        const config = await this.getAgentBySlugOrId(agentRow.slug);
        configs.push(config);
      } catch {
        // Skip agents that fail to load
      }
    }

    return configs;
  }

  /**
   * Get tools for a specific agent
   */
  async getAgentTools(agentId: string): Promise<AiAgentTool[]> {
    const { data, error } = await this.supabase
      .from('ai_agent_tools')
      .select('*')
      .eq('agent_id', agentId)
      .eq('is_active', true)
      .order('name');

    if (error || !data) {
      return [];
    }

    return data.map(toAiAgentTool);
  }

  /**
   * Get knowledge bases for a specific agent
   */
  async getAgentKnowledgeBases(agentId: string): Promise<AiAgentKnowledgeBase[]> {
    const { data, error } = await this.supabase
      .from('ai_agent_knowledge_bases')
      .select('*')
      .eq('agent_id', agentId)
      .order('name');

    if (error || !data) {
      return [];
    }

    return data.map(toAiAgentKnowledgeBase);
  }

  /**
   * Invalidate cache for a specific agent
   */
  invalidateCache(agentIdentifier: string): void {
    const cacheKey = agentIdentifier.toLowerCase();
    this.cache.delete(cacheKey);
    
    console.warn(JSON.stringify({
      event: 'AGENT_CONFIG_CACHE_INVALIDATED',
      agentIdentifier,
    }));
  }

  /**
   * Clear entire cache
   */
  clearCache(): void {
    this.cache.clear();
    
    console.warn(JSON.stringify({
      event: 'AGENT_CONFIG_CACHE_CLEARED',
    }));
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; agents: string[] } {
    return {
      size: this.cache.size,
      agents: Array.from(this.cache.keys()),
    };
  }

  // =====================================================================
  // PRIVATE METHODS
  // =====================================================================

  private async loadFromDatabase(agentIdentifier: string): Promise<ResolvedAgentConfig> {
    // First, try to find agent by slug, then by ID
    let agentRow: AiAgentRow | null = null;
    
    // Try slug first (more common)
    const { data: bySlug } = await this.supabase
      .from('ai_agents')
      .select('*')
      .eq('slug', agentIdentifier)
      .eq('is_active', true)
      .single();

    if (bySlug) {
      agentRow = bySlug;
    } else {
      // Try by ID
      const { data: byId } = await this.supabase
        .from('ai_agents')
        .select('*')
        .eq('id', agentIdentifier)
        .eq('is_active', true)
        .single();
      
      agentRow = byId;
    }

    if (!agentRow) {
      throw new Error(`Agent not found: ${agentIdentifier}`);
    }

    const agentId = agentRow.id;

    // Load all related data in parallel
    const [persona, systemInstructions, tools, tasks, knowledgeBases] = await Promise.all([
      this.loadDefaultPersona(agentId),
      this.loadSystemInstructions(agentId),
      this.loadTools(agentId),
      this.loadTasks(agentId),
      this.loadKnowledgeBases(agentId),
    ]);

    return {
      agent: toAiAgent(agentRow),
      persona,
      systemInstructions,
      tools,
      tasks,
      knowledgeBases,
      loadedFrom: 'database',
      timestamp: new Date().toISOString(),
    };
  }

  private async loadDefaultPersona(agentId: string): Promise<AiAgentPersona | null> {
    const { data } = await this.supabase
      .from('ai_agent_personas')
      .select('*')
      .eq('agent_id', agentId)
      .eq('is_default', true)
      .single();

    return data ? toAiAgentPersona(data) : null;
  }

  private async loadSystemInstructions(agentId: string): Promise<AiAgentSystemInstruction[]> {
    const { data } = await this.supabase
      .from('ai_agent_system_instructions')
      .select('*')
      .eq('agent_id', agentId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    return (data || []).map(toAiAgentSystemInstruction);
  }

  private async loadTools(agentId: string): Promise<AiAgentTool[]> {
    const { data } = await this.supabase
      .from('ai_agent_tools')
      .select('*')
      .eq('agent_id', agentId)
      .eq('is_active', true)
      .order('name');

    return (data || []).map(toAiAgentTool);
  }

  private async loadTasks(agentId: string): Promise<AiAgentTask[]> {
    const { data } = await this.supabase
      .from('ai_agent_tasks')
      .select('*')
      .eq('agent_id', agentId)
      .order('name');

    return (data || []).map(toAiAgentTask);
  }

  private async loadKnowledgeBases(agentId: string): Promise<AiAgentKnowledgeBase[]> {
    const { data } = await this.supabase
      .from('ai_agent_knowledge_bases')
      .select('*')
      .eq('agent_id', agentId)
      .order('name');

    return (data || []).map(toAiAgentKnowledgeBase);
  }

  private createFallbackConfig(agentIdentifier: string): ResolvedAgentConfig {
    console.warn(JSON.stringify({
      event: 'AGENT_CONFIG_FALLBACK',
      agentIdentifier,
      message: 'Using fallback configuration',
    }));

    return {
      agent: {
        id: 'fallback-' + agentIdentifier,
        slug: agentIdentifier,
        name: agentIdentifier.charAt(0).toUpperCase() + agentIdentifier.slice(1) + ' Agent',
        description: 'Fallback agent configuration',
        defaultLanguage: 'en',
        defaultChannel: 'whatsapp',
        isActive: true,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      persona: null,
      systemInstructions: [],
      tools: [],
      tasks: [],
      knowledgeBases: [],
      loadedFrom: 'fallback',
      timestamp: new Date().toISOString(),
    };
  }
}

// =====================================================================
// FACTORY FUNCTION
// =====================================================================

/**
 * Create an AgentConfigLoader instance
 * Uses environment variables for Supabase connection if not provided
 */
export function createAgentConfigLoader(
  supabaseOrOptions?: SupabaseClient | { supabaseUrl: string; supabaseKey: string; cacheTTL?: number }
): AgentConfigLoader {
  if (supabaseOrOptions && 'from' in supabaseOrOptions) {
    // It's a SupabaseClient
    return new AgentConfigLoader(supabaseOrOptions);
  }

  const url = supabaseOrOptions?.supabaseUrl ?? process.env.SUPABASE_URL ?? '';
  const key = supabaseOrOptions?.supabaseKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required');
  }

  const client = createClient(url, key);
  return new AgentConfigLoader(client, { cacheTTL: supabaseOrOptions?.cacheTTL });
}

// =====================================================================
// SINGLETON INSTANCE
// =====================================================================

let _defaultLoader: AgentConfigLoader | null = null;

/**
 * Get or create the default AgentConfigLoader instance
 * Uses environment variables for configuration
 */
export function getDefaultAgentConfigLoader(): AgentConfigLoader {
  if (!_defaultLoader) {
    _defaultLoader = createAgentConfigLoader();
  }
  return _defaultLoader;
}
