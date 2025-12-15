/**
 * Agent-to-Agent Communication Infrastructure
 * 
 * Enables collaboration between specialized agents:
 * - Agent discovery
 * - Request routing
 * - Context sharing
 * - Knowledge transfer
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js';
import type { AgentResponse } from './base-agent.ts';

export interface AgentCapability {
  agentType: string;
  name: string;
  description: string;
  capabilities: string[];
  topics: string[];
}

export interface AgentRequest {
  fromAgent: string;
  toAgent: string;
  requestType: 'query' | 'handoff' | 'consult';
  message: string;
  context: Record<string, unknown>;
  sessionId: string;
}

export interface AgentCollaboration {
  id: string;
  sourceAgent: string;
  targetAgent: string;
  requestType: string;
  status: 'pending' | 'completed' | 'failed';
  request: Record<string, unknown>;
  response?: Record<string, unknown>;
  createdAt: string;
}

// Agent registry - only Buy & Sell AI Agent
const AGENT_REGISTRY: AgentCapability[] = [
  {
    agentType: 'buy_sell',
    name: '🛍️ Buy & Sell AI',
    description: 'Marketplace, business services, and general support',
    capabilities: ['product_listings', 'buying', 'selling', 'business_discovery', 'general_support'],
    topics: ['buy', 'sell', 'marketplace', 'product', 'shop', 'business', 'trade', 'service', 'help', 'support'],
  },
];

/**
 * Find the best agent for a given topic/query
 */
export function findBestAgent(query: string): AgentCapability | null {
  const lowerQuery = query.toLowerCase();
  
  let bestMatch: AgentCapability | null = null;
  let highestScore = 0;

  for (const agent of AGENT_REGISTRY) {
    let score = 0;
    
    // Check topic matches
    for (const topic of agent.topics) {
      if (lowerQuery.includes(topic)) {
        score += 10;
      }
    }
    
    // Check capability matches
    for (const cap of agent.capabilities) {
      if (lowerQuery.includes(cap.replace('_', ' '))) {
        score += 5;
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = agent;
    }
  }

  return bestMatch;
}

/**
 * Get all available agents
 */
export function getAllAgents(): AgentCapability[] {
  return AGENT_REGISTRY;
}

/**
 * Get agent by type
 */
export function getAgentByType(agentType: string): AgentCapability | undefined {
  return AGENT_REGISTRY.find(a => a.agentType === agentType);
}

/**
 * Record agent collaboration for learning
 */
export async function recordCollaboration(
  supabase: SupabaseClient,
  collaboration: Omit<AgentCollaboration, 'id' | 'createdAt'>
): Promise<void> {
  try {
    await supabase.from('ai_agent_collaborations').insert({
      source_agent: collaboration.sourceAgent,
      target_agent: collaboration.targetAgent,
      request_type: collaboration.requestType,
      status: collaboration.status,
      request: collaboration.request,
      response: collaboration.response,
    });
  } catch {
    // Non-fatal
  }
}

/**
 * Request consultation from another agent
 */
export async function consultAgent(
  supabase: SupabaseClient,
  request: AgentRequest
): Promise<AgentResponse | null> {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!SUPABASE_URL || !SUPABASE_KEY) return null;

  try {
    // Map agent type to function name
    const functionName = `wa-agent-${request.toAgent}`;
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'X-Agent-Consultation': 'true',
        'X-Source-Agent': request.fromAgent,
      },
      body: JSON.stringify({
        message: request.message,
        context: request.context,
        sessionId: request.sessionId,
        isConsultation: true,
      }),
    });

    if (response.ok) {
      const result = await response.json();
      
      // Record collaboration
      await recordCollaboration(supabase, {
        sourceAgent: request.fromAgent,
        targetAgent: request.toAgent,
        requestType: request.requestType,
        status: 'completed',
        request: { message: request.message, context: request.context },
        response: result,
      });

      return result;
    }
  } catch (error) {
    // Agent consultation failed - non-fatal, return null
  }

  return null;
}

/**
 * Build context summary from all agents' knowledge
 */
export function buildAgentKnowledgeSummary(): string {
  return AGENT_REGISTRY.map(agent => 
    `${agent.name}: ${agent.description} - Topics: ${agent.topics.join(', ')}`
  ).join('\n');
}
