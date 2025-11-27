/**
 * AI Agent Database Loader
 * 
 * Loads agent configurations (personas, instructions, tools, tasks, KBs) from database
 * Provides caching and fallback to hardcoded configs
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AgentPersona {
  id: string;
  code: string;
  role_name: string;
  tone_style: string;
  languages: string[];
  traits: Record<string, unknown>;
  is_default: boolean;
}

export interface AgentSystemInstructions {
  id: string;
  code: string;
  title: string;
  instructions: string;
  guardrails: string;
  memory_strategy: string;
  is_active: boolean;
}

export interface AgentTool {
  id: string;
  name: string;
  display_name: string;
  tool_type: string;
  description: string;
  input_schema: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
  config: Record<string, unknown>;
  is_active: boolean;
}

export interface AgentTask {
  id: string;
  code: string;
  name: string;
  description: string;
  trigger_description?: string;
  tools_used?: string[];
  output_description?: string;
  requires_human_handoff: boolean;
  metadata?: Record<string, unknown>;
}

export interface AgentKnowledgeBase {
  id: string;
  code: string;
  name: string;
  description?: string;
  storage_type: string;
  access_method: string;
  update_strategy?: string;
  config: Record<string, unknown>;
}

export interface AgentConfig {
  persona: AgentPersona | null;
  systemInstructions: AgentSystemInstructions | null;
  tools: AgentTool[];
  tasks: AgentTask[];
  knowledgeBases: AgentKnowledgeBase[];
  loadedFrom: 'database' | 'fallback' | 'cached';
  timestamp: string;
}

/**
 * AgentConfigLoader - Loads agent configurations from database with caching
 */
export class AgentConfigLoader {
  private cache: Map<string, { config: AgentConfig; expiresAt: number }> = new Map();
  private readonly cacheTTL = 5 * 60 * 1000; // 5 minutes

  constructor(private supabase: SupabaseClient) {}

  /**
   * Load complete agent configuration from database
   */
  async loadAgentConfig(agentSlug: string): Promise<AgentConfig> {
    // Check cache first
    const cached = this.cache.get(agentSlug);
    if (cached && Date.now() < cached.expiresAt) {
      console.log(JSON.stringify({
        event: "AGENT_CONFIG_CACHE_HIT",
        agentSlug,
        source: cached.config.loadedFrom
      }));
      return cached.config;
    }

    console.log(JSON.stringify({
      event: "AGENT_CONFIG_LOADING",
      agentSlug,
      source: "database"
    }));

    try {
      // Get agent ID first
      const { data: agent } = await this.supabase
        .from('ai_agents')
        .select('id')
        .eq('slug', agentSlug)
        .eq('is_active', true)
        .single();

      if (!agent) {
        console.warn(`Agent not found: ${agentSlug}`);
        return this.createFallbackConfig(agentSlug);
      }

      const agentId = agent.id;

      // Load all components in parallel
      const [persona, systemInstructions, tools, tasks, knowledgeBases] = await Promise.all([
        this.loadPersona(agentId),
        this.loadSystemInstructions(agentId),
        this.loadTools(agentId),
        this.loadTasks(agentId),
        this.loadKnowledgeBases(agentId),
      ]);

      const config: AgentConfig = {
        persona,
        systemInstructions,
        tools,
        tasks,
        knowledgeBases,
        loadedFrom: 'database',
        timestamp: new Date().toISOString(),
      };

      // Cache the result
      this.cache.set(agentSlug, {
        config,
        expiresAt: Date.now() + this.cacheTTL,
      });

      console.log(JSON.stringify({
        event: "AGENT_CONFIG_LOADED_FROM_DB",
        agentSlug,
        persona: !!persona,
        instructions: !!systemInstructions,
        toolsCount: tools.length,
        tasksCount: tasks.length,
        kbCount: knowledgeBases.length,
      }));

      return config;
    } catch (error) {
      console.error(`Failed to load agent config for ${agentSlug}:`, error);
      return this.createFallbackConfig(agentSlug);
    }
  }

  /**
   * Load default persona for an agent
   */
  private async loadPersona(agentId: string): Promise<AgentPersona | null> {
    const { data } = await this.supabase
      .from('ai_agent_personas')
      .select('*')
      .eq('agent_id', agentId)
      .eq('is_default', true)
      .single();

    return data || null;
  }

  /**
   * Load active system instructions
   */
  private async loadSystemInstructions(agentId: string): Promise<AgentSystemInstructions | null> {
    const { data } = await this.supabase
      .from('ai_agent_system_instructions')
      .select('*')
      .eq('agent_id', agentId)
      .eq('is_active', true)
      .limit(1)
      .single();

    return data || null;
  }

  /**
   * Load active tools
   */
  private async loadTools(agentId: string): Promise<AgentTool[]> {
    const { data } = await this.supabase
      .from('ai_agent_tools')
      .select('*')
      .eq('agent_id', agentId)
      .eq('is_active', true)
      .order('name');

    return data || [];
  }

  /**
   * Load tasks
   */
  private async loadTasks(agentId: string): Promise<AgentTask[]> {
    const { data } = await this.supabase
      .from('ai_agent_tasks')
      .select('*')
      .eq('agent_id', agentId)
      .order('name');

    return data || [];
  }

  /**
   * Load knowledge bases
   */
  private async loadKnowledgeBases(agentId: string): Promise<AgentKnowledgeBase[]> {
    const { data } = await this.supabase
      .from('ai_agent_knowledge_bases')
      .select('*')
      .eq('agent_id', agentId)
      .order('name');

    return data || [];
  }

  /**
   * Create fallback config when database loading fails
   */
  private createFallbackConfig(agentSlug: string): AgentConfig {
    console.warn(JSON.stringify({
      event: "AGENT_CONFIG_FALLBACK",
      agentSlug,
      message: "Using fallback configuration (database load failed)"
    }));

    return {
      persona: null,
      systemInstructions: null,
      tools: [],
      tasks: [],
      knowledgeBases: [],
      loadedFrom: 'fallback',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Clear cache for an agent (useful for testing or forced reload)
   */
  clearCache(agentSlug?: string): void {
    if (agentSlug) {
      this.cache.delete(agentSlug);
    } else {
      this.cache.clear();
    }
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
}
