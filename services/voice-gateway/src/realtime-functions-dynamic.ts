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
export async function loadRealtimeFunctions(supabase: SupabaseClient): Promise<any[]> {
  const { data: tools, error } = await supabase
    .from('agent_tools')
    .select('*')
    .eq('enabled', true)
    .eq('available_for_voice', true)
    .order('priority', { ascending: false });

  if (error) {
    console.error('Failed to load tools from database:', error);
    return [];
  }

  // Convert database tools to OpenAI Realtime format
  return tools.map(tool => ({
    type: 'function',
    name: tool.name,
    description: tool.description,
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
    language?: string;
    userName?: string;
    userContext?: Record<string, any>;
  }
): Promise<string> {
  const lang = config.language || 'en';
  
  // Load agent configuration from database
  const { data: agentConfig } = await supabase
    .from('ai_agents')
    .select('*')
    .eq('slug', 'call-center')
    .single();

  if (!agentConfig) {
    // Minimal fallback if no config in DB
    return `You are an intelligent AI assistant. You adapt your behavior based on what the user needs.

${config.userName ? `Speaking with: ${config.userName}` : ''}
${config.userContext ? `Context: ${JSON.stringify(config.userContext)}` : ''}`;
  }

  // Build prompt from database configuration
  let prompt = '';
  
  // Base description
  if (agentConfig.description) {
    prompt += agentConfig.description + '\n\n';
  }

  // System prompt (main instructions)
  if (agentConfig.system_prompt) {
    prompt += agentConfig.system_prompt + '\n\n';
  }

  // Personality traits
  if (agentConfig.personality) {
    prompt += `PERSONALITY:\n${agentConfig.personality}\n\n`;
  }

  // Conversation strategy
  if (agentConfig.conversation_strategy) {
    prompt += `CONVERSATION STRATEGY:\n${agentConfig.conversation_strategy}\n\n`;
  }

  // Examples (if any)
  if (agentConfig.examples && agentConfig.examples.length > 0) {
    prompt += `EXAMPLES:\n${agentConfig.examples.join('\n\n')}\n\n`;
  }

  // Language-specific instructions (if available)
  if (agentConfig.language_instructions && agentConfig.language_instructions[lang]) {
    prompt += agentConfig.language_instructions[lang] + '\n\n';
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
