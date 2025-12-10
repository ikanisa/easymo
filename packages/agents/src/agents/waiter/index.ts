/**
 * Waiter AI Agent - Main Exports
 * 
 * This is the single source of truth for the Waiter AI agent.
 * All other implementations should import and use this agent.
 * 
 * @module @easymo/agents/waiter
 * @version 2.0.0
 */

export { WaiterAgent } from './waiter.agent';
export { WAITER_SYSTEM_PROMPT, WAITER_SYSTEM_PROMPT_COMPACT, getSystemPrompt } from './prompts/system-prompt';

// Re-export types
export type { AgentContext, AgentInput, AgentResult, Tool } from '../../types/agent.types';
