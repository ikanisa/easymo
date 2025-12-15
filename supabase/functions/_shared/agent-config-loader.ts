/**
 * AI Agent Database Loader
 * 
 * Loads agent configurations (personas, instructions, tools, tasks, KBs) from database
 * Provides caching and fallback to hardcoded configs
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js";
import { Redis } from "https://esm.sh/@upstash/redis@1.28.1";

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
 * AgentConfigLoader - Loads agent configurations from database with Redis caching
 */
export class AgentConfigLoader {
  private cache: Map<string, { config: AgentConfig; expiresAt: number }> = new Map();
  private readonly cacheTTL = 5 * 60 * 1000; // 5 minutes (local cache)
  private readonly redisTTL = 15 * 60; // 15 minutes (Redis cache)
  private redis: Redis | null = null;

  constructor(private supabase: SupabaseClient) {
    // Initialize Redis if URL is available
    const redisUrl = Deno.env.get("REDIS_URL");
    if (redisUrl) {
      try {
        this.redis = new Redis({ url: redisUrl });
        console.log(JSON.stringify({
          event: "REDIS_INITIALIZED",
          message: "Redis cache enabled for agent configs"
        }));
      } catch (error) {
        console.warn("Redis initialization failed, using local cache only:", error);
      }
    } else {
      console.log(JSON.stringify({
        event: "REDIS_NOT_CONFIGURED",
        message: "Using local cache only (5 min TTL)"
      }));
    }
  }

  /**
   * Load complete agent configuration from database
   */
  async loadAgentConfig(agentSlug: string): Promise<AgentConfig> {
    const startTime = Date.now();
    
    // 1. Check local memory cache first (fastest)
    const cached = this.cache.get(agentSlug);
    if (cached && Date.now() < cached.expiresAt) {
      console.log(JSON.stringify({
        event: "AGENT_CONFIG_CACHE_HIT",
        agentSlug,
        source: "memory",
        loadTime: Date.now() - startTime
      }));
      return cached.config;
    }

    // 2. Check Redis cache (fast, shared across functions)
    if (this.redis) {
      try {
        const redisKey = `agent:config:${agentSlug}`;
        const redisData = await this.redis.get(redisKey);
        
        if (redisData) {
          const config = redisData as AgentConfig;
          config.loadedFrom = 'cached';
          
          // Update local cache
          this.cache.set(agentSlug, {
            config,
            expiresAt: Date.now() + this.cacheTTL
          });
          
          console.log(JSON.stringify({
            event: "AGENT_CONFIG_CACHE_HIT",
            agentSlug,
            source: "redis",
            loadTime: Date.now() - startTime
          }));
          
          return config;
        }
      } catch (error) {
        console.warn("Redis read failed, falling back to database:", error);
      }
    }

    // 3. Load from database (slowest, but most up-to-date)
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

      // Cache the result in memory
      this.cache.set(agentSlug, {
        config,
        expiresAt: Date.now() + this.cacheTTL,
      });

      // Cache in Redis (if available)
      if (this.redis) {
        try {
          const redisKey = `agent:config:${agentSlug}`;
          await this.redis.setex(redisKey, this.redisTTL, JSON.stringify(config));
          console.log(JSON.stringify({
            event: "AGENT_CONFIG_CACHED_REDIS",
            agentSlug,
            ttl: this.redisTTL
          }));
        } catch (error) {
          console.warn("Redis write failed:", error);
          // Non-fatal, continue with local cache only
        }
      }

      const loadTime = Date.now() - startTime;
      console.log(JSON.stringify({
        event: "AGENT_CONFIG_LOADED_FROM_DB",
        agentSlug,
        persona: !!persona,
        instructions: !!systemInstructions,
        toolsCount: tools.length,
        tasksCount: tasks.length,
        kbCount: knowledgeBases.length,
        loadTime
      }));

      return config;
    } catch (error) {
      console.error(`Failed to load agent config for ${agentSlug}:`, error);
      return this.createFallbackConfig(agentSlug);
    }
  }

  /**
   * Invalidate cache for a specific agent (used by webhooks)
   */
  async invalidateCache(agentSlug: string): Promise<void> {
    // Clear local cache
    this.cache.delete(agentSlug);
    
    // Clear Redis cache
    if (this.redis) {
      try {
        const redisKey = `agent:config:${agentSlug}`;
        await this.redis.del(redisKey);
        console.log(JSON.stringify({
          event: "AGENT_CONFIG_CACHE_INVALIDATED",
          agentSlug,
          message: "Cache cleared from memory and Redis"
        }));
      } catch (error) {
        console.warn("Redis cache invalidation failed:", error);
      }
    } else {
      console.log(JSON.stringify({
        event: "AGENT_CONFIG_CACHE_INVALIDATED",
        agentSlug,
        message: "Cache cleared from memory only"
      }));
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

    // Provide basic fallback instructions for the buy_sell agent to ensure minimal functionality
    const fallbackInstructions = agentSlug === "buy_sell" ? {
      id: "fallback",
      code: "buy_sell_fallback",
      title: "Buy & Sell Agent Fallback",
      instructions: "You are Kwizera, easyMO's AI sourcing assistant for Rwanda. Help users find products and services. Be helpful, concise, and professional. Never hallucinate product availability.",
      guardrails: "Do not provide medical advice. Do not source illegal items. Always respect user privacy.",
      memory_strategy: "conversation",
      is_active: true,
    } : null;

    return {
      persona: null,
      systemInstructions: fallbackInstructions,
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
