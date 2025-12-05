/**
 * Agent Config Loader - Dynamic agent configuration from Supabase
 * 
 * Fetches and caches full agent configurations from the ai_agent_* tables.
 * Uses TTL-based caching to minimize database hits.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  AiAgent,
  AiAgentConfig,
  AiAgentPersona,
  AiAgentSystemInstruction,
  AiAgentIntent,
  AiAgentTask,
  AiAgentTool,
  AiAgentKnowledgeBase,
  ResolvedAgentConfig,
} from './types';

// ============================================================================
// CACHE
// ============================================================================

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL_MS = 60 * 1000; // 60 seconds

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCached<T>(key: string, data: T, ttlMs = DEFAULT_TTL_MS): void {
  cache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}

export function clearAgentCache(agentSlug?: string): void {
  if (agentSlug) {
    for (const key of cache.keys()) {
      if (key.includes(agentSlug)) {
        cache.delete(key);
      }
    }
  } else {
    cache.clear();
  }
}

// ============================================================================
// LOADER CLASS
// ============================================================================

export class AgentConfigLoader {
  private supabase: SupabaseClient;
  private ttlMs: number;

  constructor(supabase: SupabaseClient, ttlMs = DEFAULT_TTL_MS) {
    this.supabase = supabase;
    this.ttlMs = ttlMs;
  }

  /**
   * Get a fully resolved agent configuration by slug or ID
   */
  async getAgentBySlugOrId(identifier: string): Promise<ResolvedAgentConfig | null> {
    const cacheKey = `agent:${identifier}`;
    const cached = getCached<ResolvedAgentConfig>(cacheKey);
    if (cached) return cached;

    // Fetch base agent
    const isUuid = identifier.includes('-') && identifier.length === 36;
    const { data: agent, error } = await this.supabase
      .from('ai_agents')
      .select('*')
      .eq(isUuid ? 'id' : 'slug', identifier)
      .eq('is_active', true)
      .single();

    if (error || !agent) {
      console.warn(`Agent not found: ${identifier}`);
      return null;
    }

    // Fetch all related data in parallel
    const [config, persona, systemInstructions, intents, tasks, tools, knowledgeBases] = await Promise.all([
      this.getAgentConfig(agent.slug),
      this.getAgentPersona(agent.id, agent.default_persona_code),
      this.getAgentSystemInstructions(agent.id),
      this.getAgentIntents(agent.id),
      this.getAgentTasks(agent.id),
      this.getAgentTools(agent.id),
      this.getAgentKnowledgeBases(agent.id),
    ]);

    const resolved: ResolvedAgentConfig = {
      agent: agent as AiAgent,
      config,
      persona,
      systemInstructions,
      intents,
      tasks,
      tools,
      knowledgeBases,
    };

    setCached(cacheKey, resolved, this.ttlMs);
    return resolved;
  }

  /**
   * List all active agents with their full configurations
   */
  async listAgents(): Promise<ResolvedAgentConfig[]> {
    const cacheKey = 'agents:all';
    const cached = getCached<ResolvedAgentConfig[]>(cacheKey);
    if (cached) return cached;

    const { data: agents, error } = await this.supabase
      .from('ai_agents')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error || !agents) {
      console.error('Failed to list agents:', error);
      return [];
    }

    const resolvedAgents = await Promise.all(
      agents.map((agent) => this.getAgentBySlugOrId(agent.slug))
    );

    const result = resolvedAgents.filter((a): a is ResolvedAgentConfig => a !== null);
    setCached(cacheKey, result, this.ttlMs);
    return result;
  }

  /**
   * Get agent config from ai_agent_configs table
   */
  private async getAgentConfig(agentType: string): Promise<AiAgentConfig | null> {
    const { data, error } = await this.supabase
      .from('ai_agent_configs')
      .select('*')
      .eq('agent_type', agentType)
      .eq('enabled', true)
      .single();

    if (error) return null;
    return data as AiAgentConfig;
  }

  /**
   * Get agent persona
   */
  private async getAgentPersona(
    agentId: string,
    personaCode: string | null
  ): Promise<AiAgentPersona | null> {
    let query = this.supabase
      .from('ai_agent_personas')
      .select('*')
      .eq('agent_id', agentId);

    if (personaCode) {
      query = query.eq('code', personaCode);
    } else {
      query = query.eq('is_default', true);
    }

    const { data, error } = await query.single();
    if (error) return null;
    return data as AiAgentPersona;
  }

  /**
   * Get all active system instructions for an agent
   */
  private async getAgentSystemInstructions(agentId: string): Promise<AiAgentSystemInstruction[]> {
    const { data, error } = await this.supabase
      .from('ai_agent_system_instructions')
      .select('*')
      .eq('agent_id', agentId)
      .eq('is_active', true)
      .order('created_at');

    if (error) return [];
    return data as AiAgentSystemInstruction[];
  }

  /**
   * Get agent intents
   */
  async getAgentIntents(agentId: string): Promise<AiAgentIntent[]> {
    const { data, error } = await this.supabase
      .from('ai_agent_intents')
      .select('*')
      .eq('agent_id', agentId)
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (error) return [];
    return data as AiAgentIntent[];
  }

  /**
   * Get agent tasks
   */
  async getAgentTasks(agentId: string): Promise<AiAgentTask[]> {
    const { data, error } = await this.supabase
      .from('ai_agent_tasks')
      .select('*')
      .eq('agent_id', agentId)
      .order('name');

    if (error) return [];
    return data as AiAgentTask[];
  }

  /**
   * Get all active tools for an agent
   */
  async getAgentTools(agentId: string): Promise<AiAgentTool[]> {
    const { data, error } = await this.supabase
      .from('ai_agent_tools')
      .select('*')
      .eq('agent_id', agentId)
      .eq('is_active', true)
      .order('name');

    if (error) return [];
    return data as AiAgentTool[];
  }

  /**
   * Get agent knowledge bases
   */
  async getAgentKnowledgeBases(agentId: string): Promise<AiAgentKnowledgeBase[]> {
    const { data, error } = await this.supabase
      .from('ai_agent_knowledge_bases')
      .select('*')
      .eq('agent_id', agentId)
      .eq('is_active', true);

    if (error) return [];
    return data as AiAgentKnowledgeBase[];
  }

  /**
   * Get quick lookup of all agent slugs and their IDs
   */
  async getAgentSlugsMap(): Promise<Map<string, string>> {
    const cacheKey = 'agents:slugs';
    const cached = getCached<Map<string, string>>(cacheKey);
    if (cached) return cached;

    const { data, error } = await this.supabase
      .from('ai_agents')
      .select('id, slug')
      .eq('is_active', true);

    if (error || !data) return new Map();

    const map = new Map(data.map((a) => [a.slug, a.id]));
    setCached(cacheKey, map, this.ttlMs * 2); // Cache longer
    return map;
  }
}

// ============================================================================
// SINGLETON FACTORY
// ============================================================================

let loaderInstance: AgentConfigLoader | null = null;

export function getAgentConfigLoader(supabase: SupabaseClient): AgentConfigLoader {
  if (!loaderInstance) {
    loaderInstance = new AgentConfigLoader(supabase);
  }
  return loaderInstance;
}

// Convenience function
export async function getAgentBySlugOrId(
  supabase: SupabaseClient,
  identifier: string
): Promise<ResolvedAgentConfig | null> {
  return getAgentConfigLoader(supabase).getAgentBySlugOrId(identifier);
}
