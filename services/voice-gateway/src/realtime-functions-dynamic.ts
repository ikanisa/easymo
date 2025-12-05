/**
 * Dynamic Realtime Functions Loader
 * 
 * Loads ALL tools and prompts from database - NO hardcoding
 * The AI agent is intelligent and adaptive based on database configuration
 */

import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Load all available tools from database for Realtime API
 */
export async function loadRealtimeFunctions(supabase: SupabaseClient, agentId: string): Promise<any[]> {
  const { data: tools, error } = await supabase
    .from('ai_agent_tools')
    .select('*')
    .eq('agent_id', agentId)
    .eq('is_active', true);

  if (error) {
    console.error('Failed to load tools from database:', error);
    return [];
  }

  if (!tools || tools.length === 0) {
    console.warn(`No tools found for agent ${agentId}`);
    return [];
  }

  // Convert database tools to OpenAI Realtime format
  return tools.map(tool => ({
    type: 'function',
    name: tool.name,
    description: tool.description || tool.display_name,
    parameters: tool.input_schema || {
      type: 'object',
      properties: {},
    },
  }));
}

/**
 * Build system prompt dynamically from agent configuration in database
 */
export async function buildCallCenterPrompt(
  supabase: SupabaseClient,
  config: {
    agentId: string;
    language?: string;
    userName?: string;
    userContext?: Record<string, any>;
  }
): Promise<string> {
  const lang = config.language || 'en';
  
  // Load agent configuration from database
  const { data: agentConfig, error: agentError } = await supabase
    .from('ai_agents')
    .select('*')
    .eq('id', config.agentId)
    .single();

  if (agentError || !agentConfig) {
    console.error('Failed to load agent config:', agentError);
    return `You are an intelligent AI assistant.

${config.userName ? `Speaking with: ${config.userName}` : ''}
${config.userContext ? `Context: ${JSON.stringify(config.userContext)}` : ''}`;
  }

  // Load persona
  const { data: persona } = await supabase
    .from('ai_agent_personas')
    .select('*')
    .eq('agent_id', config.agentId)
    .eq('code', agentConfig.default_persona_code)
    .single();

  // Load system instructions
  const { data: instructions } = await supabase
    .from('ai_agent_system_instructions')
    .select('*')
    .eq('agent_id', config.agentId)
    .eq('code', agentConfig.default_system_instruction_code)
    .single();

  // Build prompt from database configuration
  let prompt = '';
  
  // Agent description
  if (agentConfig.description) {
    prompt += agentConfig.description + '\n\n';
  }

  // Persona (role, tone, traits)
  if (persona) {
    if (persona.role_name) {
      prompt += `ROLE: ${persona.role_name}\n\n`;
    }
    if (persona.tone_style) {
      prompt += `TONE: ${persona.tone_style}\n\n`;
    }
    if (persona.traits) {
      prompt += `PERSONALITY TRAITS:\n${JSON.stringify(persona.traits, null, 2)}\n\n`;
    }
  }

  // System instructions
  if (instructions) {
    if (instructions.instructions) {
      prompt += `INSTRUCTIONS:\n${instructions.instructions}\n\n`;
    }
    if (instructions.guardrails) {
      prompt += `GUARDRAILS:\n${instructions.guardrails}\n\n`;
    }
    if (instructions.memory_strategy) {
      prompt += `MEMORY STRATEGY: ${instructions.memory_strategy}\n\n`;
    }
  }

  // Add user context
  if (config.userName) {
    prompt += `\nCurrently speaking with: ${config.userName}`;
  }
  
  if (config.userContext) {
    prompt += `\nContext: ${JSON.stringify(config.userContext)}`;
  }

  return prompt.trim();
}

/**
 * Get domain-specific configuration from database
 */
export async function getDomainConfig(
  supabase: SupabaseClient,
  domain: string
): Promise<Record<string, any> | null> {
  const { data } = await supabase
    .from('service_domains')
    .select('*')
    .eq('slug', domain)
    .single();

  return data;
}

/**
 * Get available services dynamically
 */
export async function getAvailableServices(supabase: SupabaseClient): Promise<string[]> {
  const { data: services } = await supabase
    .from('services')
    .select('name')
    .eq('enabled', true);

  return services?.map(s => s.name) || [];
}
