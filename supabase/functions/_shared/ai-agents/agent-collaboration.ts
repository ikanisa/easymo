/**
 * Agent-to-Agent Communication Infrastructure
 * 
 * Enables collaboration between specialized agents:
 * - Agent discovery
 * - Request routing
 * - Context sharing
 * - Knowledge transfer
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
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

// Agent registry - all available agents and their capabilities
const AGENT_REGISTRY: AgentCapability[] = [
  {
    agentType: 'farmer',
    name: '🌾 Farmers Market AI',
    description: 'Agricultural support and market assistant',
    capabilities: ['crop_advice', 'market_prices', 'farming_tips', 'produce_listings'],
    topics: ['agriculture', 'farming', 'crops', 'produce', 'market', 'seeds', 'fertilizer'],
  },
  {
    agentType: 'support',
    name: '🆘 Support AI',
    description: 'Customer support and help',
    capabilities: ['troubleshooting', 'faq', 'account_help', 'general_support'],
    topics: ['help', 'support', 'issue', 'problem', 'question', 'account'],
  },
  {
    agentType: 'waiter',
    name: '🍽️ Bar & Restaurant AI',
    description: 'Food service and ordering',
    capabilities: ['menu', 'reservations', 'food_orders', 'recommendations'],
    topics: ['food', 'restaurant', 'bar', 'menu', 'order', 'reservation', 'dining'],
  },
  {
    agentType: 'mobility',
    name: '🚕 Rides AI',
    description: 'Transportation and delivery',
    capabilities: ['ride_booking', 'delivery', 'driver_matching', 'eta'],
    topics: ['ride', 'taxi', 'delivery', 'transport', 'driver', 'pickup', 'dropoff'],
  },
  {
    agentType: 'insurance',
    name: '🛡️ Insurance AI',
    description: 'Insurance services and claims',
    capabilities: ['quotes', 'claims', 'policy_info', 'renewals'],
    topics: ['insurance', 'policy', 'claim', 'coverage', 'renewal', 'motor', 'health'],
  },
  {
    agentType: 'property',
    name: '🏠 Property AI',
    description: 'Real estate and rentals',
    capabilities: ['property_search', 'listings', 'viewings', 'rentals'],
    topics: ['property', 'rent', 'house', 'apartment', 'real estate', 'rental'],
  },
  {
    agentType: 'jobs',
    name: '👔 Jobs AI',
    description: 'Employment and recruitment',
    capabilities: ['job_search', 'applications', 'cv_help', 'interviews'],
    topics: ['job', 'employment', 'career', 'work', 'hire', 'cv', 'resume', 'interview'],
  },
  {
    agentType: 'buy_sell',
    name: '🛍️ Buy & Sell AI',
    description: 'Marketplace and e-commerce',
    capabilities: ['product_listings', 'buying', 'selling', 'negotiations'],
    topics: ['buy', 'sell', 'marketplace', 'product', 'shop', 'business', 'trade'],
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
    console.error(`Agent consultation failed: ${request.toAgent}`, error);
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
